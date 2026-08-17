export const keywordRetentionDays = 30;
export const keywordRetentionMs = keywordRetentionDays * 24 * 60 * 60 * 1000;

export function keywordRetentionCutoffIso(now = Date.now()) {
  return new Date(now - keywordRetentionMs).toISOString();
}

export function isExpiredKeywordDate(value, now = Date.now()) {
  const timestamp = Date.parse(String(value ?? ""));
  return !Number.isFinite(timestamp) || timestamp < now - keywordRetentionMs;
}
