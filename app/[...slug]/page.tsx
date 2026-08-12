import type { Metadata } from "next";
import { StationApp } from "../_components/StationApp";

type Props = { params: Promise<{ slug: string[] }> };

const titles: Record<string, string> = {
  news: "원주 뉴스", weather: "원주 날씨", map: "원주 라이브 맵", events: "원주 행사",
  city: "원주 도시 정보", history: "원주 아카이브", discover: "주말 탐색", air: "원주 대기질",
  transport: "원주 교통", stats: "원주 통계", population: "원주 인구", projects: "WONJU NEXT",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug[0] === "place" && slug[1]) return { title: `${decodeURIComponent(slug[1])} 동네 대시보드` };
  return titles[slug[0]] ? { title: titles[slug[0]] } : { title: { absolute: "WONJU STATION" } };
}

export default async function CatchAllPage({ params }: Props) {
  const { slug } = await params;
  return <StationApp route={`/${slug.join("/")}`} />;
}
