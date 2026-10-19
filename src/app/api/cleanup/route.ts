import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Called daily by Vercel Cron (see vercel.json). Deleting old rooms keeps the
// database small and means it sees regular activity even when nobody is playing.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const cutoff = Date.now() - MAX_AGE_MS;
  const stale = await adminDb().ref("rooms").orderByChild("createdAt").endAt(cutoff).get();

  const updates: Record<string, null> = {};
  stale.forEach((room) => {
    if (room.key) updates[room.key] = null;
  });
  if (Object.keys(updates).length) await adminDb().ref("rooms").update(updates);

  return NextResponse.json({ deleted: Object.keys(updates).length });
}
