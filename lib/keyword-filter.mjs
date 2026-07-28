const matchupSeparator = /\s+(?:vs\.?|versus|대)\s+/iu;

/**
 * Excludes head-to-head sports queries such as
 * "Chelsea vs Western Sydney Wanderers FC" and "KIA 대 삼성".
 */
export function isMatchupKeyword(value) {
  const keyword = String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!keyword) return false;

  const parts = keyword.split(matchupSeparator);
  return parts.length >= 2 && parts.every((part) => part.trim().length > 0);
}
