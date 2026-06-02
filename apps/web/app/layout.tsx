import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CommentGuard",
  description: "Comment monitoring and legal evidence platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
