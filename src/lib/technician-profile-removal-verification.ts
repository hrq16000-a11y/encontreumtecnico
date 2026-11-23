/** A resposta da RPC não basta: confirme a própria ficha no catálogo canônico. */
export function technicianProfileWasRemoved(
  profileId: string,
  snapshot: {
    id: string;
    status: string;
    display_name: string;
    city: string;
    bio: string | null;
    avatar_path: string | null;
    specialties: string[];
    service_slugs: string[];
  } | null,
): boolean {
  return Boolean(
    snapshot &&
    snapshot.id === profileId &&
    snapshot.status === "pendente" &&
    snapshot.display_name === "Ficha excluída" &&
    snapshot.city === "Não informado" &&
    snapshot.bio === null &&
    snapshot.avatar_path === null &&
    Array.isArray(snapshot.specialties) &&
    snapshot.specialties.length === 0 &&
    Array.isArray(snapshot.service_slugs) &&
    snapshot.service_slugs.length === 0,
  );
}
