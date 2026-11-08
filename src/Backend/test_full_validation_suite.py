"""
Suíte Completa de Testes de Validação — Agente IA FECAP SISA & ASA_WEB
======================================================================
Abrange:
  1. Testes Unitários (Normalização, gírias, extração de entidades, humor,
     assimilação de contexto multi-turno, injeção de perfil do aluno,
     detecção de ambiguidade e alta precisão em requerimentos).
  2. Testes de Integração (Endpoints FastAPI via TestClient: /api/health,
     /api/horarios, /api/requerimentos, /api/knowledge/search,
     /api/admin/documents/upload com .md nativo e /api/staff/students-risk).
  3. Testes Funcionais e Q&A de Conhecimento (Multi-turno 5NA Econo -> Cálculo,
     injeção automática de perfil do aluno logado, regulamentos PEDP,
     Critérios de Avaliação, Estágio Supervisionado, PAFE e DP Sábado).
  4. Testes do Perfil Funcionário / Staff (/api/staff/chat em múltiplos turnos
     para diagnóstico de risco estudantil multidimensional e retenção de contexto).
"""

import io
import json
import os
import sys
import unittest
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

from agent import (
    agente_academico,
    assimilar_contexto_conversa,
    buscar_horarios_relevantes,
    buscar_requerimentos_relevantes,
    detectar_humor_estudante,
    expandir_consulta_academica,
    extrair_entidades_consulta,
    knowledge_engine,
    normalizar_texto,
)
from server import app, extrair_aluno_ativo_contexto


