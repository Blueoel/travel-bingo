import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Travel Bingo Admin",description:"Travel Bingo 미션 운영 관리자 화면"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
