"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Turn = { role: "agent" | "caller"; text: string };
type Phase = "idle" | "agent" | "listening" | "thinking" | "ending" | "done";

/* eslint-disable @typescript-eslint/no-explicit-any */
function getRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = "en-IN";
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  return r;
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-IN" && /female|heera|neerja|veena/i.test(v.name)) ??
    voices.find((v) => v.lang === "en-IN") ??
    voices.find((v) => v.lang.startsWith("en-GB")) ??
    voices.find((v) => v.lang.startsWith("en"))
  );
}

function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

export function TalkClient() {
  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const startedAt = useRef<string>("");
  const activeRef = useRef(false);
  const recRef = useRef<any>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupported(!!getRecognition() && "speechSynthesis" in window);
    window.speechSynthesis?.getVoices(); // warm up voice list
    return () => { activeRef.current = false; recRef.current?.abort?.(); window.speechSynthesis?.cancel(); };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, interim]);

  function push(t: Turn) {
    turnsRef.current = [...turnsRef.current, t];
    setTurns(turnsRef.current);
  }

  async function agentSays(): Promise<boolean> {
    setPhase("thinking");
    const res = await fetch("/api/talk/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ turns: turnsRef.current }),
    });
    const j = await res.json();
    push({ role: "agent", text: j.text });
    setPhase("agent");
    await speak(j.text);
    return !!j.end;
  }

  function listenOnce(): Promise<string> {
    return new Promise((resolve) => {
      const rec = getRecognition();
      recRef.current = rec;
      let finalText = "";
      rec.onresult = (e: any) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText = text;
        }
        setInterim(text);
      };
      rec.onerror = () => {};
      rec.onend = () => { setInterim(""); resolve(finalText.trim()); };
      setPhase("listening");
      rec.start();
    });
  }

  async function startCall() {
    setResult(null);
    turnsRef.current = [];
    setTurns([]);
    startedAt.current = new Date().toISOString();
    activeRef.current = true;
    let end = await agentSays();
    let silent = 0;
    while (activeRef.current && !end) {
      const said = await listenOnce();
      if (!activeRef.current) break;
      if (!said) {
        silent++;
        if (silent >= 3) break;
        continue;
      }
      silent = 0;
      push({ role: "caller", text: said });
      end = await agentSays();
    }
    if (activeRef.current) await finishCall();
  }

  async function finishCall() {
    activeRef.current = false;
    recRef.current?.abort?.();
    window.speechSynthesis.cancel();
    setInterim("");
    if (!turnsRef.current.some((t) => t.role === "caller")) {
      setPhase("idle");
      setResult({ ok: false, text: "Call ended before you said anything — nothing was saved." });
      return;
    }
    setPhase("ending");
    try {
      const res = await fetch("/api/talk/end", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turns: turnsRef.current, startedAt: startedAt.current }),
      });
      const j = await res.json();
      setResult(
        j.ok
          ? {
              ok: true,
              text: `${j.status === "qualified" ? "Qualified lead" : j.status === "unqualified" ? "Unqualified lead" : "Needs review"} — ${j.reason ?? ""}${j.designer ? ` · assigned to ${j.designer}` : ""}${j.booking ? " · consultation booked" : ""}`,
            }
          : { ok: false, text: j.error ?? "Could not save the call." },
      );
    } catch (e) {
      setResult({ ok: false, text: String(e) });
    }
    setPhase("done");
  }

  const live = phase === "agent" || phase === "listening" || phase === "thinking";
  const status: Record<Phase, string> = {
    idle: "Ready when you are",
    agent: "Receptionist is speaking…",
    listening: "Listening — go ahead",
    thinking: "Thinking…",
    ending: "Saving the call and running the pipeline…",
    done: "Call ended",
  };

  if (!supported) {
    return (
      <div className="glass panel talk-card">
        <h2>Voice isn&apos;t available in this browser</h2>
        <p className="sub" style={{ margin: 0 }}>Open this page in Google Chrome or Microsoft Edge on a laptop and allow the microphone.</p>
      </div>
    );
  }

  return (
    <div className="glass panel talk-card">
      <div className="talk-head">
        <div>
          <h2 style={{ marginBottom: 2 }}>Talk to the receptionist</h2>
          <p className="sub" style={{ margin: 0 }}>Free browser call · same agent script as the phone line</p>
        </div>
        <Link href="/" className="talk-back">← Dashboard</Link>
      </div>

      <div className={`orb ${phase}`} aria-hidden="true"><span /></div>
      <p className="talk-status" role="status">{status[phase]}</p>

      <div className="talk-actions">
        {!live && phase !== "ending" && (
          <button className="btn-primary" onClick={startCall}>{phase === "done" ? "Call again" : "Start call"}</button>
        )}
        {live && <button className="btn-end" onClick={finishCall}>End call</button>}
      </div>

      {result && (
        <div className={`talk-result ${result.ok ? "ok" : "err"}`}>
          <b>{result.ok ? "Saved to dashboard" : "Not saved"}</b> {result.text}
          {result.ok && <> · <Link href="/">View dashboard</Link></>}
        </div>
      )}

      <div className="talk-log" ref={logRef} aria-live="polite">
        {turns.length === 0 && !interim && (
          <p className="empty">Click <b>Start call</b>, allow the microphone, and talk like a customer — name, area, space, size, budget, timeline. Try asking for a price.</p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>
            <span className="who">{t.role === "agent" ? "Receptionist" : "You"}</span>
            {t.text}
          </div>
        ))}
        {interim && <div className="bubble caller interim"><span className="who">You</span>{interim}</div>}
      </div>
    </div>
  );
}