class TestSuite1Unitarios(unittest.TestCase):
    """1. Testes Unitários — Normalização, Entidades, Humor, Contexto, Ambiguidade e Requerimentos."""

    def test_01_normalizacao_e_girias(self):
        texto = "vc sabe qnd vai ser a po de macro do 5na econo e calc?"
        expandido = normalizar_texto(expandir_consulta_academica(texto))
        self.assertIn("voce", expandido)
        self.assertIn("quando", expandido)
        self.assertIn("prova oficial", expandido)
        self.assertIn("macroeconomia", expandido)
        self.assertIn("ciencias economicas", expandido)
        self.assertIn("calculo", expandido)

    def test_02_extracao_entidades_consulta(self):
        entidades = extrair_entidades_consulta("qual a data da prova de macroeconomia do 5na econo?")
        self.assertEqual(entidades["curso_label"], "Ciências Econômicas")
        self.assertEqual(entidades["codigo_turma"].upper(), "5NA")
        self.assertEqual(entidades["semestre"], 5)
        self.assertIn("macroeconomia", entidades["disciplina_detectada"])
        self.assertEqual(entidades["intencao"], "data_prova")

    def test_03_deteccao_humor_estudante(self):
        h_ansioso = detectar_humor_estudante("socorro to desesperado vou reprovar em calculo!")
        self.assertEqual(h_ansioso["humor"], "ansioso_ou_preocupado")

        h_frustrado = detectar_humor_estudante("que absurdo essa nota nao faz sentido nenhum!")
        self.assertEqual(h_frustrado["humor"], "frustrado_ou_irritado")

        h_confuso = detectar_humor_estudante("nao entendi como funciona a media da ni com a po")
        self.assertEqual(h_confuso["humor"], "confuso_ou_em_duvida")

        h_casual = detectar_humor_estudante("opa mano blz? vc sabe o horario da aula?")
        self.assertEqual(h_casual["humor"], "casual_coloquial")

        h_objetivo = detectar_humor_estudante("Qual a data da prova de Macroeconomia?")
        self.assertEqual(h_objetivo["humor"], "objetivo_padrao")

    def test_04_assimilacao_contexto_multiturno(self):
        mensagens = [
            {"role": "user", "content": "qual a data da prova de macroeconomia do 5na econo?"},
            {"role": "assistant", "content": "A prova de Macroeconomia do 5NA de Ciências Econômicas será em 19/11/2026."},
            {"role": "user", "content": "e a de cálculo?"},
        ]
        ctx = assimilar_contexto_conversa(mensagens)
        self.assertEqual(ctx["curso_label"], "Ciências Econômicas")
        self.assertEqual(ctx["codigo_turma"].upper(), "5NA")
        self.assertEqual(ctx["semestre"], 5)
        self.assertEqual(ctx["intencao"], "data_prova")
        self.assertIn("calculo", normalizar_texto(ctx["disciplina_detectada"] or ""))
        self.assertIn("macroeconomia", normalizar_texto(ctx["disciplina_anterior"] or ""))

    def test_05_injecao_perfil_aluno_logado_e_sobrescrita(self):
        perfil = {
            "ra": "24018932",
            "name": "Gabriel Martins Ribeiro",
            "course": "Ciência da Computação",
            "semester": "5º Semestre",
        }
        # Turno 1 sem citar curso/turma na pergunta -> deve assumir o perfil logado (CCOMP 5º Semestre / 5na)
        msgs_sem_turma = [
            {"role": "user", "content": "qual a data da minha prova de pesquisa operacional?"}
        ]
        ctx_perfil = assimilar_contexto_conversa(msgs_sem_turma, perfil_aluno=perfil)
        self.assertEqual(ctx_perfil["curso_label"], "Ciência da Computação")
        self.assertEqual(ctx_perfil["semestre"], 5)
        self.assertEqual(ctx_perfil["codigo_turma"].upper(), "5NA")
        self.assertEqual(ctx_perfil["intencao"], "data_prova")
        self.assertTrue(ctx_perfil["veio_do_perfil"])

        # Se o aluno perguntar explicitamente de outro curso/turma, a mensagem explícita sobrescreve o perfil
        msgs_outro_curso = [
            {"role": "user", "content": "qual a data da prova de macroeconomia do 5na econo?"}
        ]
        ctx_override = assimilar_contexto_conversa(msgs_outro_curso, perfil_aluno=perfil)
        self.assertEqual(ctx_override["curso_label"], "Ciências Econômicas")
        self.assertEqual(ctx_override["codigo_turma"].upper(), "5NA")
        self.assertFalse(ctx_override["veio_do_perfil"])

    def test_06_deteccao_ambiguidade_calculo_5na_econo(self):
        mensagens = [
            {"role": "user", "content": "qual a data da prova de macroeconomia do 5na econo?"},
            {"role": "assistant", "content": "A prova será em 19/11/2026."},
            {"role": "user", "content": "e a de cálculo?"},
        ]
        ctx = assimilar_contexto_conversa(mensagens)
        amb = knowledge_engine.detectar_ambiguidade(ctx)
        self.assertIsNotNone(amb)
        self.assertTrue(amb.get("ambigua"))
        self.assertIn("Cálculo", amb.get("motivo", ""))
        self.assertIn("Cálculo I", amb.get("pergunta_sugerida", ""))
        self.assertIn("Cálculo II", amb.get("pergunta_sugerida", ""))

    def test_07_requerimentos_alta_precisao_sem_falsos_positivos(self):
        # Consultas informativas de prova/horário NÃO devem retornar requerimentos de alta confiança
        req_falso_1 = buscar_requerimentos_relevantes(
            "qual a data da prova de macroeconomia do 5na econo?", top_k=3, apenas_alta_confianca=True
        )
        req_falso_2 = buscar_requerimentos_relevantes(
            "e a de cálculo?", top_k=3, apenas_alta_confianca=True
        )
        self.assertEqual(len(req_falso_1), 0)
        self.assertEqual(len(req_falso_2), 0)

        # Consultas procedimentais de secretaria DEVEM retornar o requerimento correto
        req_sptrans = buscar_requerimentos_relevantes(
            "como solicitar o passe escolar sptrans bilhete unico?", top_k=3, apenas_alta_confianca=True
        )
        self.assertGreater(len(req_sptrans), 0)
        self.assertTrue(any("SPTrans" in r.get("titulo", "") or "Passe Escolar" in r.get("titulo", "") for r in req_sptrans))

        req_trancamento = buscar_requerimentos_relevantes(
            "quero abrir requerimento de trancamento de matricula", top_k=3, apenas_alta_confianca=True
        )
        self.assertGreater(len(req_trancamento), 0)


