import { CustomerLocationButton } from "./customer-location-button";
import type { CustomerArea } from "@/lib/customer-location";

/** Last resort, only from the expanded location correction panel. */
export function ManualSearchGps({ onLocated }: { onLocated: (area: CustomerArea) => void }) {
  return <CustomerLocationButton autoIfGranted={false} onLocated={onLocated} />;
}
