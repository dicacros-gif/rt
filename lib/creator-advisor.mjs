export function extractCreatorAdvisorKeywords(payload) {
  const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (parsed?.result !== "success" || !Array.isArray(parsed.data)) return [];

  return parsed.data
    .slice(0, 10)
    .map((keyword) => String(keyword ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
