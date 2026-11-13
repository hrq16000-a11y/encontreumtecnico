/** Memory-only read fixture. No SDK instance, credentials or remote endpoint. */
const profiles = [
  {
    source_key: "wordpress_20261108", wp_post_id: 207, wp_user_id: 22,
    kind: "candidate", slug: "demo-sintetica", title: "Demonstração Sintética",
    specialty_title: "Suporte", location1: "Cidade fictícia",
    location2: null, location3: null, review_status: "excluded",
    demo_candidate: true, private_phone: "PRIVATE_SYNTHETIC_550000000099",
  },
  {
    source_key: "wordpress_20261108", wp_post_id: 301, wp_user_id: 41,
    kind: "candidate", slug: "tecnico-sintetico", title: "Técnico Sintético",
    specialty_title: "Redes", location1: "Cidade fictícia",
    location2: null, location3: null, review_status: "pending_review",
    demo_candidate: false, private_phone: "PRIVATE_SYNTHETIC_550000000088",
  },
];

const overlay = [
  { wp_post_id: 207, record_state: "excluido", corrected_name: null, admin_notes: null },
];

function from(table: string) {
  if (!["legacy_review_profiles", "eut_legacy_profile_management", "eut_legacy_employer_management"].includes(table)) {
    throw new Error("Fixture rejected unknown table " + table);
  }
  const query = {
    select: () => query,
    eq: () => query,
    ilike: () => query,
    order: () => query,
    range: async () => ({ data: profiles, count: profiles.length, error: null }),
    in: async () => ({ data: overlay, error: null }),
  };
  return query;
}

export const supabase = {
  from,
  rpc: () => { throw new Error("Fixture refuses all RPC writes"); },
};
