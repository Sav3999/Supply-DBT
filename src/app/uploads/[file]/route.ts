import { readFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";

const NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!NAME.test(file)) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(path.join(getEnv().UPLOAD_DIR, file));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": TYPES[file.split(".")[1]],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
