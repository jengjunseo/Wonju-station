import {
  ambiguousWonjuReply,
  askGemini,
  CHAT_HISTORY_LIMIT,
  CHAT_SEARCH_UNAVAILABLE_MESSAGE,
  CHAT_UNAVAILABLE_MESSAGE,
  CHAT_UNSUPPORTED_MESSAGE,
  checkGeminiModel,
  GEMINI_MODEL,
  GeminiRequestError,
  isAmbiguousWonjuQuestion,
  modelForMode,
  outOfScopeReply,
  routeChatQuestion,
  selectGroundedContext,
  validateChatInput,
  webProviderFailure,
  type ChatTurn,
} from "../../../lib/chat";
import { getCitySnapshot, searchWonjuPlaces } from "../../../lib/providers";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function clientId(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
}

function rateLimited(request: Request): boolean {
  const id = clientId(request);
  const now = Date.now();
  if (rateBuckets.size > 1_000) for (const [key, value] of rateBuckets) if (value.resetAt <= now) rateBuckets.delete(key);
  const bucket = rateBuckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(id, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

function apiKey(): string | null {
  const value = typeof process !== "undefined" ? process.env.GEMINI_API_KEY?.trim() : undefined;
  return value || null;
}

export async function GET() {
  const key = apiKey();
  const available = key ? await checkGeminiModel(key) : false;
  return Response.json({ available, model: GEMINI_MODEL, message: available ? null : CHAT_UNAVAILABLE_MESSAGE }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const key = apiKey();
  if (rateLimited(request)) return Response.json({ available: true, message: "잠시 후 다시 질문해 주세요." }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  let body: { question?: unknown; history?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ available: true, message: "질문 형식을 확인해 주세요." }, { status: 400 }); }
  const question = validateChatInput(body.question);
  if (!question) return Response.json({ available: true, message: "질문은 1자 이상 300자 이하로 입력해 주세요." }, { status: 400 });
  const history = Array.isArray(body.history) ? body.history.slice(-CHAT_HISTORY_LIMIT).flatMap((turn): ChatTurn[] => {
    if (!turn || typeof turn !== "object") return [];
    const candidate = turn as { role?: unknown; text?: unknown };
    const text = validateChatInput(candidate.text);
    return (candidate.role === "user" || candidate.role === "assistant") && text ? [{ role: candidate.role, text }] : [];
  }) : [];

  const mode = routeChatQuestion(question);
  if (mode === "OUT_OF_SCOPE") {
    return Response.json({ available: true, mode, searchUsed: false, message: outOfScopeReply(question), sources: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  if (mode === "CHAT" && isAmbiguousWonjuQuestion(question)) {
    return Response.json({ available: true, mode, searchUsed: false, message: ambiguousWonjuReply(), sources: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  if (mode === "WONJU_PLACE") {
    const result = await searchWonjuPlaces(question);
    const message = result.status === "UNAVAILABLE"
      ? "지금 카카오 장소 검색을 확인할 수 없어요. 잠시 뒤 다시 찾아볼래? 🐦"
      : result.places.length
        ? `카카오 장소 검색에서 원주로 확인되는 곳 ${result.places.length}군데 가져왔어요~ 🐦`
        : "카카오 장소 검색에서 조건에 맞는 원주 장소를 찾지 못했어요~ 🐦";
    return Response.json({
      available: true,
      mode,
      searchUsed: false,
      message,
      places: result.places,
      sources: result.status === "LIVE" ? [{ label: result.provider, url: result.sourceUrl, fetchedAt: result.fetchedAt }] : [],
      provider: { name: result.provider, status: result.status, detail: result.detail },
    }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!key) return Response.json({ available: false, mode, searchUsed: false, message: CHAT_UNAVAILABLE_MESSAGE, sources: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!await checkGeminiModel(key, modelForMode(mode))) {
    const message = mode === "WONJU_WEB" ? CHAT_SEARCH_UNAVAILABLE_MESSAGE : CHAT_UNAVAILABLE_MESSAGE;
    return Response.json({ available: mode === "WONJU_WEB", mode, searchUsed: false, message, sources: [], provider: { name: modelForMode(mode), status: "UNAVAILABLE" } }, { status: mode === "WONJU_WEB" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  }

  const context = mode === "STATION" ? selectGroundedContext(question, await getCitySnapshot()) : null;
  if (mode === "STATION" && !context) {
    return Response.json({ available: true, mode, searchUsed: false, message: CHAT_UNSUPPORTED_MESSAGE, sources: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const answer = await askGemini(question, context, history, key, mode);
    const sources = mode === "STATION" ? context?.sources ?? [] : answer.sources;
    return Response.json({ available: true, mode, searchUsed: answer.searchUsed, message: answer.message, sources }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const providerStatus = error instanceof GeminiRequestError ? error.status : null;
    if (mode === "WONJU_WEB") {
      return Response.json({
        available: true,
        mode,
        searchUsed: false,
        message: CHAT_SEARCH_UNAVAILABLE_MESSAGE,
        sources: [],
        provider: webProviderFailure(providerStatus),
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ available: false, mode, searchUsed: false, message: CHAT_UNAVAILABLE_MESSAGE, sources: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
