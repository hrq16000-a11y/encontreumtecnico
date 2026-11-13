#!/usr/bin/env python3
"""Offline, review-only join of normalized WP contacts and private media IDs.

Inputs MUST be private exports from an isolated WordPress backup restore. This
program neither reads SQL nor certifies provenance, identity, WhatsApp service,
image ownership, eligibility or publication. Nothing is sent over the network.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from verify_backup_integrity import ValidationError

MAX_ROWS = 100_000
TIME_WINDOW_SECONDS = 24 * 3600


def read_rows(path: Path, required: set[str]) -> list[dict[str, str]]:
    if not path.is_file():
        raise ValidationError("Private normalized CSV unavailable")
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            if not reader.fieldnames or not required.issubset(reader.fieldnames):
                raise ValidationError("Normalized CSV lacks required columns")
            rows = []
            for row in reader:
                if len(rows) >= MAX_ROWS:
                    raise ValidationError("Normalized CSV exceeds review-only limit")
                if None in row or any(value is None for value in row.values()):
                    raise ValidationError("Malformed normalized CSV record")
                rows.append(row)
            return rows
    except (UnicodeError, csv.Error) as exc:
        raise ValidationError("Private normalized CSV cannot be parsed") from exc


def positive_id(value: str | int | None) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    value = str(value).strip()
    if not value.isdecimal() or int(value) <= 0:
        raise ValidationError("Normalized WordPress ID is invalid")
    return int(value)


def plausible_phone(value: str) -> str | None:
    """Return only an in-memory comparison key; format is NOT WhatsApp proof."""
    value = value.strip()
    if not value or not re.fullmatch(r"[+0-9()\s./-]+", value):
        return None
    digits = re.sub(r"\D", "", value)
    if digits.startswith("55") and len(digits) in (12, 13):
        digits = digits[2:]
    if len(digits) not in (10, 11) or "0" in digits[:2]:
        return None
    if not any(ch != "0" for ch in digits[2:]):
        return None
    return digits


def optional_flag(value: str | None) -> bool:
    value = (value or "").strip().lower()
    if value in ("", "0", "false", "no", "nao", "não"):
        return False
    if value in ("1", "true", "yes", "sim"):
        return True
    raise ValidationError("Normalized administrative flag is invalid")


def optional_time(value: str | None) -> datetime | None:
    value = (value or "").strip()
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError("Normalized timestamp is invalid") from exc


def load_media(path: Path) -> list[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValidationError("Private media manifest unavailable or invalid") from exc
    if not isinstance(data, dict) or data.get("type") != "PRIVATE_EUT_REVIEW_ONLY" or not isinstance(data.get("entries"), list):
        raise ValidationError("Not a private review-only media manifest")
    entries = []
    seen_ids: set[int] = set()
    for entry in data["entries"]:
        if not isinstance(entry, dict) or entry.get("approved_for_publication") is not False:
            raise ValidationError("Media candidate must remain unapproved")
        attachment_id = positive_id(entry.get("wp_attachment_id"))
        if not attachment_id or attachment_id in seen_ids:
            raise ValidationError("Duplicate or missing media attachment ID")
        seen_ids.add(attachment_id)
        entries.append({
            "id": attachment_id,
            "parent": positive_id(entry.get("wp_parent_post_id")),
        })
    return entries


def reconcile(technicians_csv: Path, media_json: Path,
              attachments_csv: Path | None = None) -> dict:
    profiles = read_rows(technicians_csv, {"wp_post_id", "phone"})
    media = load_media(media_json)
    upload_meta: dict[int, tuple[int | None, datetime | None]] = {}
    if attachments_csv is not None:
        for row in read_rows(attachments_csv, {"wp_attachment_id", "wp_author_user_id", "uploaded_at"}):
            attachment_id = positive_id(row["wp_attachment_id"])
            if attachment_id is None or attachment_id in upload_meta:
                raise ValidationError("Duplicate or missing attachment metadata ID")
            upload_meta[attachment_id] = (
                positive_id(row["wp_author_user_id"]), optional_time(row["uploaded_at"])
            )

    seen_posts: set[int] = set()
    parsed = []
    phones: Counter[str] = Counter()
    for row in profiles:
        post_id = positive_id(row["wp_post_id"])
        if post_id is None or post_id in seen_posts:
            raise ValidationError("Duplicate or missing technician WordPress ID")
        seen_posts.add(post_id)
        key = plausible_phone(row["phone"])
        if key:
            phones[key] += 1
        parsed.append((
            post_id, positive_id(row.get("wp_user_id")), positive_id(row.get("avatar_attachment_id")),
            optional_time(row.get("created_at")), optional_flag(row.get("blocked")),
            optional_flag(row.get("disabled")), key, bool(row["phone"].strip())
        ))

    by_id: dict[int, list[dict]] = defaultdict(list)
    by_parent: dict[int, list[dict]] = defaultdict(list)
    for image in media:
        by_id[image["id"]].append(image)
        if image["parent"] is not None:
            by_parent[image["parent"]].append(image)

    counts: Counter[str] = Counter()
    private_entries = []
    for post_id, user_id, direct_id, created_at, blocked, disabled, phone, has_phone in parsed:
        if not has_phone:
            status = "absent"
        elif phone is None:
            status = "invalid_format"
        elif phones[phone] > 1:
            status = "duplicate"
        else:
            status = "plausible_format"
        counts["phone_" + status] += 1
        counts["explicitly_blocked"] += int(blocked)
        counts["explicitly_disabled"] += int(disabled)
        review_candidate = status == "plausible_format" and not blocked and not disabled
        counts["catalog_review_candidates"] += int(review_candidate)

        candidates = []
        issue = None
        if direct_id is not None:
            matching = by_id.get(direct_id, [])
            conflicting = [m for m in matching if m["parent"] not in (None, post_id)]
            if conflicting:
                issue = "explicit_attachment_parent_conflict"
            elif matching:
                candidates = [{"wp_attachment_id": direct_id, "method": "explicit_attachment_id"}]
            else:
                issue = "explicit_attachment_not_in_manifest"
        if direct_id is None:
            candidates = [{"wp_attachment_id": m["id"], "method": "matching_post_parent"}
                          for m in by_parent.get(post_id, [])]

        # Time alone never associates a picture. Require the SAME explicit WP
        # author ID, with comparable timestamps, to propose manual review.
        if not candidates and issue is None and user_id is not None and created_at is not None:
            for image in media:
                author, uploaded = upload_meta.get(image["id"], (None, None))
                if author != user_id or uploaded is None:
                    continue
                try:
                    seconds = abs((uploaded - created_at).total_seconds())
                except TypeError:
                    continue  # Mixed timezone conventions are incomparable.
                if seconds <= TIME_WINDOW_SECONDS:
                    candidates.append({
                        "wp_attachment_id": image["id"], "method": "same_author_near_timestamp_review"
                    })
        candidates.sort(key=lambda x: (x["method"], x["wp_attachment_id"]))
        counts["photo_candidate_profiles"] += int(bool(candidates))
        counts["photo_ambiguous_profiles"] += int(len(candidates) > 1)
        counts["photo_conflicts"] += int(issue is not None)
        private_entries.append({
            "wp_post_id": post_id,
            "phone_format_status": status,
            "explicitly_blocked": blocked,
            "explicitly_disabled": disabled,
            "catalog_review_candidate": review_candidate,
            "photo_candidate_ids": candidates,
            "photo_issue": issue,
            "image_owner_verified": False,
            "approved_for_publication": False,
            "requires_private_source_audit": True,
        })

    return {
        "type": "PRIVATE_EUT_REVIEW_ONLY",
        "summary": {"technicians": len(parsed), "media_manifest_items": len(media),
                    "duplicate_phone_groups": sum(n > 1 for n in phones.values()), **counts},
        "entries": private_entries,
        "phones_exported": False,
        "identity_verified": False,
        "source_provenance_verified": False,
        "approved_for_import": False,
        "approved_for_publication": False,
    }


def write_private_report(technicians_csv: Path, media_json: Path,
                         attachments_csv: Path | None, output: Path) -> dict:
    output = output.expanduser().resolve()
    repository = Path(__file__).resolve().parents[2]
    for input_path in (technicians_csv, media_json, attachments_csv):
        if input_path is None:
            continue
        private_input = input_path.expanduser().resolve()
        if private_input == repository or repository in private_input.parents:
            raise ValidationError("Private source inputs must be outside the Git repository")
    if output == repository or repository in output.parents:
        raise ValidationError("Private report must be outside the Git repository")
    if not output.parent.is_dir():
        raise ValidationError("Private output directory does not exist")
    report = reconcile(technicians_csv, media_json, attachments_csv)
    try:
        fd = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ValidationError("Private report exists; refusing overwrite") from exc
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
    except BaseException:
        output.unlink(missing_ok=True)
        raise
    return report["summary"]


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--technicians-csv", required=True, type=Path)
    p.add_argument("--media-manifest", required=True, type=Path)
    p.add_argument("--attachments-csv", type=Path)
    p.add_argument("--private-out", required=True, type=Path)
    args = p.parse_args()
    try:
        summary = write_private_report(
            args.technicians_csv, args.media_manifest, args.attachments_csv, args.private_out
        )
        print(json.dumps({"ok": True, "counts": summary, "approved_for_import": False,
                          "approved_for_publication": False}, sort_keys=True))
        return 0
    except (ValidationError, OSError, ValueError) as exc:
        reason = str(exc) if isinstance(exc, ValidationError) else "Private input/output failure"
        print(json.dumps({"ok": False, "reason": reason, "approved_for_import": False}),
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
