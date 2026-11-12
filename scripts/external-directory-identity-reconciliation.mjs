/**
 * Isolated reconciliation preview. This is NOT the registry and creates no IDs,
 * accounts, data or database writes. Approved bindings are hypothetical inputs
 * supplied by an authorized review process, not proof of ownership.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WP_NAMESPACE = /^[a-z0-9_]{3,80}$/;
const VALID_CLAIMS = new Set(["pendente", "em_analise", "rejeitado", "vinculado"]);

function uuid(value) {
  if (typeof value !== "string" || !UUID.test(value)) throw Error("UUID inválido");
  return value.toLowerCase();
}
function slug(value) {
  if (typeof value !== "string" || !SLUG.test(value) || value.length > 96) {
    throw Error("Slug não confirmado");
  }
  return value;
}
function unique(set, key) {
  if (set.has(key)) throw Error("Alias ou perfil duplicado na entrada");
  set.add(key);
}
function wpKey(row) {
  if (!row || !WP_NAMESPACE.test(row.source_key) ||
      !["candidate", "employer"].includes(row.kind) ||
      !Number.isSafeInteger(row.wp_post_id) || row.wp_post_id < 1) {
    throw Error("Referência WordPress inválida");
  }
  return `wordpress:${row.source_key}:${row.kind}:${row.wp_post_id}`;
}

/**
 * Contracts only; no lookup and no I/O.
 *
 * Organic: {id,public_slug,status}; WordPress: {source_key,kind,wp_post_id,
 * slug,status,claim_status?}; externalPreviews: outputs of the quarantined
 * source preview; serviceRequestLinks: {id,technician_id?}.
 * reviewedBindings: {wp_alias_key,existing_technician_id,approved:true,
 * evidence_ref}. No binding can be inferred from names or claim_status.
 */
export function previewIdentityReconciliation({
  organic = [], wordpress = [], externalPreviews = [],
  serviceRequestLinks = [], reviewedBindings = [],
} = {}) {
  const organicIds = new Set(), organicSlugs = new Set();
  const organicAliases = organic.map(row => {
    const id = uuid(row?.id);
    const publicSlug = slug(row.public_slug);
    if (!["pendente", "aprovado", "rejeitado", "suspenso"].includes(row.status)) {
      throw Error("Status orgânico inválido");
    }
    unique(organicIds, id);
    unique(organicSlugs, publicSlug);
    return {
      source_record_key: `organic:technicians:${id}`,
      existing_technician_id: id,
      public_slug: publicSlug,
      canonical_path: `/tecnicos/${publicSlug}`,
      existing_uuid_path: `/tecnicos/${id}`,
      existing_uuid_redirect: row.status === "aprovado" ? 301 : null,
      existing_status: row.status,
      registry_id: null, // not a persisted registry
    };
  });

  const wpKeys = new Set();
  const wpAliases = wordpress.map(row => {
    const key = wpKey(row);
    unique(wpKeys, key);
    if (row.status !== "em_validacao" ||
        (row.claim_status !== undefined && !VALID_CLAIMS.has(row.claim_status))) {
      throw Error("Estado WordPress não homologado");
    }
    const wpSlug = slug(row.slug);
    return {
      source_record_key: key,
      kind: row.kind,
      wp_post_id: row.wp_post_id,
      historical_path: `${row.kind === "candidate" ? "/tecnico/" : "/cliente/"}${wpSlug}`,
      historical_status: "em_validacao",
      claim_status: row.claim_status ?? null,
      noindex: true,
      published: false,
      existing_technician_id: null,
      registry_id: null,
    };
  });

  const bindingKeys = new Set();
  const bindingMap = new Map();
  for (const binding of reviewedBindings) {
    if (!binding || binding.approved !== true ||
        typeof binding.wp_alias_key !== "string" ||
        typeof binding.evidence_ref !== "string" ||
        !/^[a-zA-Z0-9:_./-]{4,120}$/.test(binding.evidence_ref)) {
      throw Error("Revisão explícita obrigatória");
    }
    const existingId = uuid(binding.existing_technician_id);
    unique(bindingKeys, binding.wp_alias_key);
    if (!organicIds.has(existingId)) throw Error("Técnico destino inexistente");
    const alias = wpAliases.find(x => x.source_record_key === binding.wp_alias_key);
    if (!alias || alias.kind !== "candidate") throw Error("Alias WP inaplicável");
    bindingMap.set(binding.wp_alias_key, existingId);
  }
  const resolvedWp = wpAliases.map(row => ({
    ...row,
    existing_technician_id: bindingMap.get(row.source_record_key) ?? null,
    identity_match_status: bindingMap.has(row.source_record_key)
      ? "reviewed_binding_preview" : "not_verified",
    // Even reviewed identity does not authorize public WP publication.
    published: false,
  }));

  const externalKeys = new Set();
  const externalAliases = [];
  for (const preview of externalPreviews) {
    if (!preview || !Array.isArray(preview.records) ||
        preview.quarantined_count !== preview.records.length ||
        preview.enabled_count !== 0 || preview.published_count !== 0) {
      throw Error("Prévia externa não quarentenada");
    }
    for (const row of preview.records) {
      if (!row || row.source_kind !== "external" ||
          typeof row.source_record_key !== "string" ||
          !/^external:[a-z]+:[0-9a-f]{24}:[1-9][0-9]*$/.test(row.source_record_key) ||
          row.registry_id !== null || row.auth_user_id !== null ||
          row.enabled !== false || row.published !== false ||
          row.has_contact !== false) {
        throw Error("Alias externo inválido");
      }
      unique(externalKeys, row.source_record_key);
      externalAliases.push({
        source_record_key: row.source_record_key,
        source_kind: "external",
        source_row: row.source_row,
        quarantine: true,
        existing_technician_id: null,
        registry_id: null,
        published: false,
      });
    }
  }

  const requestKeys = new Set();
  const historicalLinks = serviceRequestLinks.map(row => {
    const requestId = uuid(row?.id);
    unique(requestKeys, requestId);
    const oldId = row.technician_id == null ? null : uuid(row.technician_id);
    return {
      service_request_id: requestId,
      original_technician_id: oldId, // preserves existing FK; does not mutate
      resolved_source_record_key: oldId && organicIds.has(oldId)
        ? `organic:technicians:${oldId}` : null,
      link_status: oldId === null ? "unassigned" :
        organicIds.has(oldId) ? "existing_fk_preserved" : "unresolved_fk_review",
      registry_id: null,
    };
  });

  return {
    organic_aliases: organicAliases,
    wordpress_aliases: resolvedWp,
    external_aliases: externalAliases,
    historical_request_links: historicalLinks,
    created_registry_ids: 0,
    created_auth_accounts: 0,
    published_external_records: 0,
  };
}


