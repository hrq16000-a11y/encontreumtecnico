# Media restore gate - Encontre um Técnico (pre-cutover)

This is a **runbook only**, not an upload, DNS change, or claim that restoration has occurred.

## Known source and destination

- WXR export `encontreumtcnicoprecisodeumtcnico.WordPress.2026-11-09 (1).xml` — 35,398,989 bytes (Library inventory).
- Media bundle `encontreumtecnico-midias-2026-11-07(1).zip` — 113,808,220 bytes (Library inventory).
- Old database dump `encontre_wp_aishs.sql` — 98,201,630 bytes (Library inventory).
- New schema private `eut_migration.legacy_directory`: 655 records at last read.
- New index `public.eut_legacy_url_routes`: 615 public historical paths at last read.
- Cloudinary `encontreumtecnico/legacy/`: exactly **1 item** observed, `wp-candidate-530.webp` (96x96, 1070 bytes). The existing allowlist references it.
- Internal comment mentions **16 other verified originals not yet transferred**.
- Supabase storage: no objects returned by last count. This is NOT proof that backup images have been restored.

## Hard stop: original archive bytes not currently accessible

The Files connector lists all three archives, but materialization to an authorized raw-byte path failed.
Until bytes are accessible, no SHA-256 checksum, ZIP integrity test, safe extraction, WXR-to-media mapping or test restore can be honestly marked as passed.
Never assume the current WordPress's `wp-content/uploads` assets remain available after the domain points to Vercel.

## Offline restoration process for an authorized operator

1. Obtain raw archive copies outside the public Git repository and store in private restricted storage.
2. Record archive SHA-256 and byte sizes. Repeat checksums before and after transfer.
3. Test ZIP directory and CRC (`unzip -t`), reject path traversal (`../`, absolute names, symlinks) and decompression bombs before extraction; inspect media formats by MIME/content, not extension.
4. Build an ID-based mapping from legacy `wp_post_id` to WXR attachment IDs, referenced media paths and local image bytes; mark unresolved assets as missing.
5. For each image, confirm original source and consent for public reuse; avoid leaking metadata/EXIF, private profile photos or anything copied from a different person's profile.
6. Upload verified media to the independently hosted Cloudinary folder `encontreumtecnico/legacy` or another stable media storage, using original WordPress ID in controlled public_id. Save remote public ID, content hash, dimensions, status.
7. Add only checked IDs to `src/lib/legacy-avatar-urls.ts` after direct preview verification and successful rebuild. Never derive filenames or photos from names or neighboring IDs.
8. Validate the URL from the Vercel production domain with the WordPress domain NOT used as image host. Compare at least 10 distinct profiles and inspect a full resolution sample.
9. Keep backup and rollback independently accessible; never delete old hosting while unknown media references remain.

## Release criteria

- Zero contacts or login secrets exposed; historical archive always `noindex` pending review.
- 20 demo candidates stay blocked.
- The one missing non-demo public candidate URL has an exactly verified, status `em_validacao` mapping.
- For unknown /tecnico/slug and /cliente/slug, SSR returns real HTTP 404 and friendly branded 404 page (no 200 soft-404).
- A user-approved DNS window and verified rollback plan are separate later actions.

## Automated offline integrity verifier (not a restoration)

On a private workstation with the **original** archives available, run:

```bash
python3 ops/cutover/verify_backup_integrity.py \
  --wxr '/private/backups/wordpress-export.xml' \
  --media '/private/backups/wordpress-media.zip' \
  --sql '/private/backups/wordpress-database.sql'
```

The command reads only local bytes and reports SHA-256 and sizes for all three
files, verifies ZIP member paths and CRC without extracting, rejects obvious
ZIP bombs/symlinks/duplicate names, counts WordPress WXR attachment IDs and
potential *basename-only* ZIP matches. It NEVER prints file contents or names
from WordPress or SQL, executes SQL, uploads media, modifies DNS or changes
the database. Run only on a trusted machine; never attach SQL to public CI.

**A successful integrity check is not a restore test**, does not prove that a
basename match is the right person's photo, and does not approve cutover.
A controlled isolated restore, ID-level mapping and privacy checks remain required.


## Matching original images without false associations

The verifier now reports both **weak basename coincidences** and **stronger exact
uploads-relative-path matches** (for example `2026/11/avatar.webp`). Two
different technicians may have a photo with the same basename. Therefore
`possible_zip_basename_matches` must never trigger automatic publication.
Even `possible_zip_exact_upload_path_matches` is **not proof of who owns the
image**: it only prioritizes which originals need manual ID-level review.
No archive member name, image, client information or attachment URL is printed
in the aggregate JSON output. The actual restoration is a separate step.
