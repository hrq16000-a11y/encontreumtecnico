/**
 * Best-effort UI feedback only. Backend RPC validation and RLS are authoritative.
 * Never claim that this detects every possible personal identifier.
 */
export function containsObviousContact(value: string): boolean {
  return /(https?:\/\/|www[.]|wa[.]me\/|[a-z0-9_.%+-]+@[a-z0-9.-]+[.][a-z]{2,})/i.test(value)
    || /(^|[^\d])(\+?\d[\d\s()./-]*){9,}([^\d]|$)/.test(value)
    || /(^|[^a-zà-ÿ])(rua|avenida|travessa|alameda|estrada|av[.])\s+[^,.\n]{2,60}\s+\d{1,5}(\b|$)/i.test(value);
}
