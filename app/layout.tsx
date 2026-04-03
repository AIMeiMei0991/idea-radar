import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Idea Radar — 每日工具创意雷达",
  description: "每天自动抓取全球最新数字工具创意，筛选中国市场机会",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
