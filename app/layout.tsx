import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const metadataBase = host ? new URL(`${protocol}://${host}`) : undefined;
  return {
    metadataBase,
    title: { default: "WONJU STATION", template: "%s · WONJU STATION" },
    description: "날씨, 공식 새소식, 지도와 도시 상태를 한눈에 보는 독립 원주 시티 대시보드.",
    applicationName: "WONJU STATION",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/og.png", apple: "/og.png" },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "WONJU STATION",
      title: "WONJU STATION",
      description: "원주의 모든 것, 지금 여기.",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "WONJU STATION · WONJU NOW" }],
    },
    twitter: { card: "summary_large_image", title: "WONJU STATION", description: "원주의 모든 것, 지금 여기.", images: ["/og.png"] },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#101311", colorScheme: "dark light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" suppressHydrationWarning><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}

