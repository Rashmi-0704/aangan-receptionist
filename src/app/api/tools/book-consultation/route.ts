import { NextResponse } from "next/server";
import { bookConsultation } from "@/lib/calcom";
import { recordBooking } from "@/lib/pipeline";
import { formatIst } from "@/lib/time";
import { toolAuthorized } from "@/lib/tool-auth";

export const runtime = "nodejs";

// Mid-call tool for the voice agent. Body: { start, name, email, phone?, call_id? }
export async function POST(req: Request) {
  if (!toolAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.start || !b.name || !b.email) {
    return NextResponse.json({ booked: false, message: "Need start, name and email." }, { status: 400 });
  }
  try {
    const booking = await bookConsultation({ start: b.start, name: b.name, email: b.email, phone: b.phone });
    await recordBooking(booking, b.phone ?? null, b.call_id);
    return NextResponse.json({ booked: true, start: booking.start, spoken: formatIst(booking.start) });
  } catch (e) {
    console.error("[tools/book-consultation]", e);
    return NextResponse.json({ booked: false, message: "Booking failed. Offer a callback from the team instead." });
  }
}
