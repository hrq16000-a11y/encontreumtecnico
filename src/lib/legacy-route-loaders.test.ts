import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ getLegacyRouteReference: vi.fn() }));
vi.mock('@/lib/legacy-route.functions', () => ({
  getLegacyRouteReference: mock.getLegacyRouteReference,
}));

import { Route as TechnicianRoute } from '../routes/tecnico.$slug';
import { Route as EmployerRoute } from '../routes/cliente.$slug';

type Loader = (arg: { params: { slug: string } }) => Promise<unknown>;
const technicianLoader = TechnicianRoute.options.loader as unknown as Loader;
const employerLoader = EmployerRoute.options.loader as unknown as Loader;

beforeEach(() => mock.getLegacyRouteReference.mockReset());

describe('loader de rotas históricas — proteção e HTTP 404', () => {
  it('preserva a referência validada sem aprovar conta nem expor contato', async () => {
    const reference = {
      kind: 'candidate',
      slug: 'teste-historico',
      wp_post_id: 123,
      display_name: 'Perfil histórico de teste',
      status: 'em_validacao',
    };
    mock.getLegacyRouteReference.mockResolvedValue(reference);
    await expect(technicianLoader({ params: { slug: reference.slug } })).resolves.toEqual(reference);
    expect(mock.getLegacyRouteReference).toHaveBeenCalledWith({
      data: { kind: 'candidate', slug: 'teste-historico' },
    });
  });

  it('lança o erro notFound para técnico ausente', async () => {
    mock.getLegacyRouteReference.mockResolvedValue(null);
    await expect(technicianLoader({ params: { slug: 'nao-existe' } }))
      .rejects.toMatchObject({ isNotFound: true });
  });

  it('lança o mesmo erro para contratante ausente', async () => {
    mock.getLegacyRouteReference.mockResolvedValue(null);
    await expect(employerLoader({ params: { slug: 'nao-existe' } }))
      .rejects.toMatchObject({ isNotFound: true });
    expect(mock.getLegacyRouteReference).toHaveBeenCalledWith({
      data: { kind: 'employer', slug: 'nao-existe' },
    });
  });
});
