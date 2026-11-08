#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configura os buckets públicos no Supabase Storage:
1. documentos-asa: Armazena os PDFs originais da pasta DocumentosASA em sua total integralidade + fichas geradas.
2. notices-images: Armazena imagens enviadas nos avisos e comunicados.
3. avatars: Armazena fotos de perfil de alunos e funcionários.
"""

import os
import sys
import unicodedata
import re
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
    raise RuntimeError("[setup_storage_buckets.py] Variável SUPABASE_SERVICE_ROLE_KEY não encontrada no ambiente do servidor.")

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
}

DOCS_DIR = os.path.join(os.path.dirname(__file__), "DocumentosASA")


def slugify_filename(filename: str) -> str:
    name, ext = os.path.splitext(filename)
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    clean = re.sub(r"[^a-zA-Z0-9_-]+", "_", normalized).strip("_")
    return f"{clean}{ext.lower()}"


def ensure_bucket(bucket_id: str):
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    resp = requests.get(f"{url}/{bucket_id}", headers=HEADERS)
    if resp.status_code == 200:
        print(f"[OK] Bucket '{bucket_id}' já existe.")
        # Garante que é público
        requests.put(
            f"{url}/{bucket_id}",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"id": bucket_id, "name": bucket_id, "public": True},
        )
        return

    create_resp = requests.post(
        url,
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"id": bucket_id, "name": bucket_id, "public": True},
    )
    if create_resp.status_code in (200, 201):
        print(f"[+] Bucket público '{bucket_id}' criado com sucesso!")
    else:
        print(f"[!] Erro ao criar bucket '{bucket_id}': {create_resp.status_code} {create_resp.text}")


def upload_documentos_asa():
    if not os.path.exists(DOCS_DIR):
        print(f"[!] Pasta não encontrada: {DOCS_DIR}")
        return {}

    uploaded_map = {}
    files = sorted(os.listdir(DOCS_DIR))
    for fname in files:
        fpath = os.path.join(DOCS_DIR, fname)
        if not os.path.isfile(fpath):
            continue

        safe_name = slugify_filename(fname)
        object_path = f"oficiais/{safe_name}"
        upload_url = f"{SUPABASE_URL}/storage/v1/object/documentos-asa/{object_path}"

        with open(fpath, "rb") as f:
            file_bytes = f.read()

        content_type = "application/pdf" if fname.lower().endswith(".pdf") else "application/octet-stream"
        up_headers = {
            **HEADERS,
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        resp = requests.post(upload_url, headers=up_headers, data=file_bytes)
        if resp.status_code in (200, 201):
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/documentos-asa/{object_path}"
            uploaded_map[fname] = public_url
            print(f"  [OK] {fname} ({len(file_bytes)} bytes) -> {public_url}")
        else:
            print(f"  [!] Falha no upload de {fname}: {resp.status_code} {resp.text}")

    return uploaded_map


if __name__ == "__main__":
    print("=== Configurando Buckets no Supabase Storage ===")
    for b in ["documentos-asa", "notices-images", "avatars"]:
        ensure_bucket(b)

    print("\n=== Fazendo Upload Integral dos PDFs de DocumentosASA ===")
    mapping = upload_documentos_asa()
    print(f"\nTotal de arquivos enviados: {len(mapping)}")
