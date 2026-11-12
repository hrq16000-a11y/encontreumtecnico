#!/usr/bin/env python3
"""Offline integrity audit of EUT WordPress backups. Does not extract or import data.

Only prints aggregate statistics, SHA-256 hashes and readiness flags. Never prints
SQL contents, archive member names, WordPress user data, or environment variables.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import sys
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

CHUNK = 1024 * 1024
MAX_ZIP_MEMBERS = 100_000
MAX_TOTAL_UNCOMPRESSED = 12 * 1024**3
MAX_SINGLE_UNCOMPRESSED = 2 * 1024**3
MAX_RATIO = 500


class ValidationError(ValueError):
    """Fail closed. Messages must never include private file contents or paths."""


def file_checksum(path: Path) -> dict[str, int | str]:
    if not path.is_file():
        raise ValidationError("Backup file unavailable")
    size = path.stat().st_size
    if size <= 0:
        raise ValidationError("Backup file is empty")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(CHUNK), b""):
            digest.update(chunk)
    return {"bytes": size, "sha256": digest.hexdigest()}


def validate_member(info: zipfile.ZipInfo) -> str:
    raw = info.filename
    if not raw or "\\" in raw or "\x00" in raw:
        raise ValidationError("ZIP has unsafe member path")
    if raw.startswith("/") or re.match(r"^[a-zA-Z]:", raw):
        raise ValidationError("ZIP has absolute member path")
    parts = PurePosixPath(raw).parts
    if ".." in parts or "." in raw.split("/") or not parts:
        raise ValidationError("ZIP has traversal path")
    mode = (info.external_attr >> 16) & 0xFFFF
    if mode and stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR):
        raise ValidationError("ZIP contains a symlink or special file")
    if info.flag_bits & 1:
        raise ValidationError("ZIP contains encrypted member")
    if info.file_size > MAX_SINGLE_UNCOMPRESSED:
        raise ValidationError("ZIP has oversized member")
    if info.file_size > 0 and info.file_size / max(info.compress_size, 1) > MAX_RATIO:
        raise ValidationError("ZIP member exceeds compression ratio limit")
    return str(PurePosixPath(raw)).casefold().rstrip("/")



def uploads_relative_path(value: str, *, source_url: bool = False) -> str | None:
    """Match only full paths below uploads/, never a photo's basename alone.

    A ZIP entry like backup/wp-content/uploads/2026/11/photo.webp matches a
    WXR attachment URL ending in /uploads/2026/11/photo.webp. This is not
    proof that the attachment belongs to a particular technician.
    """
    decoded = unquote(urlsplit(value).path if source_url else value)
    if "\\" in decoded or "\x00" in decoded:
        return None
    parts = decoded.split("/")
    if any(part in (".", "..") for part in parts):
        return None
    for index, segment in enumerate(parts[:-1]):
        if segment.casefold() != "uploads":
            continue
        relative = parts[index + 1:]
        if not all(relative):
            return None
        return "/".join(relative).casefold()
    return None

def inspect_zip(path: Path) -> tuple[dict[str, int | str], Counter[str]]:
    result = file_checksum(path)
    names: set[str] = set()
    media_keys: Counter[str] = Counter()
    total = 0
    files = 0
    try:
        with zipfile.ZipFile(path, "r") as archive:
            entries = archive.infolist()
            if not entries or len(entries) > MAX_ZIP_MEMBERS:
                raise ValidationError("ZIP empty or contains too many entries")
            for info in entries:
                normalized = validate_member(info)
                if normalized in names:
                    raise ValidationError("ZIP contains duplicate case-insensitive member path")
                names.add(normalized)
                if info.is_dir():
                    continue
                total += info.file_size
                files += 1
                if total > MAX_TOTAL_UNCOMPRESSED:
                    raise ValidationError("ZIP exceeds maximum uncompressed size")
                media_keys["basename:" + PurePosixPath(normalized).name] += 1
                relative = uploads_relative_path(info.filename)
                if relative:
                    media_keys["uploads:" + relative] += 1
                # Read through EOF: ZipExtFile validates CRC, without extraction.
                with archive.open(info) as member:
                    for _chunk in iter(lambda: member.read(CHUNK), b""):
                        pass
    except (zipfile.BadZipFile, EOFError, RuntimeError, OSError) as exc:
        raise ValidationError("ZIP failed checksum, CRC or structural validation") from exc
    result.update({"entries": len(entries), "files": files, "uncompressed_bytes": total, "crc_check": "pass"})
    return result, media_keys


def ensure_xml_no_entities(path: Path) -> None:
    # Scan chunks to catch declarations beyond the first buffer. No XML entities
    # or DTDs are needed in a standard WordPress WXR export.
    carry = b""
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(CHUNK), b""):
            value = (carry + chunk).lower()
            if b"<!doctype" in value or b"<!entity" in value:
                raise ValidationError("XML DTD/entity declarations are prohibited")
            carry = value[-16:]


def inspect_wxr(path: Path, media_keys: Counter[str]) -> dict[str, int | str]:
    result = file_checksum(path)
    ensure_xml_no_entities(path)
    items = 0
    attachments = 0
    ids: set[str] = set()
    name_matched = 0
    name_ambiguous = 0
    upload_path_matched = 0
    upload_path_ambiguous = 0
    missing_attachment_urls = 0
    try:
        for _event, el in ET.iterparse(path, events=("end",)):
            if el.tag != "item":
                continue
            items += 1
            fields = {child.tag.rsplit("}", 1)[-1]: (child.text or "").strip() for child in el}
            if fields.get("post_type") == "attachment":
                attachments += 1
                uid = fields.get("post_id", "")
                if not uid.isdigit() or uid in ids:
                    raise ValidationError("WXR attachment has missing or duplicate post ID")
                ids.add(uid)
                url = fields.get("attachment_url", "")
                if not url:
                    missing_attachment_urls += 1
                else:
                    basename = PurePosixPath(unquote(urlsplit(url).path)).name.casefold()
                    candidates = media_keys.get("basename:" + basename, 0)
                    name_matched += int(candidates > 0)
                    name_ambiguous += int(candidates > 1)
                    relative = uploads_relative_path(url, source_url=True)
                    exact_candidates = media_keys.get("uploads:" + relative, 0) if relative else 0
                    upload_path_matched += int(exact_candidates == 1)
                    upload_path_ambiguous += int(exact_candidates > 1)
            el.clear()
    except ET.ParseError as exc:
        raise ValidationError("WordPress XML failed parsing") from exc
    if items == 0:
        raise ValidationError("WordPress XML contains no items")
    result.update({
        "items": items,
        "attachment_items": attachments,
        "attachment_urls_absent": missing_attachment_urls,
        "possible_zip_basename_matches": name_matched,
        "ambiguous_basename_matches": name_ambiguous,
        "possible_zip_exact_upload_path_matches": upload_path_matched,
        "ambiguous_upload_path_matches": upload_path_ambiguous,
        "zip_path_matches_are_identity_proof": False,
        "basename_matches_are_identity_proof": False,
    })
    return result


def audit_backup_set(xml: Path, media: Path, sql: Path) -> dict:
    zip_result, media_keys = inspect_zip(media)
    return {
        "media_zip": zip_result,
        "wordpress_xml": inspect_wxr(xml, media_keys),
        "old_sql_dump": {**file_checksum(sql), "sql_executed": False},
        "backup_integrity": "pass",
        "restore_verified": False,
        "identity_mapping_verified": False,
        "cutover_approved": False,
        "next_gate": "Restore a representative sample in an isolated environment; verify images by original WP ID and permissions",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wxr", required=True, type=Path, help="Original WordPress export XML")
    parser.add_argument("--media", required=True, type=Path, help="Original WordPress media ZIP")
    parser.add_argument("--sql", required=True, type=Path, help="Original WordPress SQL dump; only hashes, never executes")
    args = parser.parse_args(argv)
    try:
        report = audit_backup_set(args.wxr, args.media, args.sql)
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    except (ValidationError, PermissionError) as exc:
        print(json.dumps({"backup_integrity": "fail", "reason": str(exc), "cutover_approved": False}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
