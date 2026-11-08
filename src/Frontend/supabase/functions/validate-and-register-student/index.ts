// Supabase Edge Function: validate-and-register-student
// Validação institucional de RA ativo e pré-criação de conta de estudante
// Rodada 5 — Item 3 (random password, DB rate limit, resend-only for unconfirmed, OTP via signInWithOtp)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resposta genérica de sucesso — nunca revela se o usuário já existia ou não
const GENERIC_OK = {
  success: true,
  message: "Se o e-mail for válido, um código de verificação será enviado em instantes.",
};

// Resposta genérica de erro — não revela estado do usuário
const GENERIC_ERR_BODY = JSON.stringify({
  error: "Não foi possível processar o cadastro. Verifique os dados e tente novamente.",
});

function genericError(status = 400) {
  return new Response(GENERIC_ERR_BODY, {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Supabase anon client (para chamar signInWithOtp sem service role)
  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const { email } = await req.json();

    const cleanEmail = (email || "").trim().toLowerCase();

    // Item 3: Validação estrita — apenas ^[0-9]+@alvarista\.fecap\.br$
    if (!cleanEmail || !/^[0-9]+@alvarista\.fecap\.br$/.test(cleanEmail)) {
      return genericError(400);
    }

    const derivedRa = cleanEmail.split("@")[0];

    // Item 3: Rate limit via tabela public.signup_rate_limits (não in-memory)
    // Chave: ip:email (combinada para evitar spray)
    const rlKey = `${clientIp}:${cleanEmail}`;
    const windowMs = 5 * 60 * 1000; // 5 minutos
    const maxAttempts = 5;

    const { data: rlRow, error: rlErr } = await supabaseAdmin
      .from("signup_rate_limits")
      .select("attempts, window_start")
      .eq("key", rlKey)
      .maybeSingle();

    if (!rlErr && rlRow) {
      const windowStart = new Date(rlRow.window_start).getTime();
      const now = Date.now();
      if (now - windowStart < windowMs && rlRow.attempts >= maxAttempts) {
        return new Response(
          JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (now - windowStart >= windowMs) {
        // Reset da janela
        await supabaseAdmin
          .from("signup_rate_limits")
          .update({ attempts: 1, window_start: new Date().toISOString() })
          .eq("key", rlKey);
      } else {
        // Incrementa
        await supabaseAdmin
          .from("signup_rate_limits")
          .update({ attempts: rlRow.attempts + 1 })
          .eq("key", rlKey);
      }
    } else {
      // Primeira tentativa
      await supabaseAdmin
        .from("signup_rate_limits")
        .upsert({ key: rlKey, attempts: 1, window_start: new Date().toISOString() });
    }

    // 1. Valida RA na base oficial
    const { data: studentRecord, error: stErr } = await supabaseAdmin
      .from("students")
      .select("id, ra, name, course, semestre, status_academico")
      .eq("ra", derivedRa)
      .maybeSingle();

    if (stErr || !studentRecord) {
      // Resposta genérica — não revela que o RA não existe
      return new Response(JSON.stringify(GENERIC_OK), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bloqueio de alunos Evadidos/Cancelados
    const statusNorm = (studentRecord.status_academico || "").toLowerCase();
    if (statusNorm.includes("evas") || statusNorm.includes("cancel") || statusNorm.includes("tranc")) {
      return new Response(
        JSON.stringify({
          error: "Matrícula institucional inativa. Procure a Central de Atendimento ao Aluno (CAA) para regularização.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifiedName = studentRecord.name || "Estudante Alvarista";
    const verifiedCourse = studentRecord.course || "Graduação FECAP";
    const verifiedSemester = studentRecord.semestre || "1º Semestre";

    // 2. Verifica se usuário já existe
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = (userList?.users || []).find(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );

    if (existingUser) {
      if (existingUser.email_confirmed_at) {
        // Já confirmado — resposta genérica (não revelar que conta existe)
        return new Response(JSON.stringify(GENERIC_OK), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Item 3: Usuário existente NÃO confirmado → só reenvia OTP, NÃO atualiza senha
        // Atualiza metadados mas NÃO toca a senha
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          user_metadata: {
            name: verifiedName,
            ra: derivedRa,
            role: "Aluno",
            course: verifiedCourse,
          },
        });

        // Upsert no profiles (idempotente)
        await supabaseAdmin.from("profiles").upsert({
          id: existingUser.id,
          name: verifiedName,
          ra: derivedRa,
          email: cleanEmail,
          role: "Aluno",
          course: verifiedCourse,
          semester: verifiedSemester,
          updated_at: new Date().toISOString(),
        });

        // Reenviar OTP via signInWithOtp (shouldCreateUser: false)
        await supabaseAnon.auth.signInWithOtp({
          email: cleanEmail,
          options: { shouldCreateUser: false },
        });

        return new Response(JSON.stringify(GENERIC_OK), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Item 3: Novo usuário — cria com SENHA ALEATÓRIA (não a senha do usuário)
    // O app define a senha após verifyOtp via supabase.auth.updateUser({ password })
    const randomPassword = crypto.randomUUID() + "-" + crypto.randomUUID();

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: randomPassword,
      email_confirm: false, // exige confirmação via OTP
      user_metadata: {
        name: verifiedName,
        ra: derivedRa,
        role: "Aluno",
        course: verifiedCourse,
      },
    });

    if (authErr) {
      console.error("[validate-and-register] createUser error:", authErr.message);
      return genericError(400);
    }

    const userId = authData.user.id;

    // 4. Upsert em profiles
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      name: verifiedName,
      ra: derivedRa,
      email: cleanEmail,
      role: "Aluno",
      course: verifiedCourse,
      semester: verifiedSemester,
      updated_at: new Date().toISOString(),
    });

    // 5. Envia OTP de 6 dígitos via signInWithOtp (shouldCreateUser: false)
    const { error: otpErr } = await supabaseAnon.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: false },
    });

    if (otpErr) {
      console.error("[validate-and-register] signInWithOtp error:", otpErr.message);
      // Não falha — o usuário foi criado; resposta genérica
    }

    return new Response(JSON.stringify(GENERIC_OK), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[validate-and-register] unexpected:", errMsg);
    return genericError(500);
  }
});
