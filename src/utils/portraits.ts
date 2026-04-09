/**
 * Get portrait URL for an author.
 * Prefers local downloaded photos, falls back to frontmatter path.
 */
export function getPortraitUrl(authorName: string, customPortrait?: string | null): string {
  if (customPortrait) return customPortrait;
  // For static authors, the frontmatter portrait field already points to the correct local image.
  // This function is only needed for custom authors without a portrait.
  const seed = encodeURIComponent(authorName);
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=transparent`;
}
