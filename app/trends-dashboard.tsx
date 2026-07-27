"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Portal = "daum" | "google" | "naver" | "signal";
type TrendItem = { id: number; rank: number; keyword: string; link: string };
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
  const [limit, setLimit] = useState(30);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/trends?limit=${limit}`, { cache: "no-store" });
      if (!response.ok) throw new Error("검색어를 불러오지 못했습니다.");
      setData(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  const portals = useMemo(() => data?.portals ?? [], [data]);

  const removeKeyword = async (portalId: Portal, item: TrendItem) => {
    setDeleting(item.id);
    try {
      const response = await fetch("/api/trends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (!response.ok) throw new Error("삭제하지 못했습니다.");
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "삭제하지 못했습니다.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <main className="page-shell">
      <header className="page-heading">
        <h1>실시간 인기 검색어</h1>
        <div className="heading-actions">
          <button onClick={load} disabled={loading}>
            <span className={loading ? "spin" : ""}>↻</span>
            {loading ? "업데이트 중" : "새로고침"}
          </button>
          <label>
            최대
            <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
              <option value={20}>20개</option>
              <option value={30}>30개</option>
              <option value={40}>40개</option>
              <option value={50}>50개</option>
            </select>
          </label>
        </div>
      </header>

      {error && <div className="error-message">{error} <button onClick={load}>다시 시도</button></div>}

      <section className="cards-grid">
        {loading && !data
          ? (["daum", "google", "naver", "signal"] as Portal[]).map((portal) => (
            <LoadingCard key={portal} portal={portal} />
          ))
          : portals.map((portal) => {
            const isExpanded = Boolean(expanded[portal.id]);
            const visibleItems = isExpanded ? portal.items : portal.items.slice(0, 10);
            return (
              <section className={`ranking-card ${portal.id}`} key={portal.id}>
                <div className="card-title">
                  <span className="portal-mark">{portalMeta[portal.id].mark}</span>
                  <h2>{portalMeta[portal.id].title}</h2>
                </div>
                <p className="updated-text">{data ? formatDate(data.updatedAt) : ""} 기준</p>

                <ol className="keyword-list">
                  {visibleItems.map((item, index) => (
                    <li key={item.id}>
                      <span className="rank-badge">{index + 1}</span>
                      <a href={item.link} target="_blank" rel="noreferrer">{item.keyword}</a>
                      <button
                        className="remove-keyword"
                        aria-label={`${item.keyword} 삭제`}
                        title="이 키워드를 삭제하고 다시 수집하지 않기"
                        disabled={deleting === item.id}
                        onClick={() => removeKeyword(portal.id, item)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ol>

                {portal.items.length > 10 && (
                  <button
                    className="more-button"
                    onClick={() => setExpanded((current) => ({ ...current, [portal.id]: !isExpanded }))}
                  >
                    {isExpanded ? "상위 10개만 보기" : `${portal.items.length}개 전체 보기`}
                  </button>
                )}
                <p className="source-text">{portal.source}</p>
              </section>
            );
          })}
      </section>

    </main>
  );
}
