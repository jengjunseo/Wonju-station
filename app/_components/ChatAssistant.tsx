"use client";

import { useEffect, useRef, useState } from "react";

type ChatSource = { label: string; url: string; fetchedAt: string | null };
type Message = { role: "user" | "assistant"; text: string; sources?: ChatSource[]; mode?: string };

const FIRST_GREETING = "안녕하세요🔥🔥 치악산에서 날아온 꿩 꽁드리입니다! 원주에 대해 궁금한 게 있으면 무엇이든 말씀해주세요! 아니면 저랑 재밌는 이야기라도 하실래요? ✨✨";

function sourceTime(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });
}

export default function ChatAssistant({ onClose }: { onClose: () => void }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/chat", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ available?: boolean; message?: string | null }>)
      .then((data) => {
        if (!active) return;
        setAvailable(Boolean(data.available));
        if (!data.available && data.message) setMessages([{ role: "assistant", text: data.message }]);
      })
      .catch(() => { if (active) { setAvailable(false); setMessages([{ role: "assistant", text: "AI 챗봇은 아직 사용할 수 없습니다." }]); } });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = question.replace(/\s+/g, " ").trim();
    if (!clean || clean.length > 300 || busy || cooldown || !available) return;
    const nextMessages: Message[] = [...messages, { role: "user", text: clean }];
    setMessages(nextMessages);
    setQuestion("");
    setBusy(true);
    setCooldown(true);
    window.setTimeout(() => setCooldown(false), 1_500);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean, history: messages.slice(-4).map(({ role, text }) => ({ role, text })) }),
      });
      const data = await response.json() as { available?: boolean; message?: string; sources?: ChatSource[]; mode?: string };
      if (!response.ok && response.status === 503 && data.available === false) setAvailable(false);
      setMessages((current) => [...current, { role: "assistant", text: data.message ?? "답변을 확인하지 못했어요.", sources: data.sources, mode: data.mode }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "AI 챗봇은 아직 사용할 수 없습니다." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title">
      <header><div><span>GROUNDED ASSISTANT</span><h2 id="chat-title">원주 AI 꽁드리</h2></div><button onClick={onClose} aria-label="AI 챗봇 닫기">×</button></header>
      <div className="chat-trust"><i /> 답변 근거는 본문과 분리해 표시합니다.</div>
      <div className="chat-messages" aria-live="polite">
        {available === null ? <p className="chat-system">챗봇 상태를 확인하고 있어요.</p> : null}
        {available && !messages.length ? <p className="chat-system">{FIRST_GREETING}</p> : null}
        {messages.map((message, index) => message.role === "user" ? (
          <p className="chat-message chat-message--user" key={`${message.role}-${index}`}>{message.text}</p>
        ) : (
          <div className="chat-message chat-message--assistant" key={`${message.role}-${index}`}>
            {message.text}
            {message.sources?.length ? <small><br />{message.mode === "WONJU_WEB" ? "웹 검색 근거" : "WONJU STATION 근거"}<br />{message.sources.map((item, sourceIndex) => {
              const checkedAt = sourceTime(item.fetchedAt);
              return <span key={`${item.url}-${sourceIndex}`}><a href={item.url} target="_blank" rel="noreferrer">{item.label}</a>{checkedAt ? ` · ${checkedAt}` : ""}{sourceIndex < (message.sources?.length ?? 0) - 1 ? <br /> : null}</span>;
            })}</small> : null}
          </div>
        ))}
        {busy ? <p className="chat-system">꽁드리가 확인 중이에요…</p> : null}
      </div>
      <form onSubmit={submit}>
        <label htmlFor="chat-question">원주 정보 질문</label>
        <input ref={inputRef} id="chat-question" value={question} onChange={(event) => setQuestion(event.target.value.slice(0, 300))} placeholder={available ? "원주에 대해 물어봐!" : "현재 사용할 수 없습니다"} disabled={!available || busy} maxLength={300} autoComplete="off" />
        <button type="submit" disabled={!available || busy || cooldown || !question.trim()} aria-label="질문 보내기">→</button>
      </form>
      <small>대화는 저장하지 않으며, 답변은 제공자 상태에 따라 제한될 수 있습니다.</small>
    </section>
  );
}