class TestSuite2IntegracaoEndpoints(unittest.TestCase):
    """2. Testes de Integração — Endpoints FastAPI (/api/health, /api/knowledge, /api/admin, /api/staff)."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("Markdown-First Knowledge Graph", data["features"])
        self.assertIn("Multi-Turn Context Assimilation", data["features"])

    def test_02_horarios_e_requerimentos_endpoints(self):
        res_h = self.client.get("/api/horarios", params={"q": "5na econo"})
        self.assertEqual(res_h.status_code, 200)
        turmas = res_h.json()["horarios"]
        self.assertGreater(len(turmas), 0)
        self.assertIn("5NA", turmas[0]["codigo"].upper())
        self.assertIn("Ciências Econômicas", turmas[0]["curso"])
        self.assertTrue(len(turmas[0].get("grade", [])) > 0)

        res_r = self.client.get("/api/requerimentos", params={"q": "passe escolar sptrans"})
        self.assertEqual(res_r.status_code, 200)
        self.assertGreater(res_r.json()["total"], 0)

    def test_03_knowledge_search_e_rag_compat(self):
        res_k = self.client.post(
            "/api/knowledge/search",
            json={"query": "Programa de Educação Dinâmica e Progressiva PEDP", "top_k": 3},
        )
        self.assertEqual(res_k.status_code, 200)
        chunks = res_k.json()["chunks"]
        self.assertEqual(len(chunks), 3)
        self.assertTrue(any("PEDP" in c["texto"] or "Progressiva" in c["texto"] for c in chunks))

        res_rag = self.client.post(
            "/api/rag/search",
            json={"query": "Bolsa PAFE auxílio financeiro", "top_k": 3},
        )
        self.assertEqual(res_rag.status_code, 200)
        self.assertEqual(len(res_rag.json()["chunks"]), 3)

    def test_04_upload_nativo_markdown_admin(self):
        md_test_content = """---
id: doc-teste-mostra-cientifica
titulo: Mostra Científica de Inovação Alvarista 2026
categoria: Acadêmico
tags: [mostra, inovacao, alvarista]
---

# Mostra Científica de Inovação Alvarista 2026

