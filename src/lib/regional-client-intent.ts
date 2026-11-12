/** Regional mode only prepares a private client request. It never targets an unclaimed listing. */
const CATEGORY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function regionalClientReturnPath(category: unknown): string {
  const slug = typeof category === "string" && category.length <= 64 && CATEGORY.test(category)
    ? category : null;
  return "/area-cliente?modo=regional" + (slug ? "&categoria=" + slug : "");
}

export function regionalRequestRecipient(regional: boolean, selectedId: string | null): string | null {
  return regional ? null : selectedId;
}

export function mayShareDirectRequest(
  regional: boolean, consent: boolean, selectedId: string | null,
): boolean {
  return !regional && consent && Boolean(selectedId);
}
