import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_KR({ variable: "--font-noto-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const notoSerif = Noto_Serif_KR({ variable: "--font-noto-serif", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const metadataBase = host ? new URL(`${protocol}://${host}`) : undefined;
  return {
    metadataBase,
    title: { default: "WONJU STATION · 원주 여행 가이드", template: "%s · WONJU STATION" },
    description: "원주의 풍경·맛·문화를 실제로 갈 수 있는 하루의 동선으로 잇는 독립 여행 가이드.",
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

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f2f1ec", colorScheme: "light dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" suppressHydrationWarning><body className={`${notoSans.variable} ${notoSerif.variable}`}>{children}</body></html>;
}