## Regras da Mostra Científica de Inovação Alvarista
A Mostra Científica de Inovação Alvarista ocorrerá no dia **06/12/2026** às **09:00** no Auditório Bloco E com código **MOSTRA-ALVARISTA-2026**.
"""
        files = {
            "file": ("mostra_cientifica_inovacao_teste.md", io.BytesIO(md_test_content.encode("utf-8")), "text/markdown")
        }
        data = {
            "title": "Mostra Científica de Inovação Alvarista 2026 (Teste Automatizado)",
            "category": "Acadêmico",
            "description": "Documento de teste para validar upload nativo de Markdown (.md) no Grafo de Conhecimento.",
        }
        res = self.client.post("/api/admin/documents/upload", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        try:
            self.assertEqual(payload["status"], "success")
            self.assertIn("markdown_file", payload)

            # Verifica se a seção recém-adicionada é encontrada pelo motor de busca Markdown
            busca = knowledge_engine.buscar_secoes("Mostra Científica de Inovação Alvarista MOSTRA-ALVARISTA-2026", top_k=2)
            self.assertTrue(any("MOSTRA-ALVARISTA-2026" in s["content"] for s in busca))
        finally:
            # Limpeza pós-teste para manter o repositório limpo
            md_filename = payload.get("markdown_file")
            if md_filename:
                md_path = BACKEND_DIR / "knowledge_graph" / "documentos" / md_filename
                if md_path.exists():
                    md_path.unlink()
            for f_raw in (BACKEND_DIR / "DocumentosASA").glob("*mostra_cientifica_inovacao_teste.md"):
                f_raw.unlink(missing_ok=True)
            index_md_path = BACKEND_DIR / "knowledge_graph" / "index.md"
            if index_md_path.exists():
                idx_lines = [
                    ln for ln in index_md_path.read_text(encoding="utf-8").splitlines()
                    if "Teste Automatizado" not in ln and "Teste_Automatizado" not in ln
                ]
                index_md_path.write_text("\n".join(idx_lines) + "\n", encoding="utf-8")
            docs_asa_path = BACKEND_DIR / "documentosASA.json"
            if docs_asa_path.exists():
                docs_asa = json.loads(docs_asa_path.read_text(encoding="utf-8"))
                docs_asa["documentos"] = [
                    d for d in docs_asa.get("documentos", [])
                    if "Teste Automatizado" not in d.get("title", "") and "Teste Automatizado" not in d.get("titulo", "")
                ]
                docs_asa["total_documentos"] = len(docs_asa["documentos"])
                for _attempt in range(5):
                    try:
                        docs_asa_path.write_text(json.dumps(docs_asa, ensure_ascii=False, indent=2), encoding='utf-8')
                        break
                    except OSError:
                        time.sleep(0.3)
                from knowledge_manager import knowledge_manager
                # Regenera documentosResumo.ts e documentosResumo.json limpos
                _candidates = [
                    BACKEND_DIR.parent / "Frontend" / "src" / "services" / "ai-agent" / "data",
                    BACKEND_DIR.parent / "src" / "services" / "ai-agent" / "data",
                ]
                frontend_dir = next((c for c in _candidates if c.is_dir()), _candidates[0])
                summary_docs = [
                    {
                        "id": d["id"],
                        "arquivo": d["arquivo"],
                        "titulo": d["titulo"],
                        "categoria": d["categoria"],
                        "paginas": d.get("paginas", 1),
                        "palavras_chave": d.get("palavras_chave", []),
                        "resumo": d.get("resumo", ""),
                        "trechos_chave": d.get("conteudo_completo", "")[:2000],
                    }
                    for d in docs_asa["documentos"]
                ]
                (frontend_dir / "documentosResumo.json").write_text(
                    json.dumps({"documentos": summary_docs}, ensure_ascii=False, indent=2), encoding="utf-8"
                )
            from export_mobile_knowledge_graph import export_knowledge_graph
            export_knowledge_graph()
            knowledge_engine.carregar_grafo()

    def test_05_staff_students_risk_endpoints(self):
        res_all = self.client.get("/api/staff/students-risk")
        self.assertEqual(res_all.status_code, 200)
        data_all = res_all.json()
        self.assertGreater(data_all["total"], 0)
        self.assertIn("estatisticas", data_all)

        res_red = self.client.get("/api/staff/students-risk", params={"category": "Vermelho"})
        self.assertEqual(res_red.status_code, 200)
        for p in res_red.json()["alunos"]:
            self.assertEqual(p["category"], "Vermelho")

        res_student = self.client.get("/api/staff/students-risk/24018932")
        self.assertEqual(res_student.status_code, 200)
        student = res_student.json()["aluno"]
        self.assertEqual(student["ra"], "24018932")
        self.assertIn("Gabriel Martins Ribeiro", student["name"])
        self.assertEqual(student["category"], "Vermelho")


class TestSuite3FuncionalQAEstudante(unittest.TestCase):
    """3. Testes Funcionais e Q&A de Conhecimento (Perfil Estudante)."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_fluxo_multiturno_macroeconomia_5na_econo_para_calculo(self):
        # Turno 1: "qual a data da prova de macroeconomia do 5na econo?"
        t1_msgs = [
            {"role": "user", "content": "qual a data da prova de macroeconomia do 5na econo?"}
        ]
        res1 = self.client.post("/api/chat", json={"messages": t1_msgs})
        self.assertEqual(res1.status_code, 200)
        ans1 = res1.json()["response"]
        print("\n[Teste 3.1 - Turno 1 (Macroeconomia 5NA Econo)]:\n", ans1)

        self.assertIn("30/11/2026", ans1)
        self.assertTrue("21:20" in ans1 or "233" in ans1)

        # Turno 2: "e a de cálculo?" (sem repetir curso, turma ou a palavra 'prova')
        t2_msgs = t1_msgs + [
            {"role": "assistant", "content": ans1},
            {"role": "user", "content": "e a de cálculo?"},
        ]
        res2 = self.client.post("/api/chat", json={"messages": t2_msgs})
        self.assertEqual(res2.status_code, 200)
        ans2 = res2.json()["response"]
        print("\n[Teste 3.1 - Turno 2 (Follow-up 'e a de cálculo?')]:\n", ans2)

        # Deve reconhecer que o 5NA de Economia não tem Cálculo na grade regular do 5º semestre
        # e apresentar proativamente as opções (Cálculo I - 17/11, Cálculo II - 24/11 ou DP Sábado - 28/11)
        self.assertTrue(
            "17/11/2026" in ans2 or "24/11/2026" in ans2 or "28/11/2026" in ans2 or "Cálculo I" in ans2,
            "A resposta deve apresentar as datas das opções de Cálculo ou pedir esclarecimento contextual.",
        )

    def test_02_injecao_automatica_perfil_estudante_logado(self):
        # O aluno logado é de Ciência da Computação, 5º Semestre (turma 5NA),
        # e pergunta apenas "qual a data da minha prova de sistemas operacionais?" sem mencionar curso ou semestre
        res = self.client.post(
            "/api/chat",
            json={
                "messages": [
                    {"role": "user", "content": "qual a data da minha prova de sistemas operacionais?"}
                ],
                "student_profile": {
                    "ra": "24018932",
                    "name": "Gabriel Martins Ribeiro",
                    "course": "Ciência da Computação",
                    "semester": "5º Semestre",
                },
            },
        )
        self.assertEqual(res.status_code, 200)
        ans = res.json()["response"]
        print("\n[Teste 3.2 - Injeção Automática de Perfil (CCOMP 5º Sem -> Sistemas Operacionais)]:\n", ans)
        self.assertIn("03/12/2026", ans)
        self.assertTrue("304" in ans or "Rodrigo" in ans or "5NA" in ans)

    def test_03_qa_regulamentos_pedp_criterios_estagio_pafe(self):
        perguntas_esperadas = [
            (
                "Como funciona o PEDP (Programa de Educação Dinâmica e Progressiva) e como os pontos de nivelamento entram na NI?",
                ["PEDP", "NI"],
            ),
            (
                "Qual a média mínima para aprovação direta sem exame na graduação e quanto preciso tirar no exame final?",
                ["6,0", "7,0", "5,0"],
            ),
            (
                "Qual a carga horária máxima diária e semanal permitida no estágio supervisionado e o que é o TCE?",
                ["6", "30"],
            ),
            (
                "Perdi meu emprego e estou com dificuldade financeira para pagar a mensalidade. Como funciona a bolsa PAFE ou Bolsa Restituível?",
                ["PAFE"],
            ),
        ]

        for pergunta, termos_esperados in perguntas_esperadas:
            res = self.client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": pergunta}]},
            )
            self.assertEqual(res.status_code, 200)
            ans = res.json()["response"]
            print(f"\n[Teste 3.3 - Q&A Regulamento] Pergunta: {pergunta}\nResposta: {ans[:350]}...")
            self.assertTrue(
                any(t.lower() in ans.lower() for t in termos_esperados),
                f"Esperava ao menos um dos termos {termos_esperados} na resposta para: {pergunta}",
            )


