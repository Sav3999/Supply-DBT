import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL, auditActionLabel, auditEntityLabel } from "@/lib/labels";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith(".ts") ? [p] : [];
  });
}

const serverSource = sourceFiles(join(process.cwd(), "src/server"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

describe("audit labels", () => {
  it("has a Thai name for every audit action written by the server", () => {
    const codes = new Set(
      [...serverSource.matchAll(/"((?:LOAN|ITEM|ASSET|CATEGORY|USER)_[A-Z_]+)"/g)].map((m) => m[1]),
    );
    expect(codes.size).toBeGreaterThan(10);
    const missing = [...codes].filter((c) => !(c in AUDIT_ACTION_LABEL));
    expect(missing).toEqual([]);
  });

  it("has a Thai name for every audit entity written by the server", () => {
    const entities = new Set([...serverSource.matchAll(/entity: "([A-Za-z]+)"/g)].map((m) => m[1]));
    const missing = [...entities].filter((e) => !(e in AUDIT_ENTITY_LABEL));
    expect(missing).toEqual([]);
  });

  it("uses glossary words and falls back to the raw code", () => {
    expect(auditActionLabel("LOAN_REJECT")).toBe("ปฏิเสธคำขอยืม");
    expect(auditEntityLabel("Asset")).toBe("ครุภัณฑ์");
    expect(auditActionLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(auditEntityLabel("Other")).toBe("Other");
  });
});
