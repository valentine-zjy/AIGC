import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI降重工具",
  description: "正式提交前的长文诊断与精修工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
