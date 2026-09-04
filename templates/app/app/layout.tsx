import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FMCW Radar Knowledge Flow",
  description: "FMCW 雷达全栈学习路线与可交互知识图谱",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
