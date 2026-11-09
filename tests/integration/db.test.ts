import { test, expect } from "vitest";
import { resetDb, makeItem } from "./helpers";

test("helpers create data", async () => {
  await resetDb();
  const item = await makeItem({ kind: "SERIALIZED", assets: ["NB-1", "NB-2"] });
  expect(item.assets).toHaveLength(2);
});
