import { fetchNotices } from "../../../lib/providers";

export async function GET() {
  const notices = await fetchNotices();
  return Response.json(notices, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } });
}
