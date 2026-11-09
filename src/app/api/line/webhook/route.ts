import { verifySignature } from "@/server/line/client";
import { handleLineEvent, type LineEvent } from "@/server/line/link";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  // อ่านจาก process.env ตรง ๆ เพราะ getEnv() แคชค่าไว้
  const secret = process.env.LINE_CHANNEL_SECRET ?? "";
  const signature = req.headers.get("x-line-signature");
  const raw = await req.text();
  if (!secret || !signature || !verifySignature(raw, signature, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    const body = JSON.parse(raw) as { events?: LineEvent[] };
    if (Array.isArray(body.events)) events = body.events;
  } catch {
    return Response.json({ ok: true });
  }
  for (const event of events) {
    try {
      await handleLineEvent(event);
    } catch (e) {
      console.error("LINE webhook event failed", e);
    }
  }
  return Response.json({ ok: true });
}