/**
 * Pure offline preview of source alias → stable technician identity.
 * It never allocates registry IDs or writes/publishes anything.
 * A name match is a review hint, not proof of a person.
 */
export function previewRegistryReconciliation(capture, {
  knownTechnicians = [], knownAliases = [],
} = {}) {
  if (!Array.isArray(knownTechnicians) || !Array.isArray(knownAliases))
    throw new TypeError("As referências de reconciliação devem ser listas");

  const normalizeLabel = value => value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const source = previewQuarantinedSourceAliases(capture);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const techniciansById = new Map();
  const techniciansByName = new Map();
  for (const entry of knownTechnicians) {
    if (!entry || typeof entry.technician_registry_id !== "string" ||
        !uuidPattern.test(entry.technician_registry_id) ||
        techniciansById.has(entry.technician_registry_id))
      throw new TypeError("Identificador de técnico inválido ou duplicado");
    techniciansById.set(entry.technician_registry_id, entry);
    if (typeof entry.display_name === "string" && normalizeLabel(entry.display_name)) {
      const name = normalizeLabel(entry.display_name);
      techniciansByName.set(name, (techniciansByName.get(name) ?? 0) + 1);
    }
  }

  const idsBySourceKey = new Map();
  const previousNames = new Map();
  for (const alias of knownAliases) {
    if (!alias || typeof alias.source_record_key !== "string" ||
        !alias.source_record_key.trim() ||
        (alias.technician_registry_id !== null &&
          (typeof alias.technician_registry_id !== "string" ||
           !uuidPattern.test(alias.technician_registry_id))))
      throw new TypeError("Alias de origem inválido");
    const ids = idsBySourceKey.get(alias.source_record_key) ?? new Set();
    ids.add(alias.technician_registry_id);
    idsBySourceKey.set(alias.source_record_key, ids);
    if (typeof alias.public_name === "string" && normalizeLabel(alias.public_name)) {
      const name = normalizeLabel(alias.public_name);
      const keys = previousNames.get(name) ?? new Set();
      keys.add(alias.source_record_key);
      previousNames.set(name, keys);
    }
  }

  const records = source.records.map(row => {
    const ids = idsBySourceKey.get(row.source_record_key);
    let decision = "nova_ficha_proposta";
    let review_reason = null;
    let technician_registry_id = null;
    if (ids && ids.size !== 1) {
      decision = "conflito_revisao";
      review_reason = "alias_com_destinos_distintos";
    } else if (ids) {
      const [id] = ids;
      if (id !== null && techniciansById.has(id)) {
        decision = "alias_conhecido";
        technician_registry_id = id;
      } else {
        decision = "conflito_revisao";
        review_reason = id === null ? "alias_sem_identidade" : "destino_nao_encontrado";
      }
    } else if (row.possible_same_name_rows.length > 0) {
      decision = "conflito_revisao";
      review_reason = "nome_repetido_na_captura";
    } else if (techniciansByName.has(normalizeLabel(row.public_name)) ||
               previousNames.has(normalizeLabel(row.public_name))) {
      decision = "conflito_revisao";
      review_reason = "nome_coincidente_sem_prova";
    }
    return Object.freeze({
      source_record_key: row.source_record_key,
      source_row: row.source_row,
      public_name: row.public_name,
      decision,
      technician_registry_id,
      review_reason,
    });
  });
  return Object.freeze({
    source: source.source,
    source_page_city_ibge: source.source_page_city_ibge,
    quarantined_count: source.quarantined_count,
    enabled_count: 0,
    published_count: 0,
    counts: Object.freeze({
      alias_conhecido: records.filter(r => r.decision === "alias_conhecido").length,
      nova_ficha_proposta: records.filter(r => r.decision === "nova_ficha_proposta").length,
      conflito_revisao: records.filter(r => r.decision === "conflito_revisao").length,
    }),
    records: Object.freeze(records),
  });
}
