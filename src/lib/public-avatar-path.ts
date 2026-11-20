const PUBLIC_AVATAR_PATH = /^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/;

/** Match the strict SAFE_PATH in technician-avatar without loading the Supabase client into cards. */
export function hasPublicTechnicianPhoto(path: string | null | undefined): boolean {
  return typeof path === "string" && PUBLIC_AVATAR_PATH.test(path);
}
