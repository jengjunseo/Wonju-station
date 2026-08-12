import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WONJU STATION",
    short_name: "WONJU",
    description: "원주의 모든 것, 지금 여기.",
    start_url: "/",
    display: "standalone",
    background_color: "#101311",
    theme_color: "#101311",
    lang: "ko-KR",
    icons: [{ src: "/og.png", sizes: "1200x630", type: "image/png", purpose: "any" }],
  };
}

export const dynamic = "force-static";

