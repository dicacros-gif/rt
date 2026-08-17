export const keywordSimilarityCleanupDays = 7;
export const keywordRetentionDays = 20;

const dayMs = 24 * 60 * 60 * 1000;
export const keywordSimilarityCleanupMs = keywordSimilarityCleanupDays * dayMs;
export const keywordRetentionMs = keywordRetentionDays * dayMs;

export function keywordSimilarityCutoffIso(now = Date.now()) {
  return new Date(now - keywordSimilarityCleanupMs).toISOString();
}

export function keywordRetentionCutoffIso(now = Date.now()) {
  return new Date(now - keywordRetentionMs).toISOString();
}

export function isExpiredKeywordDate(value, now = Date.now()) {
  const timestamp = Date.parse(String(value ?? ""));
  return !Number.isFinite(timestamp) || timestamp < now - keywordRetentionMs;
}

function comparableKeyword(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function keywordTokens(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .split(/[^\p{L}\p{N}]+/gu)
    .filter(Boolean);
}

function bigrams(value) {
  const result = new Set();
  const chars = [...value];
  for (let index = 0; index < chars.length - 1; index += 1) {
    result.add(`${chars[index]}${chars[index + 1]}`);
  }
  return result;
}

function prepareKeyword(item) {
  const key = comparableKeyword(item.keyword);
  return {
    ...item,
    idKey: String(item.id),
    key,
    tokens: keywordTokens(item.keyword),
    grams: bigrams(key),
    seenAt: Date.parse(String(item.firstSeenAt ?? item.first_seen_at ?? "")),
  };
}

function fuzzyTokenMatches(leftTokens, rightTokens) {
  const used = new Set();
  let matches = 0;
  for (const left of leftTokens) {
    const index = rightTokens.findIndex((right, rightIndex) => {
      if (used.has(rightIndex)) return false;
      if (left === right) return true;
      const shorter = left.length <= right.length ? left : right;
      const longer = left.length <= right.length ? right : left;
      return shorter.length >= 2 && longer.includes(shorter);
    });
    if (index >= 0) {
      used.add(index);
      matches += 1;
    }
  }
  return matches;
}

function arePreparedKeywordsSimilar(left, right) {
  if (!left.key || !right.key) return false;
  if (left.key === right.key) return true;

  const shorter = left.key.length <= right.key.length ? left.key : right.key;
  const longer = left.key.length <= right.key.length ? right.key : left.key;
  const hasStandaloneBase = left.tokens.length === 1 || right.tokens.length === 1;
  if (shorter.length >= 3 && longer.includes(shorter)
    && (shorter.length / longer.length >= 0.5 || hasStandaloneBase)) {
    return true;
  }

  const tokenMatches = fuzzyTokenMatches(left.tokens, right.tokens);
  if (tokenMatches >= 2 && tokenMatches / Math.max(left.tokens.length, right.tokens.length) >= 0.67) {
    return true;
  }

  if (left.grams.size < 3 || right.grams.size < 3) return false;
  let shared = 0;
  for (const gram of left.grams) if (right.grams.has(gram)) shared += 1;
  return (2 * shared) / (left.grams.size + right.grams.size) >= 0.72;
}

export function areSimilarKeywords(left, right) {
  return arePreparedKeywordsSimilar(
    prepareKeyword({ id: "left", keyword: left, firstSeenAt: new Date().toISOString() }),
    prepareKeyword({ id: "right", keyword: right, firstSeenAt: new Date().toISOString() }),
  );
}

export function selectAgedKeywordIdsToDelete(items, now = Date.now()) {
  const prepared = (Array.isArray(items) ? items : []).map(prepareKeyword);
  const deleteIds = new Set();
  const recentRepresentatives = [];
  const aged = [];

  for (const item of prepared) {
    if (!Number.isFinite(item.seenAt) || item.seenAt < now - keywordRetentionMs) {
      deleteIds.add(item.idKey);
    } else if (item.seenAt < now - keywordSimilarityCleanupMs) {
      aged.push(item);
    } else {
      recentRepresentatives.push(item);
    }
  }

  aged.sort((left, right) =>
    left.tokens.length - right.tokens.length
    || left.key.length - right.key.length
    || left.seenAt - right.seenAt
    || left.idKey.localeCompare(right.idKey),
  );

  const representatives = [...recentRepresentatives];
  for (const item of aged) {
    if (representatives.some((candidate) => arePreparedKeywordsSimilar(item, candidate))) {
      deleteIds.add(item.idKey);
    } else {
      representatives.push(item);
    }
  }
  return deleteIds;
}
