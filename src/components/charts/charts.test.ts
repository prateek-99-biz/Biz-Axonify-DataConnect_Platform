import { describe, expect, it } from "vitest";
import { categoryLayout } from "./charts";

const MEASURES = ["Participation", "Engagement", "Knowledge", "Max Adoption", "Broadcast Reach", "Features in Use"];

describe("categoryLayout", () => {
  it("keeps names level on a wide chart, one line each", () => {
    const l = categoryLayout(MEASURES, 900);
    expect(l.tilt).toBe(false);
    expect(l.height).toBe(27);
  });

  it("wraps names onto more lines when the words still fit their slot", () => {
    const l = categoryLayout(MEASURES, 540); // 90 pixels a group: "Broadcast Reach" splits, "Participation" fits
    expect(l.tilt).toBe(false);
    expect(l.height).toBeGreaterThan(27);
  });

  it("tilts the names on a phone, where a single word is wider than its slot", () => {
    const l = categoryLayout(MEASURES, 270); // 45 pixels a group, "Participation" needs about 80
    expect(l.tilt).toBe(true);
    expect(l.height).toBeGreaterThan(60);
  });

  it("uses the plain one-line axis before the chart knows its width", () => {
    expect(categoryLayout(MEASURES, 0)).toEqual({ tilt: false, slot: Infinity, height: 30 });
  });
});
