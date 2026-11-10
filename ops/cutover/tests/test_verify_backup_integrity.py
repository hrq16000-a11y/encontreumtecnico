import importlib.util
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "verify_backup_integrity.py"
spec = importlib.util.spec_from_file_location("verify_backup_integrity", SOURCE)
assert spec and spec.loader
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)

WXR = b'''<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:wp="http://wordpress.org/export/1.2/"><channel>
<item><wp:post_type>attachment</wp:post_type><wp:post_id>530</wp:post_id>
<wp:attachment_url>https://example.org/wp-content/uploads/avatar.webp</wp:attachment_url></item>
<item><wp:post_type>post</wp:post_type><wp:post_id>531</wp:post_id></item>
</channel></rss>'''


class OfflineBackupAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.xml = self.root / "export.xml"
        self.sql = self.root / "dump.sql"
        self.media = self.root / "uploads.zip"
        self.xml.write_bytes(WXR)
        self.sql.write_bytes(b"-- local fake dump\nCREATE TABLE demo (id int);\n")
        self.write_zip([("uploads/avatar.webp", b"safe image placeholder")])

    def tearDown(self):
        self.temp.cleanup()

    def write_zip(self, members):
        with zipfile.ZipFile(self.media, "w", compression=zipfile.ZIP_DEFLATED) as file:
            for path, data in members:
                file.writestr(path, data)

    def test_good_archives_still_require_isolated_restore(self):
        result = checker.audit_backup_set(self.xml, self.media, self.sql)
        self.assertEqual(result["media_zip"]["crc_check"], "pass")
        self.assertEqual(result["wordpress_xml"]["items"], 2)
        self.assertEqual(result["wordpress_xml"]["attachment_items"], 1)
        self.assertEqual(result["wordpress_xml"]["possible_zip_basename_matches"], 1)
        self.assertFalse(result["restore_verified"])
        self.assertFalse(result["cutover_approved"])
        self.assertFalse(result["old_sql_dump"]["sql_executed"])
        self.assertEqual(len(result["media_zip"]["sha256"]), 64)

    def test_rejects_path_traversal(self):
        self.write_zip([("../secrets.txt", b"x")])
        with self.assertRaises(checker.ValidationError):
            checker.inspect_zip(self.media)

    def test_rejects_case_insensitive_duplicate(self):
        self.write_zip([("A/photo.jpg", b"x"), ("a/PHOTO.JPG", b"y")])
        with self.assertRaises(checker.ValidationError):
            checker.inspect_zip(self.media)

    def test_rejects_zip_symlink(self):
        link = zipfile.ZipInfo("link")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        self.write_zip([(link, b"target")])
        with self.assertRaises(checker.ValidationError):
            checker.inspect_zip(self.media)

    def test_rejects_zip_bomb_ratio(self):
        self.write_zip([("oversized.txt", b"0" * (2 * 1024 * 1024))])
        with self.assertRaises(checker.ValidationError):
            checker.inspect_zip(self.media)

    def test_rejects_bad_zip_crc(self):
        self.media.write_bytes(b"not a zip")
        with self.assertRaises(checker.ValidationError):
            checker.inspect_zip(self.media)

    def test_rejects_xml_doctype(self):
        self.xml.write_bytes(b'<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "private">]><rss><item/></rss>')
        with self.assertRaises(checker.ValidationError):
            checker.inspect_wxr(self.xml, {})

    def test_rejects_xml_duplicate_attachment_id(self):
        self.xml.write_bytes(WXR.replace(b"</channel>", WXR[WXR.index(b"<item>"):WXR.index(b"</item>") + 7] + b"</channel>"))
        with self.assertRaises(checker.ValidationError):
            checker.inspect_wxr(self.xml, {})


if __name__ == "__main__":
    unittest.main()
