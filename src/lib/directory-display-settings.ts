import { z } from "zod";

/** Public presentation preferences only. Never contains account or contact data. */
export const directoryDisplaySchema = z.object({
  auto_region: z.boolean(),
  online_priority: z.boolean(),
  referral_priority: z.boolean(),
  pioneer_priority: z.boolean(),
  online_outline: z.boolean(),
  enriched_outline: z.boolean(),
  photo_outline: z.boolean(),
  referral_label: z.boolean(),
}).strict();

export type DirectoryDisplaySettings = z.infer<typeof directoryDisplaySchema>;

export const DEFAULT_DIRECTORY_DISPLAY: DirectoryDisplaySettings = {
  auto_region: true,
  online_priority: true,
  referral_priority: true,
  pioneer_priority: true,
  online_outline: true,
  enriched_outline: true,
  photo_outline: true,
  referral_label: true,
};

/** Fail closed to the already-published behavior if the optional RPC is absent. */
export function parseDirectoryDisplaySettings(value: unknown): DirectoryDisplaySettings {
  const result = directoryDisplaySchema.safeParse(value);
  return result.success ? result.data : DEFAULT_DIRECTORY_DISPLAY;
}
