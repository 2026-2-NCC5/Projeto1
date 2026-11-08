// Supabase Edge Function: push-notification-dispatcher
// Rodada 5 — Item 2: regras exatas de chat_sessions/chat_messages, transição de status,
// resolução de aluno via students.profile_id, ignorar mensagens IA/Sistema/Feedback
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Expo Push Helper ────────────────────────────────────────────────────────
async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  const validTokens = Array.from(
    new Set(
      tokens.filter(
        (t) =>
          typeof t === "string" &&
          (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["))
      )
    )
  );

  if (validTokens.length === 0) {
    return { sent: 0 };
  }

  const messages = validTokens.map((to) => ({
    to,
    title,
    body,
    sound: "default",
    priority: "high",
    channelId: "default",
    data,
  }));

  const resp = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  const json = await resp.json().catch(() => ({}));
  return { sent: validTokens.length, expoResponse: json };
}

// ─── Student Token Resolution ────────────────────────────────────────────────
// Resolve o push_token do aluno via:
//   1. students.id (TEXT) → students.profile_id → profiles.push_token
//   2. fallback: students.ra → profiles.push_token
//   3. fallback direto: student_ra → profiles.push_token (by ra)
async function resolveStudentTokens(
  supabaseAdmin: ReturnType<typeof createClient>,
  studentId: string | null | undefined,
  studentRa: string | null | undefined
): Promise<string[]> {
  const tokens: string[] = [];

  if (studentId) {
    const { data: st } = await supabaseAdmin
      .from("students")
      .select("profile_id, ra")
      .eq("id", studentId)
      .maybeSingle();

    if (st?.profile_id) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("push_token")
        .eq("id", st.profile_id)
        .maybeSingle();
      if (p?.push_token) tokens.push(p.push_token);
    }

    if (st?.ra) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("push_token")
        .eq("ra", st.ra)
        .maybeSingle();
      if (p?.push_token) tokens.push(p.push_token);
    }
  }

  if (studentRa) {
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("push_token")
      .eq("ra", studentRa)
      .maybeSingle();
    if (p?.push_token) tokens.push(p.push_token);
  }

  return [...new Set(tokens)];
}

