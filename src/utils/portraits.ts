/**
 * Generate an illustration-style portrait URL using DiceBear API.
 * Uses "adventurer" style which produces cute illustration characters.
 * Each author name produces a unique, consistent avatar.
 */
export function getPortraitUrl(authorName: string, customPortrait?: string | null): string {
  if (customPortrait) return customPortrait;
  const seed = encodeURIComponent(authorName);
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=transparent`;
}

/**
 * Alternative styles available:
 * - adventurer: cute character illustrations
 * - lorelei: artistic minimal portraits
 * - notionists: notion-style illustrations
 * - personas: colorful character designs
 */
export function getPortraitUrlWithStyle(
  authorName: string,
  style: 'adventurer' | 'lorelei' | 'notionists' | 'personas' = 'adventurer'
): string {
  const seed = encodeURIComponent(authorName);
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundColor=transparent`;
}
