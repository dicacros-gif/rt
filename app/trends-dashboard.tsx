"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Portal = "daum" | "google" | "naver" | "signal";
type ViewId = Portal | "daumMore" | "googleMore";
type RelatedSource = "naver" | "daum" | "google";
type TrendItem = {
  id: number;
  rank: number;
  keyword: string;
  link: string;
  firstSeenAt: string;
  lastSeenAt: string;
};
type DeleteTarget = { portalId: Portal; item: TrendItem };
type RelatedItem = { keyword: string; sources: RelatedSource[] };
type RelatedState = {
  loading: boolean;
  error: string;
  seed: string;
  prefix: string;
  fullItems: RelatedItem[];
  prefixItems: RelatedItem[];
};
type PortalData = {
  id: Portal;
  name: string;
  description: string;
  source: string;
  items: TrendItem[];
};
type ApiData = { updatedAt: string; portals: PortalData[] };

const portalMeta: Record<ViewId, { portalId: Portal; title: string; mark: string }> = {
  daum: { portalId: "daum", title: "다음 실시간 검색어", mark: "D" },
  google: { portalId: "google", title: "구글 실시간 검색어", mark: "G" },
  naver: { portalId: "naver", title: "크리에이터 어드바이저 검색어", mark: "C" },
  signal: { portalId: "signal", title: "네이버 실시간 검색어", mark: "N" },
  daumMore: { portalId: "daum", title: "다음 추가 실시간 순위", mark: "D" },
  googleMore: { portalId: "google", title: "구글 추가 실시간 순위", mark: "G" },
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

function LoadingCard({ viewId }: { viewId: ViewId }) {
  const meta = portalMeta[viewId];
  return (
    <section className={`ranking-card ${meta.portalId}`}>
      <div className="card-title">
        <span className="portal-mark">{meta.mark}</span>
        <h2>{meta.title}</h2>
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
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [related, setRelated] = useState<Record<string, RelatedState>>({});
  const [activeRelated, setActiveRelated] = useState<{ key: string; keyword: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [collapsedViews, setCollapsedViews] = useState<Set<ViewId>>(() => new Set());

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
  const portalViews = useMemo(() => {
    const byId = new Map(portals.map((portal) => [portal.id, portal]));
    return (["daum", "google", "signal", "naver", "daumMore", "googleMore"] as ViewId[]).map((viewId) => {
      const meta = portalMeta[viewId];
      const portal = byId.get(meta.portalId);
      const items = portal?.items ?? [];
      return {
        viewId,
        portalId: meta.portalId,
        title: meta.title,
        mark: meta.mark,
        items: viewId === "daumMore" || viewId === "googleMore" ? items.slice(10)
          : viewId === "daum" || viewId === "google" ? items.slice(0, 10)
            : items,
      };
    });
  }, [portals]);

  const removeKeyword = async (
    target: DeleteTarget | null = deleteTarget,
    password = deletePassword,
  ) => {
    if (!target) return;
    const { portalId, item } = target;
    setDeleting(item.id);
    setDeleteError("");
    try {
      const response = await fetch("/api/trends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(password ? { id: item.id, password } : { id: item.id }),
      });
      const result = await response.json().catch(() => null) as {
        error?: string;
        requiresPassword?: boolean;
      } | null;
      if (!response.ok) {
        if (response.status === 401 && !password && result?.requiresPassword) {
          setDeleteTarget(target);
          setDeletePassword("");
          setDeleteError("");
          return;
        }
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
      setActiveRelated((current) => current?.key === `${portalId}-${item.id}` ? null : current);
      setDeleteTarget(null);
      setDeletePassword("");
    } catch (reason) {
      setDeleteTarget(target);
      setDeleteError(reason instanceof Error ? reason.message : "삭제하지 못했습니다.");
    } finally {
      setDeleting(null);
    }
  };

  const openRelated = async (key: string, keyword: string) => {
    const current = related[key];
    setActiveRelated({ key, keyword });
    if (current?.fullItems.length || current?.prefixItems.length || current?.loading) {
      return;
    }

    setRelated((states) => ({
      ...states,
      [key]: {
        loading: true,
        error: "",
        seed: keyword,
        prefix: "",
        fullItems: [],
        prefixItems: [],
      },
    }));

    try {
      const response = await fetch(`/api/related?q=${encodeURIComponent(keyword)}`);
      if (!response.ok) throw new Error("연관 검색어를 불러오지 못했습니다.");
      const result = await response.json() as {
        seed?: string;
        prefix?: string;
        items?: RelatedItem[];
        fullItems?: RelatedItem[];
        prefixItems?: RelatedItem[];
      };
      setRelated((states) => ({
        ...states,
        [key]: {
          loading: false,
          error: "",
          seed: result.seed ?? keyword,
          prefix: result.prefix ?? "",
          fullItems: result.fullItems ?? result.items ?? [],
          prefixItems: result.prefixItems ?? [],
        },
      }));
    } catch (reason) {
      setRelated((states) => ({
        ...states,
        [key]: {
          loading: false,
          error: reason instanceof Error ? reason.message : "연관 검색어를 불러오지 못했습니다.",
          seed: keyword,
          prefix: "",
          fullItems: [],
          prefixItems: [],
        },
      }));
    }
  };

  const toggleRelated = async (portalId: Portal, item: TrendItem) => {
    const key = `${portalId}-${item.id}`;
    if (activeRelated?.key === key) {
      setActiveRelated(null);
      return;
    }
    await openRelated(key, item.keyword);
  };

  const searchRelated = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = searchKeyword.replace(/\s+/g, " ").trim();
    if (!keyword) return;
    void openRelated(`manual-${keyword.normalize("NFKC").toLocaleLowerCase("ko-KR")}`, keyword);
  };

  const toggleCollapsed = (viewId: ViewId) => {
    setCollapsedViews((current) => {
      const next = new Set(current);
      if (next.has(viewId)) next.delete(viewId);
      else next.add(viewId);
      return next;
    });
  };

  const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // 브라우저 권한이 없으면 아래의 선택 복사 방식으로 대체합니다.
      }
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
      const stateKey = key.replace(/-(full|prefix)$/, "");
      setRelated((states) => ({
        ...states,
        [stateKey]: { ...states[stateKey], error: "클립보드에 복사하지 못했습니다." },
      }));
    }
  };

  return (
    <main className="page-shell">
      <form className="keyword-search" onSubmit={searchRelated}>
        <label htmlFor="related-search">연관 검색어 검색</label>
        <input
          id="related-search"
          type="search"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder="키워드를 입력하고 엔터를 누르세요"
          autoComplete="off"
        />
        <button type="submit">검색</button>
      </form>

      {error && <div className="error-message">{error} <button onClick={load}>다시 시도</button></div>}

      <div className="dashboard-layout">
        <section className="cards-grid">
          {loading && !data
            ? (["daum", "google", "signal", "naver", "daumMore", "googleMore"] as ViewId[]).map((viewId) => (
              <LoadingCard key={viewId} viewId={viewId} />
            ))
            : portalViews.map((view) => {
              const collectedGroups = groupByCollectedAt(view.items);
              const isCollapsed = collapsedViews.has(view.viewId);
              return (
                <section className={`ranking-card ${view.portalId} ${isCollapsed ? "collapsed" : ""}`} key={view.viewId}>
                <button
                  type="button"
                  className="card-title"
                  aria-expanded={!isCollapsed}
                  aria-label={`${view.title} ${isCollapsed ? "펼치기" : "접기"}`}
                  onClick={() => toggleCollapsed(view.viewId)}
                >
                  <span className="portal-mark">{view.mark}</span>
                  <h2>{view.title}</h2>
                  <span className="collapse-indicator" aria-hidden="true">⌃</span>
                </button>
                <div className="card-body" hidden={isCollapsed}>
                <p className="updated-text">실시간 순위 {view.items.length}개 · {data ? formatDate(data.updatedAt) : ""} 확인</p>

                <div className="collection-groups">
                  {!view.items.length && <p className="rank-empty">새 실시간 순위가 수집되면 이 칸에 표시됩니다.</p>}
                  {collectedGroups.map(([collectedAt, items]) => (
                    <section className="collection-group" key={collectedAt}>
                      <h3><span>{collectedAt} 수집</span><small>{items.length}개</small></h3>
                      <ol className="keyword-list">
                  {items.map((item) => {
                    const itemKey = `${view.portalId}-${item.id}`;
                    const isRelatedOpen = activeRelated?.key === itemKey;
                    return (
                      <li className="keyword-entry" key={item.id}>
                        <div className="keyword-row">
                          <button
                            className={`related-toggle ${isRelatedOpen ? "checked" : ""}`}
                            role="checkbox"
                            aria-checked={isRelatedOpen}
                            aria-label={`${item.keyword} 연관 검색어 ${isRelatedOpen ? "닫기" : "보기"}`}
                            title="네이버·다음·구글 연관 검색어 보기"
                            onClick={() => toggleRelated(view.portalId, item)}
                          >
                            <span aria-hidden="true">{isRelatedOpen ? "✓" : ""}</span>
                          </button>
                          <span className="rank-badge">{item.rank}</span>
                          <a href={item.link} target="_blank" rel="noreferrer">{item.keyword}</a>
                          <button
                            className="remove-keyword"
                            aria-label={`${item.keyword} 삭제`}
                            title="이 키워드를 삭제하고 다시 수집하지 않기"
                            disabled={deleting === item.id}
                            onClick={() => void removeKeyword({ portalId: view.portalId, item }, "")}
                          >
                            ×
                          </button>
                        </div>

                      </li>
                    );
                  })}
                      </ol>
                    </section>
                  ))}
                </div>
                </div>
                </section>
              );
            })}
        </section>

        {activeRelated && (
          <button
            type="button"
            className="related-mobile-backdrop"
            aria-label="연관 검색어 닫기"
            onClick={() => setActiveRelated(null)}
          />
        )}

        <aside className={`related-drawer ${activeRelated ? "open" : ""}`} aria-label="연관 검색어">
          {!activeRelated ? (
            <div className="related-placeholder">
              <strong>연관 검색어</strong>
              <p>상단에 키워드를 입력하거나 왼쪽 체크 버튼을 누르면 연관 검색어가 표시됩니다.</p>
            </div>
          ) : (() => {
            const state = related[activeRelated.key];
            const fullItems = state?.fullItems ?? [];
            const prefixItems = state?.prefixItems ?? [];
            return (
              <>
            <div className="related-drawer-title">
              <div>
                <span>선택한 검색어</span>
                <strong>{activeRelated.keyword}</strong>
              </div>
              <button type="button" onClick={() => setActiveRelated(null)} aria-label="연관 검색어 닫기">×</button>
            </div>
            {state?.loading && <p className="related-status">네이버·다음·구글에서 찾는 중…</p>}
            {state?.error && <p className="related-status error">{state.error}</p>}
            {!state?.loading && !state?.error && (
              <div className="related-drawer-sections">
                <section className="related-result-section">
                  <div className="related-heading">
                    <div><span>전체 문구</span><strong>{state?.seed ?? activeRelated.keyword}</strong></div>
                    <button
                      type="button"
                      disabled={!fullItems.length}
                      onClick={() => copyRelated(`${activeRelated.key}-full`, fullItems)}
                    >
                      {copiedKey === `${activeRelated.key}-full` ? "복사됨 ✓" : `복사 (${fullItems.length})`}
                    </button>
                  </div>
                  {fullItems.length ? (
                    <ul className="related-list">
                      {fullItems.map((relatedItem) => (
                        <li key={relatedItem.keyword}>
                          <button className="related-keyword" onClick={() => copyText(relatedItem.keyword)}>
                            {relatedItem.keyword}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="related-status">표시할 연관 검색어가 없습니다.</p>}
                </section>
                <section className="related-result-section">
                  <div className="related-heading">
                    <div><span>첫 단어</span><strong>{state?.prefix || "추가 검색 없음"}</strong></div>
                    <button
                      type="button"
                      disabled={!prefixItems.length}
                      onClick={() => copyRelated(`${activeRelated.key}-prefix`, prefixItems)}
                    >
                      {copiedKey === `${activeRelated.key}-prefix` ? "복사됨 ✓" : `복사 (${prefixItems.length})`}
                    </button>
                  </div>
                  {prefixItems.length ? (
                    <ul className="related-list">
                      {prefixItems.map((relatedItem) => (
                        <li key={relatedItem.keyword}>
                          <button className="related-keyword" onClick={() => copyText(relatedItem.keyword)}>
                            {relatedItem.keyword}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="related-status">여러 단어 검색어에서 첫 단어 결과를 표시합니다.</p>}
                </section>
              </div>
            )}
              </>
            );
          })()}
        </aside>
      </div>

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
