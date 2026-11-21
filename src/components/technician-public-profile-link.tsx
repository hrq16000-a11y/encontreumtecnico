import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { getApprovedTechnician } from "@/lib/technicians.functions";

type Props = {
  ownerId: string;
  profileId: string;
  children: ReactNode;
};

export function TechnicianPublicProfileLink({ ownerId, profileId, children }: Props) {
  const listing = useQuery({
    queryKey: ["technician-public-link", ownerId, profileId],
    queryFn: async () => {
      // Stable database ID avoids false negatives after a public slug changes.
      const profile = await getApprovedTechnician({ data: { id: profileId } });
      return profile?.id === profileId ? profile.public_slug : null;
    },
    refetchOnMount: "always",
    retry: false,
  });

  const noticeStyle = "mt-3 text-sm text-muted-foreground";
  if (listing.isPending || listing.isFetching) {
    return <p role="status" className={noticeStyle}>Consultando a visibilidade da ficha no catálogo…</p>;
  }
  if (listing.isError) {
    return (
      <p role="status" className={noticeStyle}>
        A ficha está salva. A consulta ao catálogo está indisponível.{" "}
        <button type="button" className="font-semibold underline" onClick={() => void listing.refetch()}>
          Consultar novamente
        </button>
      </p>
    );
  }
  if (!listing.data) {
    return (
      <p role="status" className={noticeStyle}>
        A ficha está salva e ainda não aparece no catálogo público.{" "}
        <button type="button" className="font-semibold underline" onClick={() => void listing.refetch()}>
          Consultar novamente
        </button>
      </p>
    );
  }
  return (
    <Link to="/tecnicos/$tecnicoId" params={{ tecnicoId: listing.data }}
      className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      {children}
    </Link>
  );
}
