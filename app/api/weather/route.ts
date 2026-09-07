import { getWeatherSnapshot } from "../../../lib/providers";

export async function GET() {
  const data = await getWeatherSnapshot();
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
