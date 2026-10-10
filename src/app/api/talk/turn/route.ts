import { NextResponse } from "next/server";
import { agentReply, greeting, type Turn } from "@/lib/talk";

export const runtime = "nodejs";
export const maxDuration = 30;

// One conversational turn for the browser voice receptionist.
// Body: { turns: Turn[] }  — empty turns returns the opening greeting.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const turns: Turn[] = Array.isArray(body.turns) ? body.turns.slice(-40) : [];
  if (turns.length === 0) return NextResponse.json({ text: greeting(), end: false });
  try {
    return NextResponse.json(await agentReply(turns));
  } catch (e) {
    console.error("[talk/turn]", e);
    return NextResponse.json({ text: "Sorry, I'm having trouble right now. Our team will call you back.", end: true });
  }
}
