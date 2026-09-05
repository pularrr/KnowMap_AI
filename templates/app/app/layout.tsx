import type { Metadata } from "next";
import { APP_CONFIG } from "./config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_CONFIG.appName,
  description: APP_CONFIG.appSubtitle,
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
