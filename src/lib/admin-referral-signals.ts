import type { PublicTechnician } from "@/lib/technicians.functions";

/**
 * B1 read-only: this public projection is NOT an administrative referral ledger.
 * A spotlight flag is a derived eligibility signal for an already-public profile.
 * Never forward user IDs, contact data, invitation relationships or private rows.
 */
type PublicSignalSource = Pick<PublicTechnician,
  "id" | "public_slug" | "display_name" | "city" | "state_uf" | "referral_highlight">;

export type PublicReferralSpotlight = Pick<PublicSignalSource,
  "id" | "public_slug" | "display_name" | "city" | "state_uf">;

export function approvedPublicReferralSpotlights(
  rows: readonly PublicSignalSource[],
): PublicReferralSpotlight[] {
  return rows.filter((row) => row.referral_highlight === true).map((row) => ({
    id: row.id,
    public_slug: row.public_slug,
    display_name: row.display_name,
    city: row.city,
    state_uf: row.state_uf,
  }));
}
