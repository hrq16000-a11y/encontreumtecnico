// Public archive avatars are included ONLY after the original WordPress post ID,
// image bytes and independent delivery URL have been cross-checked.
// Do not derive a person's photo from a name, nearby post IDs or demo assets.
// The other 16 verified original paths remain in the private transfer queue
// until their assets have been independently transferred.
const transferredAvatars: Record<number, string> = {
  530: "https://res.cloudinary.com/dqnwlodjs/image/upload/v1794269310/encontreumtecnico/legacy/wp-candidate-530.webp",
};

export function legacyAvatarUrl(wordpressPostId: number): string | null {
  return transferredAvatars[wordpressPostId] ?? null;
}
