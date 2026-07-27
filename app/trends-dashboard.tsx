"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Portal = "naver" | "google" | "daum";
type TrendItem = { id: number; rank: number; keyword: string; traffic?: string; link: string };
type PortalData = {
  id: Portal;
  name: string;
  description: string;
  source: string;
  items: TrendItem[];
};
type ApiData = { updatedAt: string; portals: PortalData[]; partial: boolean };

const portalMeta: Record<Portal, { name: string; letter: string }> = {
  naver: { name: "네이버", letter: "N" },
  google: { name: "구글", letter: "G" },
  daum: { name: "다음", letter: "D" },
};

function SkeletonCard({ portal }: { portal: Portal }) {
  return (
    <section className={`trend-card ${portal}`}>
      <div className="card-head">
        <span className="portal-logo">{portalMeta[portal].letter}</span>
        <div><h2>{portalMeta[portal].name}</h2><p>순위를 불러오는 중입니다</p></div>
      </div>
      <div className="skeleton-list">
        {Array.from({ length: 10 }, (_, i) => <span key={i} />)}
      </div>
    </section>
  );
}

export default function TrendsDashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(30);
  const [active, setActive] = useState<Portal | "all">("all");
  const [deleting, setDeleting] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/trends?limit=${limit}`, { cache: "no-store" });
      if (!response.ok) throw new Error("데이터를 불러오지 못했습니다.");
      setData(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  const visible = useMemo(
    () => data?.portals.filter((portal) => active === "all" || portal.id === active) ?? [],
    [data, active],
  );

  const updated = data
    ? new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(data.updatedAt))
    : "--:--:--";

  const removeKeyword = async (portal: Portal, item: TrendItem) => {
    const key = `${portal}:${item.id}`;
    setDeleting(key);
    try {
      const response = await fetch("/api/trends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (!response.ok) throw new Error("삭제하지 못했습니다.");
      setData((current) => current ? {
        ...current,
        portals: current.portals.map((portalData) => portalData.id === portal
          ? { ...portalData, items: portalData.items.filter((entry) => entry.id !== item.id).map((entry, index) => ({ ...entry, rank: index + 1 })) }
          : portalData),
      } : current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제하지 못했습니다.");
    } finally {
      setDeleting("");
    }
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="/" aria-label="트렌드 나우 홈">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>TREND <b>NOW</b></span>
        </a>
        <div className="live-status"><span /> LIVE · {updated} 업데이트</div>
      </header>

      <section className="hero">
        <p className="eyebrow">REAL-TIME SEARCH INSIGHT</p>
        <h1>지금, 사람들이<br /><em>무엇을 찾고 있을까요?</em></h1>
        <p className="hero-copy">네이버·구글·다음의 인기 흐름을 한 화면에서 확인하세요.<br />최대 50위까지, 5분마다 새로운 화제어를 모아드립니다.</p>
        <div className="hero-controls">
          <button className="refresh" onClick={load} disabled={loading} aria-label="순위 새로고침">
            <span className={loading ? "spinning" : ""}>↻</span> {loading ? "업데이트 중" : "지금 새로고침"}
          </button>
          <label>표시 개수
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={20}>20위</option>
              <option value={30}>30위</option>
              <option value={40}>40위</option>
              <option value={50}>50위</option>
            </select>
          </label>
        </div>
      </section>

      <nav className="portal-tabs" aria-label="포털 선택">
        {(["all", "naver", "google", "daum"] as const).map((id) => (
          <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}>
            {id === "all" ? "전체 보기" : portalMeta[id].name}
          </button>
        ))}
      </nav>

      {error && <div className="error-box">{error} <button onClick={load}>다시 시도</button></div>}

      <section className={`trend-grid ${active !== "all" ? "single" : ""}`}>
        {loading && !data
          ? (["naver", "google", "daum"] as Portal[]).map((p) => <SkeletonCard portal={p} key={p} />)
          : visible.map((portal) => (
            <section className={`trend-card ${portal.id}`} key={portal.id}>
              <div className="card-head">
                <span className="portal-logo">{portalMeta[portal.id].letter}</span>
                <div>
                  <h2>{portal.name}</h2>
                  <p>{portal.description}</p>
                </div>
                <span className="count">{portal.items.length}</span>
              </div>
              <ol className="ranking-list">
                {portal.items.map((item) => (
                  <li key={`${portal.id}-${item.rank}-${item.keyword}`}>
                    <div className="rank-row">
                      <a href={item.link} target="_blank" rel="noreferrer">
                      <span className="rank">{String(item.rank).padStart(2, "0")}</span>
                      <span className="keyword">{item.keyword}</span>
                      {item.traffic && <small>{item.traffic}</small>}
                      <span className="arrow">↗</span>
                      </a>
                      <button
                        className="dismiss"
                        aria-label={`${item.keyword} 삭제`}
                        title="이 키워드를 영구 삭제"
                        disabled={deleting === `${portal.id}:${item.id}`}
                        onClick={() => removeKeyword(portal.id, item)}
                      >×</button>
                    </div>
                  </li>
                ))}
              </ol>
              <footer><span>출처</span> {portal.source}</footer>
            </section>
          ))}
      </section>

      <aside className="notice">
        <strong>데이터 안내</strong>
        <p>네이버와 다음은 공식 실시간 검색어 서비스를 종료했습니다. 두 포털은 현재 많이 읽히는 뉴스 제목에서 화제어를 추출하며, 구글은 Google Trends 공개 피드를 사용합니다. 순위는 여론조사나 절대 검색량이 아닙니다.</p>
      </aside>

      <footer className="site-footer">
        <span>TREND NOW</span>
        <p>흩어진 관심의 흐름을 한곳에.</p>
        <small>공개 데이터 기반 비공식 트렌드 대시보드</small>
      </footer>
    </main>
  );
}
