import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "어비 강사 온보딩 센터",
    description: "계약부터 첫 강의, 수강생 관리까지 한 번에 준비하는 강사 운영 내비게이션",
    openGraph: {
      title: "어비 강사 온보딩 센터",
      description: "계약부터 첫 강의, 수강생 관리까지 한 번에",
      url: origin,
      siteName: "UhB",
      locale: "ko_KR",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "어비 강사 온보딩 센터" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "어비 강사 온보딩 센터",
      description: "계약부터 첫 강의, 수강생 관리까지 한 번에",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
