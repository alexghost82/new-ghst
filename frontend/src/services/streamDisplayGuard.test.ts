import { describe, it, expect } from "vitest";
import { getSafeStreamingDisplay } from "./streamDisplayGuard";
import { GHOST_REFUSAL_MSG_HE, GHOST_REFUSAL_MSG_EN } from "../utils/sanitize";

describe("getSafeStreamingDisplay", () => {
  it("returns empty input unchanged", () => {
    expect(getSafeStreamingDisplay("", "he")).toBe("");
    expect(getSafeStreamingDisplay("", "en")).toBe("");
  });

  it("passes clean text through with no latency (full reveal)", () => {
    const clean =
      "Two people are standing near the loading dock; one is holding a clipboard.";
    expect(getSafeStreamingDisplay(clean, "en")).toBe(clean);
  });

  it("passes clean long text through unchanged", () => {
    const long = "The scene is clear. ".repeat(60);
    expect(getSafeStreamingDisplay(long, "en")).toBe(long);
  });

  it("replaces a complete English refusal with the Ghost message", () => {
    const refusal = "I'm sorry, but I can't assist with that request.";
    expect(getSafeStreamingDisplay(refusal, "en")).toBe(GHOST_REFUSAL_MSG_EN);
  });

  it("replaces a complete Hebrew refusal with the Ghost message", () => {
    const refusal = "אני לא יכול לעזור עם זה.";
    expect(getSafeStreamingDisplay(refusal, "he")).toBe(GHOST_REFUSAL_MSG_HE);
  });

  it("replaces an 'as an AI' identity-leak refusal", () => {
    const refusal = "As an AI language model, I cannot do that.";
    expect(getSafeStreamingDisplay(refusal, "en")).toBe(GHOST_REFUSAL_MSG_EN);
  });

  it("withholds a partial refusal opener still being streamed", () => {
    // "I'm so" is a prefix of the opener "i'm sorry" — must not be shown yet.
    const partial = "Here is the scene. I'm so";
    expect(getSafeStreamingDisplay(partial, "en")).toBe("Here is the scene. ");
  });

  it("withholds a full opener fragment before the pattern completes", () => {
    // Opener present but not yet a complete refusal pattern → hide from opener.
    const midRefusal = "Sure. I cannot";
    expect(getSafeStreamingDisplay(midRefusal, "en")).toBe("Sure. ");
  });

  it("withholds a partial Hebrew opener at the tail", () => {
    const partial = "הנה מה שרואים. אני לא יכ";
    expect(getSafeStreamingDisplay(partial, "he")).toBe("הנה מה שרואים. ");
  });

  it("reveals text up to a suspicious tail, never past it", () => {
    const partial = "All clear at gate 3. Unfortunate";
    const out = getSafeStreamingDisplay(partial, "en");
    expect(out).toBe("All clear at gate 3. ");
    expect(out.length).toBeLessThan(partial.length);
  });
});
