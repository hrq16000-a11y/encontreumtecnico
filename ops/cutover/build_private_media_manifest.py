#!/usr/bin/env python3
"""Local-only, non-publishable mapping of WordPress attachment IDs to ZIP media."""
from __future__ import annotations
import argparse
import json
import os
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET
from verify_backup_integrity import (
    ValidationError, ensure_xml_no_entities, inspect_wxr, inspect_zip,
    uploads_relative_path, validate_member,
)


def build_manifest(wxr: Path, media: Path) -> dict:
    _, media_keys = inspect_zip(media)  # validates safety and all CRCs
    inspect_wxr(wxr, media_keys)  # validates WXR and attachment IDs
    mapping = defaultdict(list)
    with zipfile.ZipFile(media, "r") as archive:
        for entry in archive.infolist():
            validate_member(entry)
            path = uploads_relative_path(entry.filename)
            if path and not entry.is_dir():
                mapping[path].append(entry)
    entries = []
    totals = {"attachment_items": 0, "unmatched": 0, "ambiguous": 0, "missing_path": 0}
    ensure_xml_no_entities(wxr)
    for _, item in ET.iterparse(wxr, events=("end",)):
        if item.tag != "item":
            continue
        fields = {c.tag.rsplit("}", 1)[-1]: (c.text or "").strip() for c in item}
        item.clear()
        if fields.get("post_type") != "attachment":
            continue
        totals["attachment_items"] += 1
        relative = uploads_relative_path(fields.get("attachment_url", ""), source_url=True)
        if not relative:
            totals["missing_path"] += 1
            continue
        matches = mapping.get(relative, [])
        if not matches:
            totals["unmatched"] += 1
        elif len(matches) > 1:
            totals["ambiguous"] += 1
        else:
            entry = matches[0]
            parent = fields.get("post_parent", "")
            entries.append({
                "wp_attachment_id": int(fields["post_id"]),
                "wp_parent_post_id": int(parent) if parent.isdigit() else None,
                "uploads_relative_path": relative,
                "zip_member": entry.filename,
                "zip_crc32": f"{entry.CRC:08x}",
                "zip_file_bytes": entry.file_size,
                "verified_original_owner": False,
                "approved_for_publication": False,
            })
    return {
        "type": "PRIVATE_EUT_REVIEW_ONLY",
        **totals,
        "unique_path_candidates": len(entries),
        "entries": entries,
        "verified_original_owner": False,
        "approved_for_publication": False,
        "cutover_approved": False,
    }


def write_manifest(wxr: Path, media: Path, output: Path) -> dict:
    output = output.expanduser().resolve()
    repository = Path(__file__).resolve().parents[2]
    if output == repository or repository in output.parents:
        raise ValidationError("Private manifest must be outside the Git repository")
    if not output.parent.is_dir():
        raise ValidationError("Destination directory does not exist")
    plan = build_manifest(wxr, media)
    try:
        fd = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ValidationError("Private manifest already exists; refusing overwrite") from exc
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(plan, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
    except BaseException:
        output.unlink(missing_ok=True)
        raise
    return {k: v for k, v in plan.items() if k in (
        "attachment_items", "unmatched", "ambiguous", "missing_path",
        "unique_path_candidates", "approved_for_publication", "cutover_approved"
    )}


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--wxr", type=Path, required=True)
    cli.add_argument("--media", type=Path, required=True)
    cli.add_argument("--private-out", type=Path, required=True)
    args = cli.parse_args()
    try:
        print(json.dumps({"ok": True, **write_manifest(args.wxr, args.media, args.private_out)}))
    except (ValidationError, OSError, PermissionError) as exc:
        reason = str(exc) if isinstance(exc, ValidationError) else "Filesystem operation failed"
        print(json.dumps({"ok": False, "reason": reason, "cutover_approved": False}), file=sys.stderr)
        sys.exit(1)
