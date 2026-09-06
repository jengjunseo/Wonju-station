import { searchWonjuPlaces } from "../../../lib/providers";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (!query) return Response.json({ status: "UNAVAILABLE", detail: "검색어를 입력해 주세요.", places: [] }, { status: 400 });
  const result = await searchWonjuPlaces(query);
  return Response.json(result, { headers: { "Cache-Control": "private, max-age=60" } });
}
