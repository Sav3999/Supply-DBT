import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

export interface LineClient {
  enabled: boolean;
  push(to: string, text: string): Promise<void>;
  reply(replyToken: string, text: string): Promise<void>;
}

const API = "https://api.line.me/v2/bot/message";

export class HttpLineClient implements LineClient {
  enabled = true;
  constructor(private token: string) {}

  private async post(path: "push" | "reply", body: object): Promise<void> {
    const res = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LINE ${path} failed: ${res.status}`);
  }

  push(to: string, text: string): Promise<void> {
    return this.post("push", { to, messages: [{ type: "text", text }] });
  }

  reply(replyToken: string, text: string): Promise<void> {
    return this.post("reply", { replyToken, messages: [{ type: "text", text }] });
  }
}

export class NoopLineClient implements LineClient {
  enabled = false;
  async push(): Promise<void> {}
  async reply(): Promise<void> {}
}

export class FakeLineClient implements LineClient {
  enabled = true;
  pushed: { to: string; text: string }[] = [];
  replied: { replyToken: string; text: string }[] = [];
  async push(to: string, text: string): Promise<void> {
    this.pushed.push({ to, text });
  }
  async reply(replyToken: string, text: string): Promise<void> {
    this.replied.push({ replyToken, text });
  }
}

export function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature, "base64");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

let client: LineClient | undefined;

export function getLineClient(): LineClient {
  if (!client) {
    const token = getEnv().LINE_CHANNEL_ACCESS_TOKEN;
    client = token ? new HttpLineClient(token) : new NoopLineClient();
  }
  return client;
}

export function setLineClient(c: LineClient): void {
  client = c;
}