// ─── Main Handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validação obrigatória do segredo do Webhook (X-Webhook-Secret)
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    if (webhookSecret) {
      const incomingSecret =
        req.headers.get("x-webhook-secret") ||
        req.headers.get("X-Webhook-Secret") ||
        (req.headers.get("authorization")?.startsWith("Bearer ")
          ? req.headers.get("authorization")?.slice(7)
          : null);

      if (incomingSecret !== webhookSecret) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid webhook secret." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json();

    // ── Chamada direta do cliente ({ tokens, title, body, data }) ──
    // Mantida apenas para debugging/admin — clientes de produção NÃO chamam diretamente
    if (Array.isArray(payload.tokens) && payload.title && payload.body) {
      const result = await sendExpoPush(
        payload.tokens,
        String(payload.title),
        String(payload.body),
        payload.data || {}
      );
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Webhook do banco de dados ({ type, table, record, old_record }) ──
    const { type, table, record, old_record } = payload;
    if (!record) {
      return new Response(JSON.stringify({ success: true, skipped: "no_record" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── A) student_requirements INSERT/UPDATE → notifica o aluno dono ──────
    if (table === "student_requirements" && (type === "INSERT" || type === "UPDATE")) {
      const tokens = await resolveStudentTokens(
        supabaseAdmin,
        record.student_id,
        undefined
      );

      const result = await sendExpoPush(
        tokens,
        `📄 Requerimento ${record.protocol || ""} Atualizado`,
        `Status: ${record.status}. Etapa: ${record.current_stage || "Em Análise"}`,
        {
          type: "requirement_updated",
          requirementId: String(record.id || ""),
          protocol: String(record.protocol || ""),
          status: String(record.status || ""),
        }
      );

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── B) notices INSERT → notifica todos os alunos ──────────────────────
    if (table === "notices" && type === "INSERT" && record.is_active !== false) {
      const { data: studentProfiles } = await supabaseAdmin
        .from("profiles")
        .select("push_token")
        .eq("role", "Aluno")
        .not("push_token", "is", null);

      const tokens = (studentProfiles || [])
        .map((p: { push_token?: string | null }) => p.push_token || "")
        .filter(Boolean);

      const result = await sendExpoPush(
        tokens,
        `📢 Novo Comunicado: ${record.category || "ASA FECAP"}`,
        String(record.title || "Confira o novo aviso no mural oficial."),
        { type: "new_notice", noticeId: String(record.id || "") }
      );

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── C) service_queue UPDATE status=called → notifica o aluno ──────────
    if (table === "service_queue" && type === "UPDATE" && record.status === "called") {
      const tokens: string[] = [];
      if (record.student_ra) {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("push_token")
          .eq("ra", record.student_ra)
          .maybeSingle();
        if (p?.push_token) tokens.push(p.push_token);
      }

      const result = await sendExpoPush(
        tokens,
        `🔔 Senha ${record.ticket_number} Chamada!`,
        `Dirija-se ao ${record.counter || "Guichê CAA"} para atendimento.`,
        {
          type: "queue_ticket_called",
          ticketNumber: String(record.ticket_number || ""),
          counter: String(record.counter || ""),
        }
      );

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── D) chat_sessions INSERT/UPDATE ────────────────────────────────────
    if (table === "chat_sessions") {
      const newStatus: string = record.status || "";
      const oldStatus: string = old_record?.status || "";

      // D1. waiting_staff: somente na TRANSIÇÃO (evita repetição em UPDATE sem mudança)
      if (
        newStatus === "waiting_staff" &&
        oldStatus !== "waiting_staff"
      ) {
        const { data: staffProfiles } = await supabaseAdmin
          .from("profiles")
          .select("push_token")
          .in("role", ["Funcionário", "Funcionario", "Admin", "Administrador"])
          .not("push_token", "is", null);

        const tokens = (staffProfiles || [])
          .map((p: any) => p.push_token)
          .filter(Boolean);

        const result = await sendExpoPush(
          tokens,
          "🎧 Novo Chamado na Fila CAA",
          `${record.student_name || "Estudante"} (${record.student_ra || "Aluno"}) solicitou atendimento humano.`,
          {
            type: "live_support_requested",
            sessionId: String(record.id || ""),
            studentRa: String(record.student_ra || ""),
          }
        );

        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // D2. in_human_support: transição → push ao ALUNO ("atendente assumiu")
      if (
        newStatus === "in_human_support" &&
        oldStatus !== "in_human_support"
      ) {
        const tokens = await resolveStudentTokens(
          supabaseAdmin,
          record.student_id,
          record.student_ra
        );

        const result = await sendExpoPush(
          tokens,
          "🟢 Atendente Assumiu",
          `${record.assigned_staff_name || "Um atendente"} está pronto para te ajudar.`,
          {
            type: "live_support_assumed",
            sessionId: String(record.id || ""),
          }
        );

        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // D3. resolved: transição → push ao ALUNO
      if (
        newStatus === "resolved" &&
        oldStatus !== "resolved"
      ) {
        const tokens = await resolveStudentTokens(
          supabaseAdmin,
          record.student_id,
          record.student_ra
        );

        const result = await sendExpoPush(
          tokens,
          "✅ Atendimento CAA Concluído",
          `Seu atendimento foi encerrado por ${record.assigned_staff_name || "Central CAA"}.`,
          {
            type: "live_support_resolved",
            sessionId: String(record.id || ""),
          }
        );

        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, skipped: "no_relevant_transition" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── E) chat_messages INSERT ───────────────────────────────────────────
    if (table === "chat_messages" && type === "INSERT") {
      // Item 2: Regras de ignore exatas
      const shouldIgnore =
        (record.sender === "assistant" && record.is_human === false) ||
        record.sender === "system" ||
        ["Sistema", "Feedback"].includes(record.sender_role || "");

      if (shouldIgnore) {
        return new Response(JSON.stringify({ success: true, skipped: "ignored_sender" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sessionId = record.session_id;
      if (!sessionId) {
        return new Response(JSON.stringify({ success: true, skipped: "no_session_id" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: session } = await supabaseAdmin
        .from("chat_sessions")
        .select("id, student_id, student_ra, assigned_staff_id, assigned_staff_name, status")
        .eq("id", sessionId)
        .maybeSingle();

      if (!session || session.status !== "in_human_support") {
        return new Response(JSON.stringify({ success: true, skipped: "session_not_in_human_support" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // E1. Mensagem do aluno (sender='user') → notifica staff atribuído
      if (record.sender === "user") {
        const tokens: string[] = [];
        if (session.assigned_staff_id) {
          const { data: p } = await supabaseAdmin
            .from("profiles")
            .select("push_token")
            .eq("id", session.assigned_staff_id)
            .maybeSingle();
          if (p?.push_token) tokens.push(p.push_token);
        }

        const result = await sendExpoPush(
          tokens,
          `💬 ${record.sender_name || "Aluno"}`,
          String(record.text || "Nova mensagem").slice(0, 140),
          { type: "live_chat_message", sessionId: String(sessionId) }
        );

        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // E2. Mensagem do staff (is_human=true AND sender_role='Funcionário') → notifica aluno
      // NUNCA usar sender_role='staff' (valor inexistente no sistema)
      if (record.is_human === true && record.sender_role === "Funcionário") {
        const tokens = await resolveStudentTokens(
          supabaseAdmin,
          session.student_id,
          session.student_ra
        );

        const result = await sendExpoPush(
          tokens,
          `💬 ${record.sender_name || session.assigned_staff_name || "Atendente CAA"}`,
          String(record.text || "Nova mensagem").slice(0, 140),
          { type: "live_chat_message", sessionId: String(sessionId) }
        );

        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, skipped: "no_matching_rule" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, skipped: "no_matching_table" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[push-dispatcher] error:", errMsg);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
