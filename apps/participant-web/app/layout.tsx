import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Travel Bingo | 산책에서 여행까지",
  description: "오늘도 작은 발견을 시작하는 산책 빙고",
  manifest: "/manifest.webmanifest",
  applicationName: "Travel Bingo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Travel Bingo",
  },
  icons: {
    icon: "/brand/logo-notext.svg",
    shortcut: "/brand/logo-notext.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f4ed",
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
