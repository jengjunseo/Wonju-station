"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; text: string };

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
      .catch(() => { if (active) { setAvailable(false); setMessages([{ role: "assistant", text: "AI 챗봇을 아직 사용할 수 없습니다." }]); } });
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
        body: JSON.stringify({ question: clean, history: messages.slice(-4) }),
      });
      const data = await response.json() as { available?: boolean; message?: string };
      if (!response.ok && response.status === 503) setAvailable(false);
      setMessages((current) => [...current, { role: "assistant", text: data.message ?? "답변을 확인하지 못했습니다." }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "AI 챗봇을 아직 사용할 수 없습니다." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title">
      <header><div><span>GROUNDED ASSISTANT</span><h2 id="chat-title">원주시 AI 챗봇</h2></div><button onClick={onClose} aria-label="AI 챗봇 닫기">×</button></header>
      <div className="chat-trust"><i /> WONJU STATION이 확인한 정보만 답합니다.</div>
      <div className="chat-messages" aria-live="polite">
        {available === null ? <p className="chat-system">챗봇 상태를 확인하고 있어요.</p> : null}
        {available && !messages.length ? <p className="chat-system">날씨, 특보, 대기질, 최근 소식, 인구를 물어보세요.</p> : null}
        {messages.map((message, index) => <p className={`chat-message chat-message--${message.role}`} key={`${message.role}-${index}`}>{message.text}</p>)}
        {busy ? <p className="chat-system">확인된 정보를 바탕으로 답변 중…</p> : null}
      </div>
      <form onSubmit={submit}>
        <label htmlFor="chat-question">원주 정보 질문</label>
        <input ref={inputRef} id="chat-question" value={question} onChange={(event) => setQuestion(event.target.value.slice(0, 300))} placeholder={available ? "오늘 원주 날씨 어때?" : "현재 사용할 수 없습니다"} disabled={!available || busy} maxLength={300} autoComplete="off" />
        <button type="submit" disabled={!available || busy || cooldown || !question.trim()} aria-label="질문 보내기">→</button>
      </form>
      <small>대화는 저장하지 않으며, 답변은 제공자 상태에 따라 제한될 수 있습니다.</small>
    </section>
  );
}
