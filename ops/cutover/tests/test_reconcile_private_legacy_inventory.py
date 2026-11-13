import csv
import json
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "reconcile_private_legacy_inventory.py"
sys.path.insert(0, str(SOURCE.parent))
from reconcile_private_legacy_inventory import (  # noqa: E402
    ValidationError, reconcile, write_private_report,
)


class PrivateLegacyReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.technicians = self.root / "normalized-technicians.csv"
        self.attachments = self.root / "normalized-attachments.csv"
        self.media = self.root / "private-media.json"
        self.output = self.root / "private-reconciliation.json"
        self.write_profiles([{
            "wp_post_id": "101", "wp_user_id": "41",
            "phone": "+55 (41) 98765-4321", "created_at": "2026-11-08 10:00:00",
            "avatar_attachment_id": "700", "blocked": "0", "disabled": "0",
        }])
        self.write_media([{"wp_attachment_id": 700, "wp_parent_post_id": 101}])

    def tearDown(self):
        self.temp.cleanup()

    def write_csv(self, path, columns, rows):
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns)
            writer.writeheader()
            writer.writerows(rows)

    def write_profiles(self, rows):
        self.write_csv(self.technicians, [
            "wp_post_id", "wp_user_id", "phone", "created_at",
            "avatar_attachment_id", "blocked", "disabled",
        ], rows)

    def write_attachments(self, rows):
        self.write_csv(self.attachments, [
            "wp_attachment_id", "wp_author_user_id", "uploaded_at",
        ], rows)

    def write_media(self, rows):
        self.media.write_text(json.dumps({
            "type": "PRIVATE_EUT_REVIEW_ONLY",
            "entries": [{"approved_for_publication": False, **row} for row in rows],
        }), encoding="utf-8")

    def test_explicit_wp_ids_create_unapproved_candidate_without_phone_leak(self):
        counts = write_private_report(self.technicians, self.media, None, self.output)
        data = json.loads(self.output.read_text())
        self.assertEqual(counts["catalog_review_candidates"], 1)
        self.assertEqual(data["entries"][0]["photo_candidate_ids"], [
            {"wp_attachment_id": 700, "method": "explicit_attachment_id"}
        ])
        self.assertFalse(data["approved_for_import"])
        self.assertFalse(data["entries"][0]["image_owner_verified"])
        self.assertNotIn("98765", self.output.read_text())
        self.assertNotIn("+55", self.output.read_text())
        if os.name == "posix":
            self.assertEqual(stat.S_IMODE(self.output.stat().st_mode), 0o600)

    def test_duplicate_phone_is_not_a_catalog_candidate(self):
        self.write_profiles([
            {"wp_post_id": "101", "phone": "+55 (41) 98765-4321"},
            {"wp_post_id": "102", "phone": "41987654321"},
            {"wp_post_id": "103", "phone": ""},
            {"wp_post_id": "104", "phone": "not a phone"},
            {"wp_post_id": "105", "phone": "11988887777", "blocked": "yes"},
        ])
        report = reconcile(self.technicians, self.media)
        self.assertEqual(report["summary"]["duplicate_phone_groups"], 1)
        self.assertEqual(report["summary"]["phone_duplicate"], 2)
        self.assertEqual(report["summary"]["phone_absent"], 1)
        self.assertEqual(report["summary"]["phone_invalid_format"], 1)
        self.assertEqual(report["summary"]["explicitly_blocked"], 1)
        self.assertEqual(report["summary"].get("catalog_review_candidates", 0), 0)
        self.assertNotIn("41987654321", json.dumps(report))

    def test_explicit_attachment_parent_conflict_is_not_associated(self):
        self.write_media([{"wp_attachment_id": 700, "wp_parent_post_id": 777}])
        entry = reconcile(self.technicians, self.media)["entries"][0]
        self.assertEqual(entry["photo_candidate_ids"], [])
        self.assertEqual(entry["photo_issue"], "explicit_attachment_parent_conflict")

    def test_parent_id_is_candidate_without_explicit_avatar(self):
        self.write_profiles([{"wp_post_id": "101", "phone": "41987654321"}])
        entry = reconcile(self.technicians, self.media)["entries"][0]
        self.assertEqual(entry["photo_candidate_ids"], [
            {"wp_attachment_id": 700, "method": "matching_post_parent"}
        ])
        self.assertFalse(entry["approved_for_publication"])

    def test_unattached_wordpress_media_parent_zero_is_not_identity_link(self):
        self.write_profiles([{"wp_post_id": "101", "phone": "41987654321"}])
        self.write_media([{"wp_attachment_id": 700, "wp_parent_post_id": 0}])
        report = reconcile(self.technicians, self.media)
        self.assertEqual(report["summary"]["media_manifest_items"], 1)
        self.assertEqual(report["summary"]["photo_candidate_profiles"], 0)
        self.assertEqual(report["entries"][0]["photo_candidate_ids"], [])
        self.assertFalse(report["approved_for_publication"])

    def test_timestamp_requires_same_wp_author_and_remains_review_only(self):
        self.write_profiles([{
            "wp_post_id": "101", "wp_user_id": "41", "phone": "41987654321",
            "created_at": "2026-11-08 10:00:00",
        }])
        self.write_media([{"wp_attachment_id": 700, "wp_parent_post_id": 999}])
        self.write_attachments([{
            "wp_attachment_id": "700", "wp_author_user_id": "41",
            "uploaded_at": "2026-11-08 10:30:00",
        }])
        entry = reconcile(self.technicians, self.media, self.attachments)["entries"][0]
        self.assertEqual(entry["photo_candidate_ids"], [
            {"wp_attachment_id": 700, "method": "same_author_near_timestamp_review"}
        ])
        self.write_attachments([{
            "wp_attachment_id": "700", "wp_author_user_id": "42",
            "uploaded_at": "2026-11-08 10:30:00",
        }])
        entry = reconcile(self.technicians, self.media, self.attachments)["entries"][0]
        self.assertEqual(entry["photo_candidate_ids"], [])

    def test_unknown_timezones_cannot_be_correlated(self):
        self.write_profiles([{
            "wp_post_id": "101", "wp_user_id": "41", "phone": "41987654321",
            "created_at": "2026-11-08 10:00:00",
        }])
        self.write_media([{"wp_attachment_id": 700, "wp_parent_post_id": 999}])
        self.write_attachments([{
            "wp_attachment_id": "700", "wp_author_user_id": "41",
            "uploaded_at": "2026-11-08T10:30:00Z",
        }])
        entry = reconcile(self.technicians, self.media, self.attachments)["entries"][0]
        self.assertEqual(entry["photo_candidate_ids"], [])

    def test_refuses_overwrite_and_output_inside_git(self):
        self.output.write_text("keep")
        with self.assertRaises(ValidationError):
            write_private_report(self.technicians, self.media, None, self.output)
        self.assertEqual(self.output.read_text(), "keep")
        forbidden = SOURCE.parents[2] / "private-reconciliation.json"
        with self.assertRaises(ValidationError):
            write_private_report(self.technicians, self.media, None, forbidden)
        with self.assertRaises(ValidationError):
            write_private_report(SOURCE, self.media, None, self.root / "other-private.json")

    def test_rejects_malformed_sources(self):
        self.write_profiles([
            {"wp_post_id": "101", "phone": "41987654321"},
            {"wp_post_id": "101", "phone": "41988887777"},
        ])
        with self.assertRaises(ValidationError):
            reconcile(self.technicians, self.media)
        self.write_media([
            {"wp_attachment_id": 700, "wp_parent_post_id": 101},
            {"wp_attachment_id": 700, "wp_parent_post_id": 102},
        ])
        with self.assertRaises(ValidationError):
            reconcile(self.technicians, self.media)
        self.write_profiles([{"wp_post_id": "101", "phone": "41987654321"}])
        self.write_media([{"wp_attachment_id": 700, "wp_parent_post_id": 101,
                           "approved_for_publication": True}])
        with self.assertRaises(ValidationError):
            reconcile(self.technicians, self.media)


if __name__ == "__main__":
    unittest.main()
