const realtimeTrendMarker = '"uiType":"REALTIME_TREND_TOP"';
const keywordsProperty = '"keywords":';

function findJsonArrayEnd(source, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "[") {
      depth += 1;
    } else if (character === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

export function extractDaumRealtimeKeywords(html) {
  const source = String(html ?? "");
  const markerIndex = source.indexOf(realtimeTrendMarker);
  if (markerIndex < 0) return [];

  const propertyIndex = source.indexOf(keywordsProperty, markerIndex);
  if (propertyIndex < 0 || propertyIndex - markerIndex > 12_000) return [];

  const arrayStart = source.indexOf("[", propertyIndex + keywordsProperty.length);
  if (arrayStart < 0) return [];
  const arrayEnd = findJsonArrayEnd(source, arrayStart);
  if (arrayEnd < 0) return [];

  try {
    const items = JSON.parse(source.slice(arrayStart, arrayEnd + 1));
    if (!Array.isArray(items)) return [];

    return items
      .map((item, index) => ({
        keyword: String(item?.keyword ?? "").replace(/\s+/g, " ").trim(),
        displayRank: Number.isFinite(Number(item?.displayRank))
          ? Number(item.displayRank)
          : index + 1,
      }))
      .filter((item) => item.keyword)
      .sort((left, right) => left.displayRank - right.displayRank)
      .slice(0, 10)
      .map((item) => item.keyword);
  } catch {
    return [];
  }
}