class TestSuite4PerfilFuncionarioStaff(unittest.TestCase):
    """4. Testes do Perfil Funcionário (Staff) — Busca de Alunos, Risco Multidimensional e Multi-Turno."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_extracao_aluno_ativo_multiturno_unit(self):
        from student_risk_agent import student_risk_agent
        profiles = student_risk_agent.processed_profiles or student_risk_agent.carregar_dados_amostra(limite_alunos=200)
        history = [
            {"role": "user", "content": "Qual o diagnóstico de risco do aluno 24018932?"},
            {"role": "assistant", "content": "Gabriel Martins Ribeiro apresenta Risco Crítico (Vermelho - 90/100)."},
        ]
        # No Turno 2, o funcionário pergunta apenas "E como está o financeiro dele?"
        aluno = extrair_aluno_ativo_contexto("E como está o financeiro dele?", history, profiles)
        self.assertIsNotNone(aluno)
        self.assertEqual(aluno["ra"], "24018932")
        self.assertIn("Gabriel Martins Ribeiro", aluno["name"])

    def test_02_staff_chat_multiturno_diagnostico_e_plano_retencao(self):
        # Turno 1: Busca pelo RA 24018932 (Gabriel Martins Ribeiro)
        q1 = "Qual o diagnóstico de risco do aluno 24018932?"
        res1 = self.client.post(
            "/api/staff/chat",
            json={"query": q1, "history": []},
        )
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        ans1 = data1["response"]
        print("\n[Teste 4.2 - Staff Turno 1 (RA 24018932)]:\n", ans1)

        self.assertIsNotNone(data1["active_student"])
        self.assertEqual(data1["active_student"]["ra"], "24018932")
        self.assertIn("Gabriel Martins Ribeiro", ans1)
        self.assertTrue("90" in ans1 or "82.5" in ans1 or "Vermelho" in ans1 or "Crítico" in ans1 or "Financeir" in ans1)

        # Turno 2: Pergunta de acompanhamento SEM repetir o nome ou RA do aluno
        q2 = "E como está a situação financeira dele e qual a recomendação do PAFE para evitar a evasão?"
        history_t2 = [
            {"role": "user", "content": q1},
            {"role": "assistant", "content": ans1},
        ]
        res2 = self.client.post(
            "/api/staff/chat",
            json={"query": q2, "history": history_t2},
        )
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        ans2 = data2["response"]
        print("\n[Teste 4.2 - Staff Turno 2 (Follow-up Financeiro + PAFE sem repetir RA)]:\n", ans2)

        # Verifica que o aluno ativo no contexto permaneceu Gabriel Martins Ribeiro (24018932)
        self.assertIsNotNone(data2["active_student"])
        self.assertEqual(data2["active_student"]["ra"], "24018932")
        self.assertTrue(
            "Gabriel" in ans2 or "24018932" in ans2 or "PAFE" in ans2 or "mensalidade" in ans2.lower() or "financeir" in ans2.lower()
        )

    def test_03_staff_chat_busca_por_nome_e_panorama_geral(self):
        # Busca por nome "Camila Antunes Silva" (RA 1255 - Risco Amarelo)
        res_camila = self.client.post(
            "/api/staff/chat",
            json={"query": "Como está o desempenho acadêmico e risco da aluna Camila Antunes Silva?", "history": []},
        )
        self.assertEqual(res_camila.status_code, 200)
        data_camila = res_camila.json()
        self.assertIsNotNone(data_camila["active_student"])
        self.assertEqual(data_camila["active_student"]["ra"], "1255")
        print("\n[Teste 4.3 - Staff Busca por Nome (Camila Antunes Silva - RA 1255)]:\n", data_camila["response"][:400])


if __name__ == "__main__":
    unittest.main(verbosity=2)
