import {
  ambiguousWonjuReply,
  askGemini,
  CHAT_HISTORY_LIMIT,
  CHAT_SEARCH_UNAVAILABLE_MESSAGE,
  CHAT_UNAVAILABLE_MESSAGE,
  CHAT_UNSUPPORTED_MESSAGE,
  chatReply,
  checkGeminiModel,
  GEMINI_MODEL,
  GeminiRequestError,
  isAmbiguousWonjuQuestion,
  outOfScopeReply,
  routeChatQuestion,
  selectGroundedContext,
  validateChatInput,
  type ChatTurn,
} from "../../../lib/chat";
import { getCitySnapshot } from "../../../lib/providers";

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
  if (!key) return Response.json({ available: false, message: CHAT_UNAVAILABLE_MESSAGE }, { status: 503, headers: { "Cache-Control": "no-store" } });
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
  if (mode === "CHAT") {
    return Response.json({ available: true, mode, searchUsed: false, message: chatReply(question), sources: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!await checkGeminiModel(key)) return Response.json({ available: false, mode, searchUsed: false, message: CHAT_UNAVAILABLE_MESSAGE, sources: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });

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
    console.error("Chat request failed", mode, providerStatus ?? "UNKNOWN");
    if (mode === "WONJU_WEB" && providerStatus === 429) {
      return Response.json({ available: true, mode, searchUsed: false, message: CHAT_SEARCH_UNAVAILABLE_MESSAGE, sources: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ available: false, mode, searchUsed: false, message: CHAT_UNAVAILABLE_MESSAGE, sources: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
