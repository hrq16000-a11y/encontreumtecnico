import { createFileRoute, redirect } from "@tanstack/react-router";
import { mapLegacyGallerySearch } from "../lib/legacy-navigation";

/** Ponte de navegação da versão TanStack anterior: /galeria?q=notebook&city=Curitiba */
export const Route = createFileRoute("/galeria")({
  validateSearch: (search) => ({
    q: typeof search.q === "string" ? search.q : "",
    city: typeof search.city === "string" ? search.city : "",
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/tecnicos",
      search: mapLegacyGallerySearch(search),
      statusCode: 302,
    });
  },
});
