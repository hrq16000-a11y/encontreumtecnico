import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const candidate = read('src/routes/tecnico.$slug.tsx');
const employer = read('src/routes/cliente.$slug.tsx');
const sql = read('ops/cutover/prepared-route-juciane-4415.sql');
const images = read('src/lib/legacy-avatar-urls.ts');

describe('URL histórica: 404 verdadeiro, sem dados privados', () => {
  it('emite notFound no loader dos dois tipos de perfil quando o registro é ausente', () => {
    for (const route of [candidate, employer]) {
      expect(route).toContain('import { createFileRoute, notFound }');
      expect(route).toContain('if (!reference) throw notFound()');
      expect(route).toContain('noindex, nofollow');
      expect(route).not.toContain('contact_email');
      expect(route).not.toContain('contact_phone');
    }
    expect(candidate).toContain('kind: "candidate"');
    expect(employer).toContain('kind: "employer"');
  });
  it('prepara somente um slug publicado e não demonstrativo para revisão do operador', () => {
    expect(sql).toContain('PREPARED OPERATOR ACTION');
    expect(sql).toContain("slug = 'juciane-machado'");
    expect(sql).toContain('wp_post_id = 4415');
    expect(sql).toContain("source_key = 'wordpress_20261108'");
    expect(sql).toContain('demo_candidate IS FALSE');
    expect(sql).toContain("source_status = 'publish'");
    expect(sql).toContain("review_status = 'pending_review'");
    expect(sql).toContain("'em_validacao'");
    expect(sql).not.toMatch(/\b(contact_email|contact_phone|password|user_id)\b/);
    expect(sql).not.toContain("status = 'aprovado'");
    expect(sql).not.toContain('DELETE FROM');
    expect(sql).toContain('no changes applied');
  });
  it('não inventa fotos por nome ou por ID vizinho', () => {
    expect(images).toContain('transferredAvatars');
    expect(images).toContain('return transferredAvatars[wordpressPostId]');
    expect(images).not.toContain('wordpress/wp-content/uploads');
  });
});
