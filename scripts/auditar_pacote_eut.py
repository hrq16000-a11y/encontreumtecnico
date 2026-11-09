#!/usr/bin/env python3
"""Auditoria local e PRIVADA do pacote WXR pré-processado. Não exporta PII."""
import argparse
import collections
import csv
import hashlib
import json
from pathlib import Path
import sys
import zipfile

def audit(package: Path, contacts: Path):
    with zipfile.ZipFile(package) as z:
        if z.testzip():
            raise ValueError("ZIP com falha de CRC")
        profiles = json.loads(z.read("perfis.json"))
        summary = json.loads(z.read("resumo.json"))
        hashes = json.loads(z.read("fotos-sha256.json"))
        if not isinstance(profiles, list) or not isinstance(hashes, dict):
            raise ValueError("Estrutura inválida")
        fields = {"id_origem", "slug_origem", "status_origem", "publicacao_destino", "contato_exige_login"}
        if any(not isinstance(p, dict) or not fields.issubset(p) for p in profiles):
            raise ValueError("Perfil incompleto")
        ids = {str(p["id_origem"]) for p in profiles}
        slugs = {str(p["slug_origem"]) for p in profiles}
        if len(ids) != len(profiles) or len(slugs) != len(profiles):
            raise ValueError("Identificadores duplicados")
        photos = {p["foto"] for p in profiles if p.get("foto")}
        verified = 0
        for name in photos & set(z.namelist()):
            if name not in hashes or hashlib.sha256(z.read(name)).hexdigest() != hashes[name]:
                raise ValueError("Foto diferente do manifesto SHA256")
            verified += 1
        blocked_profiles = all(p["publicacao_destino"] != "publicado" and p["contato_exige_login"] is True for p in profiles)

    with contacts.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not {"ddd", "status", "publicar", "conta_google_verificada"}.issubset(reader.fieldnames or []):
            raise ValueError("Colunas de conciliação ausentes")
        rows = list(reader)
    blocked_contacts = all(r.get("publicar", "").lower() == "nao" for r in rows)
    if not blocked_profiles or not blocked_contacts:
        raise ValueError("Violação do bloqueio de publicação")
    def counts(values, field):
        return dict(sorted(collections.Counter(str(v.get(field, "")) for v in values).items()))
    return {
        "perfis": len(profiles),
        "ids_unicos": len(ids),
        "slugs_unicos": len(slugs),
        "status_destino": counts(profiles, "publicacao_destino"),
        "fotos_principais_referenciadas": len(photos),
        "fotos_verificadas_sha256": verified,
        "referencias_de_midia_ausentes_no_original": summary.get("midias_ausentes"),
        "contatos_conciliados": len(rows),
        "status_contatos": counts(rows, "status"),
        "contatos_google_verificados": sum(r.get("conta_google_verificada", "").lower() == "sim" for r in rows),
        "perfis_e_contatos_bloqueados_para_publicacao": blocked_profiles and blocked_contacts,
        "dados_migrados_para_supabase": False,
        "observacao": "Apenas inventário, sem nomes, telefones ou dados privados; não publica nada."
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--pacote", type=Path, required=True)
    p.add_argument("--contatos", type=Path, required=True)
    args = p.parse_args()
    try:
        report = audit(args.pacote, args.contatos)
    except (ValueError, OSError, KeyError, json.JSONDecodeError, zipfile.BadZipFile) as e:
        print("Auditoria interrompida: " + str(e), file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
