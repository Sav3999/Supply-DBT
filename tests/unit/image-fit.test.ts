import { describe, expect, test } from "vitest";
import { fitWithin } from "@/lib/image-fit";

describe("fitWithin", () => {
  test("keeps small images unchanged", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600, scaled: false });
  });

  test("scales a large landscape photo so the long side is the limit", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200, scaled: true });
  });

  test("scales a large portrait photo", () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600, scaled: true });
  });
});
