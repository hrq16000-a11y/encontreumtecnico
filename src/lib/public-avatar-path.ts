const PUBLIC_AVATAR_PATH = /^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/;

/** Match the same public storage paths used by the avatar renderer. */
export function hasPublicTechnicianPhoto(path: string | null | undefined): boolean {
  return typeof path === "string" && PUBLIC_AVATAR_PATH.test(path);
}
