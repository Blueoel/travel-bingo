import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Travel Bingo | 오늘의 산책",
  description: "걷고, 발견하고, 빙고를 완성하는 여행 미션",
  manifest: "/manifest.webmanifest",
  applicationName: "Travel Bingo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Travel Bingo",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#173a2c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
