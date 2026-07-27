import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TREND NOW | 실시간 인기 검색어",
  description: "다음, 구글, 크리에이터 어드바이저와 Signal.bz의 실시간 인기 키워드를 한눈에 확인하세요.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
