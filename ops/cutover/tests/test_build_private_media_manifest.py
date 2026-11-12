import importlib.util
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "build_private_media_manifest.py"
sys.path.insert(0, str(SOURCE.parent))
spec = importlib.util.spec_from_file_location("build_private_media_manifest", SOURCE)
planner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planner)

WXR = b'''<rss xmlns:wp="http://wordpress.org/export/1.2/"><channel>
<item><wp:post_type>attachment</wp:post_type><wp:post_id>530</wp:post_id>
<wp:post_parent>4402</wp:post_parent>
<wp:attachment_url>https://example.org/wp-content/uploads/2026/11/avatar.webp</wp:attachment_url>
</item></channel></rss>'''


class PrivateMediaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.xml = self.root / "original.xml"
        self.zip = self.root / "photos.zip"
        self.out = self.root / "private.json"
        self.xml.write_bytes(WXR)
        self.make_zip([("wp-content/uploads/2026/11/avatar.webp", b"fake image")])

    def tearDown(self):
        self.temp.cleanup()

    def make_zip(self, files):
        with zipfile.ZipFile(self.zip, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for name, data in files:
                z.writestr(name, data)

    def test_exact_path_produces_private_unapproved_candidate(self):
        summary = planner.write_manifest(self.xml, self.zip, self.out)
        data = json.loads(self.out.read_text())
        self.assertEqual(summary["unique_path_candidates"], 1)
        self.assertEqual(data["entries"][0]["wp_attachment_id"], 530)
        self.assertEqual(data["entries"][0]["wp_parent_post_id"], 4402)
        self.assertFalse(data["entries"][0]["approved_for_publication"])
        self.assertFalse(summary["cutover_approved"])
        self.assertNotIn("example.org", self.out.read_text())

    def test_same_name_wrong_date_does_not_match(self):
        self.make_zip([("uploads/2025/10/avatar.webp", b"wrong")])
        self.assertEqual(planner.build_manifest(self.xml, self.zip)["unique_path_candidates"], 0)

    def test_ambiguous_paths_not_selected(self):
        self.make_zip([
            ("one/uploads/2026/11/avatar.webp", b"a"),
            ("two/uploads/2026/11/avatar.webp", b"b"),
        ])
        result = planner.build_manifest(self.xml, self.zip)
        self.assertEqual(result["ambiguous"], 1)
        self.assertEqual(result["unique_path_candidates"], 0)

    def test_never_overwrite_output(self):
        self.out.write_text("private")
        with self.assertRaises(planner.ValidationError):
            planner.write_manifest(self.xml, self.zip, self.out)
        self.assertEqual(self.out.read_text(), "private")

    def test_block_output_inside_repository(self):
        forbidden = Path(__file__).resolve().parents[2] / "private.json"
        with self.assertRaises(planner.ValidationError):
            planner.write_manifest(self.xml, self.zip, forbidden)

    def test_bad_zip_rejected_without_output(self):
        self.zip.write_bytes(b"invalid")
        with self.assertRaises(planner.ValidationError):
            planner.write_manifest(self.xml, self.zip, self.out)
        self.assertFalse(self.out.exists())
