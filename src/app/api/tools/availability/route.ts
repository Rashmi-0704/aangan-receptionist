import { NextResponse } from "next/server";
import { getSlots } from "@/lib/calcom";
import { formatIst } from "@/lib/time";
import { toolAuthorized } from "@/lib/tool-auth";

export const runtime = "nodejs";

// Mid-call tool for the voice agent: next available consultation slots.
export async function POST(req: Request) {
  if (!toolAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const slots = (await getSlots()).slice(0, 5);
    return NextResponse.json({ slots: slots.map((start) => ({ start, spoken: formatIst(start) })) });
  } catch (e) {
    console.error("[tools/availability]", e);
    return NextResponse.json({ slots: [], message: "Couldn't check the calendar. Offer a callback from the team instead." });
  }
}
