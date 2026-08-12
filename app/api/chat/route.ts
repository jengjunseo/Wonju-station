import { askGemini, CHAT_HISTORY_LIMIT, CHAT_UNAVAILABLE_MESSAGE, CHAT_UNSUPPORTED_MESSAGE, checkGeminiModel, GEMINI_MODEL, selectGroundedContext, validateChatInput, type ChatTurn } from "../../../lib/chat";
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
  if (!key || !await checkGeminiModel(key)) return Response.json({ available: false, message: CHAT_UNAVAILABLE_MESSAGE }, { status: 503, headers: { "Cache-Control": "no-store" } });
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
  const snapshot = await getCitySnapshot();
  const context = selectGroundedContext(question, snapshot);
  if (!context) return Response.json({ available: true, message: CHAT_UNSUPPORTED_MESSAGE, sources: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const message = await askGemini(question, context, history, key);
    return Response.json({ available: true, message, sources: context.sources }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ available: false, message: CHAT_UNAVAILABLE_MESSAGE }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
