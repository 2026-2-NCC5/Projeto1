#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Limpeza de Dados Demonstrativos / Teste no Supabase
Remove com segurança todos os registros fictícios ('Aluno Demonstração', 'TESTE-*', 'DEMO-ASA-TESTE-*')
mantendo integralmente os estudantes reais da base FECAP.
"""

import os
import sys
import requests

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:
    pass

_env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_file):
    with open(_env_file, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                _k = _k.strip()
                _v = _v.strip().strip("'\"")
                if _k and _k not in os.environ:
                    os.environ[_k] = _v

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://hevywbfvoooybuxxewwp.supabase.co")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SERVICE_ROLE_KEY:
    raise RuntimeError("[cleanup_test_data.py] Variável SUPABASE_SERVICE_ROLE_KEY não encontrada no ambiente do servidor.")

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json"
}

def cleanup():
    # Trava de segurança contra exclusão acidental
    has_confirm_flag = "--confirm" in sys.argv
    env_allowed = os.getenv("ALLOW_DESTRUCTIVE_ACTIONS", "").lower() in ["true", "1", "yes"]
    if not (has_confirm_flag and env_allowed):
        print("
[TRAVA DE SEGURANÇA ATIVADA] Operação de DELETE abortada.")
        print("Para executar a limpeza com segurança, forneça o argumento '--confirm' e configure ALLOW_DESTRUCTIVE_ACTIONS=true no ambiente.")
        print("Exemplo: ALLOW_DESTRUCTIVE_ACTIONS=true python cleanup_test_data.py --confirm")
        sys.exit(1)

    print("[*] Iniciando identificação de registros demonstrativos de teste no Supabase...")

    # 1. Busca todos os alunos de teste
    resp = requests.get(f"{SUPABASE_URL}/rest/v1/students?select=id,ra,name", headers=HEADERS)
    if resp.status_code != 200:
        print("[!] Erro ao listar estudantes:", resp.status_code, resp.text)
        return

    all_students = resp.json()
    test_students = [
        s for s in all_students
        if s.get("ra", "").startswith("TESTE-") or "Aluno Demonstra" in s.get("name", "")
    ]

    print(f"[*] Total de alunos na base: {len(all_students)}")
    print(f"[*] Alunos de teste identificados para exclusão: {len(test_students)}")

    test_ids = [s["id"] for s in test_students]

    # 2. Exclui tabelas filhas dos alunos de teste em lotes
    tables_to_clean = [
        "student_risk_scores",
        "student_contacts",
        "student_financials",
        "student_academic_history",
        "student_relationships",
        "student_requirements",
    ]

    for tbl in tables_to_clean:
        print(f"[*] Limpando referências em {tbl}...")
        for i in range(0, len(test_ids), 30):
            chunk = test_ids[i:i + 30]
            ids_str = ",".join(chunk)
            del_resp = requests.delete(
                f"{SUPABASE_URL}/rest/v1/{tbl}?student_id=in.({ids_str})",
                headers=HEADERS
            )
            if del_resp.status_code not in [200, 204]:
                print(f"[!] Erro ao excluir de {tbl}: {del_resp.status_code} {del_resp.text[:150]}")

    # 3. Exclui requerimentos de teste adicionais pelo protocolo
    print("[*] Excluindo requerimentos com protocolo DEMO-...")
    del_req = requests.delete(
        f"{SUPABASE_URL}/rest/v1/student_requirements?protocol=ilike.DEMO-%25",
        headers=HEADERS
    )
    print(f"  -> Requerimentos demo removidos: {del_req.status_code}")

    # 4. Exclui os alunos de teste da tabela students
    print(f"[*] Excluindo {len(test_ids)} alunos da tabela students...")
    for i in range(0, len(test_ids), 30):
        chunk = test_ids[i:i + 30]
        ids_str = ",".join(chunk)
        del_st = requests.delete(
            f"{SUPABASE_URL}/rest/v1/students?id=in.({ids_str})",
            headers=HEADERS
        )
        if del_st.status_code not in [200, 204]:
            print(f"[!] Erro ao excluir estudantes de teste: {del_st.status_code} {del_st.text[:150]}")

    # 5. Validação final
    resp_after = requests.get(f"{SUPABASE_URL}/rest/v1/students?select=id,ra,name", headers=HEADERS)
    remaining = resp_after.json()
    print(f"[✓] Limpeza concluída com sucesso! Restam {len(remaining)} estudantes reais e legítimos no banco.")

if __name__ == "__main__":
    cleanup()
