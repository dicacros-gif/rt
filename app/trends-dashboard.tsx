"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Portal = "daum" | "google" | "naver" | "signal";
type RelatedSource = "naver" | "daum" | "google";
type TrendItem = {
  id: number;
  rank: number;
  keyword: string;
  link: string;
  firstSeenAt: string;
  lastSeenAt: string;
};
type RelatedItem = { keyword: string; sources: RelatedSource[] };
type RelatedState = {
  open: boolean;
  loading: boolean;
  error: string;
  items: RelatedItem[];
};
type PortalData = {
  id: Portal;
  name: string;
  description: string;
  source: string;
  items: TrendItem[];
};
type ApiData = { updatedAt: string; portals: PortalData[] };

const portalMeta: Record<Portal, { title: string; mark: string }> = {
  daum: { title: "다음 실시간 검색어", mark: "D" },
  google: { title: "구글 실시간 검색어", mark: "G" },
  naver: { title: "크리에이터 어드바이저 검색어", mark: "C" },
  signal: { title: "Signal.bz 실시간 검색어", mark: "S" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatCollectedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function groupByCollectedAt(items: TrendItem[]) {
  const groups = new Map<string, TrendItem[]>();
  for (const item of items) {
    const label = formatCollectedAt(item.firstSeenAt);
    const group = groups.get(label) ?? [];
    group.push(item);
    groups.set(label, group);
  }
  return [...groups.entries()];
}

function LoadingCard({ portal }: { portal: Portal }) {
  return (
    <section className={`ranking-card ${portal}`}>
      <div className="card-title">
        <span className="portal-mark">{portalMeta[portal].mark}</span>
        <h2>{portalMeta[portal].title}</h2>
      </div>
      <p className="updated-text">검색어를 불러오는 중입니다</p>
      <div className="loading-rows">
        {Array.from({ length: 10 }, (_, index) => <span key={index} />)}
      </div>
    </section>
  );
}

export default function TrendsDashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ portalId: Portal; item: TrendItem } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [related, setRelated] = useState<Record<string, RelatedState>>({});
  const [copiedKey, setCopiedKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/trends", { cache: "no-store" });
      if (!response.ok) throw new Error("검색어를 불러오지 못했습니다.");
      setData(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  const portals = useMemo(() => data?.portals ?? [], [data]);

  const removeKeyword = async () => {
    if (!deleteTarget) return;
    const { portalId, item } = deleteTarget;
    setDeleting(item.id);
    setDeleteError("");
    try {
      const response = await fetch("/api/trends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, password: deletePassword }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error ?? "삭제하지 못했습니다.");
      }
      setData((current) => current ? {
        ...current,
        portals: current.portals.map((portal) => portal.id === portalId
          ? {
            ...portal,
            items: portal.items
              .filter((entry) => entry.id !== item.id)
              .map((entry, index) => ({ ...entry, rank: index + 1 })),
          }
          : portal),
      } : current);
      setRelated((current) => {
        const next = { ...current };
        delete next[`${portalId}-${item.id}`];
        return next;
      });
      setDeleteTarget(null);
      setDeletePassword("");
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "삭제하지 못했습니다.");
    } finally {
      setDeleting(null);
    }
  };

  const toggleRelated = async (portalId: Portal, item: TrendItem) => {
    const key = `${portalId}-${item.id}`;
    const current = related[key];

    if (current?.open) {
      setRelated((states) => ({ ...states, [key]: { ...states[key], open: false } }));
      return;
    }

    if (current?.items.length || current?.loading) {
      setRelated((states) => ({ ...states, [key]: { ...states[key], open: true } }));
      return;
    }

    setRelated((states) => ({
      ...states,
      [key]: { open: true, loading: true, error: "", items: [] },
    }));

    try {
      const response = await fetch(`/api/related?q=${encodeURIComponent(item.keyword)}`);
      if (!response.ok) throw new Error("연관 검색어를 불러오지 못했습니다.");
      const result = await response.json() as { items?: RelatedItem[] };
      setRelated((states) => ({
        ...states,
        [key]: { open: true, loading: false, error: "", items: result.items ?? [] },
      }));
    } catch (reason) {
      setRelated((states) => ({
        ...states,
        [key]: {
          open: true,
          loading: false,
          error: reason instanceof Error ? reason.message : "연관 검색어를 불러오지 못했습니다.",
          items: [],
        },
      }));
    }
  };

  const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  const copyRelated = async (key: string, items: RelatedItem[]) => {
    if (!items.length) return;
    try {
      await copyText(items.map((item) => item.keyword).join("\n"));
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? "" : current), 1600);
    } catch {
      setRelated((states) => ({
        ...states,
        [key]: { ...states[key], error: "클립보드에 복사하지 못했습니다." },
      }));
    }
  };

  return (
    <main className="page-shell">
      <header className="page-heading">
        <div className="heading-actions">
          <button onClick={load} disabled={loading}>
            <span className={loading ? "spin" : ""}>↻</span>
            {loading ? "업데이트 중" : "새로고침"}
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error} <button onClick={load}>다시 시도</button></div>}

      <section className="cards-grid">
        {loading && !data
          ? (["daum", "google", "naver", "signal"] as Portal[]).map((portal) => (
            <LoadingCard key={portal} portal={portal} />
          ))
          : portals.map((portal) => {
            const collectedGroups = groupByCollectedAt(portal.items);
            return (
              <section className={`ranking-card ${portal.id}`} key={portal.id}>
                <div className="card-title">
                  <span className="portal-mark">{portalMeta[portal.id].mark}</span>
                  <h2>{portalMeta[portal.id].title}</h2>
                </div>
                <p className="updated-text">누적 {portal.items.length}개 · {data ? formatDate(data.updatedAt) : ""} 확인</p>

                <div className="collection-groups">
                  {collectedGroups.map(([collectedAt, items]) => (
                    <section className="collection-group" key={collectedAt}>
                      <h3><span>{collectedAt} 수집</span><small>{items.length}개</small></h3>
                      <ol className="keyword-list">
                  {items.map((item) => {
                    const itemKey = `${portal.id}-${item.id}`;
                    const relatedState = related[itemKey];
                    return (
                      <li className="keyword-entry" key={item.id}>
                        <div className="keyword-row">
                          <button
                            className={`related-toggle ${relatedState?.open ? "checked" : ""}`}
                            role="checkbox"
                            aria-checked={Boolean(relatedState?.open)}
                            aria-label={`${item.keyword} 연관 검색어 ${relatedState?.open ? "닫기" : "보기"}`}
                            title="네이버·다음·구글 연관 검색어 보기"
                            onClick={() => toggleRelated(portal.id, item)}
                          >
                            <span aria-hidden="true">{relatedState?.open ? "✓" : ""}</span>
                          </button>
                          <span className="rank-badge">{item.rank}</span>
                          <a href={item.link} target="_blank" rel="noreferrer">{item.keyword}</a>
                          <button
                            className="remove-keyword"
                            aria-label={`${item.keyword} 삭제`}
                            title="이 키워드를 삭제하고 다시 수집하지 않기"
                            disabled={deleting === item.id}
                            onClick={() => {
                              setDeleteTarget({ portalId: portal.id, item });
                              setDeletePassword("");
                              setDeleteError("");
                            }}
                          >
                            ×
                          </button>
                        </div>

                        {relatedState?.open && (
                          <div className="related-panel">
                            <div className="related-heading">
                              <strong>연관 검색어</strong>
                              {!relatedState.loading && relatedState.items.length > 0 && (
                                <button onClick={() => copyRelated(itemKey, relatedState.items)}>
                                  {copiedKey === itemKey ? "복사됨 ✓" : `전체 복사 (${relatedState.items.length})`}
                                </button>
                              )}
                            </div>
                            {relatedState.loading && <p className="related-status">네이버·다음·구글에서 찾는 중…</p>}
                            {relatedState.error && <p className="related-status error">{relatedState.error}</p>}
                            {!relatedState.loading && !relatedState.error && relatedState.items.length === 0 && (
                              <p className="related-status">표시할 연관 검색어가 없습니다.</p>
                            )}
                            {relatedState.items.length > 0 && (
                              <ul className="related-list">
                                {relatedState.items.map((relatedItem) => (
                                  <li key={relatedItem.keyword}>
                                    <button
                                      className="related-keyword"
                                      title="클릭해서 이 검색어 복사"
                                      onClick={() => copyText(relatedItem.keyword)}
                                    >
                                      {relatedItem.keyword}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                      </ol>
                    </section>
                  ))}
                </div>
              </section>
            );
          })}
      </section>

      {deleteTarget && (
        <div className="delete-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDeleteTarget(null);
        }}>
          <form className="delete-dialog" onSubmit={(event) => {
            event.preventDefault();
            removeKeyword();
          }}>
            <h2>키워드 삭제</h2>
            <p><strong>{deleteTarget.item.keyword}</strong>을 삭제하면 이후 수집에서도 제외됩니다.</p>
            <label htmlFor="delete-password">삭제 비밀번호</label>
            <input
              id="delete-password"
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
            {deleteError && <p className="delete-error">{deleteError}</p>}
            <div className="delete-actions">
              <button type="button" onClick={() => setDeleteTarget(null)}>취소</button>
              <button type="submit" className="danger" disabled={deleting === deleteTarget.item.id}>
                {deleting === deleteTarget.item.id ? "삭제 중" : "삭제"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
