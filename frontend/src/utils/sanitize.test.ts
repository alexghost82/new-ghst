import { describe, it, expect } from "vitest";
import {
  sanitizeBrand,
  sanitizeRefusal,
  GHOST_REFUSAL_MSG_HE,
  GHOST_REFUSAL_MSG_EN,
} from "./sanitize";

describe("sanitizeBrand", () => {
  it("replaces OpenAI brand variants with Ghost (case-insensitive)", () => {
    expect(sanitizeBrand("Powered by OpenAI")).toBe("Powered by Ghost");
    expect(sanitizeBrand("open ai key")).toBe("Ghost key");
    expect(sanitizeBrand("OPENAI down")).toBe("Ghost down");
    expect(sanitizeBrand("your openai api key")).toBe("your Ghost api key");
  });

  it("leaves brand-free text untouched", () => {
    expect(sanitizeBrand("Two vehicles at the gate")).toBe(
      "Two vehicles at the gate",
    );
  });

  it("coerces non-string input defensively", () => {
    expect(sanitizeBrand(null)).toBe("");
    expect(sanitizeBrand(undefined)).toBe("");
    expect(sanitizeBrand(42)).toBe("42");
  });
});

describe("sanitizeRefusal — English patterns", () => {
  const cases: string[] = [
    "I'm sorry, but I can't assist with that.",
    "I cannot assist with that request.",
    "I won't help with that.",
    "I'm not able to help with this.",
    "Unfortunately, I cannot do that.",
    "I can't generate content that violates policy.",
    "This goes against my guidelines.",
    "My usage policy prevents me from doing that.",
    "I apologize, but I am unable to comply.",
    "As an AI language model, I don't have feelings.",
  ];

  it.each(cases)("flags and replaces: %s", (text) => {
    expect(sanitizeRefusal(text, "en")).toBe(GHOST_REFUSAL_MSG_EN);
  });
});

describe("sanitizeRefusal — Hebrew patterns", () => {
  const cases: string[] = [
    "אני לא יכול לעזור עם זה.",
    "אני מצטער לעזור עם הבקשה.",
    "כמודל שפה אני מוגבל.",
    "בתור מודל שפה אין לי גישה.",
  ];

  it.each(cases)("flags and replaces: %s", (text) => {
    expect(sanitizeRefusal(text, "he")).toBe(GHOST_REFUSAL_MSG_HE);
  });
});

describe("sanitizeRefusal — clean text", () => {
  it("returns clean English text unchanged", () => {
    const clean = "Two people near the loading dock, one holding a clipboard.";
    expect(sanitizeRefusal(clean, "en")).toBe(clean);
  });

  it("returns clean Hebrew text unchanged", () => {
    const clean = "שני אנשים ליד רציף הפריקה, אחד מחזיק לוח.";
    expect(sanitizeRefusal(clean, "he")).toBe(clean);
  });

  it("returns empty input unchanged", () => {
    expect(sanitizeRefusal("", "he")).toBe("");
  });

  it("does not flag a benign 'I cannot stress enough' phrasing as a refusal", () => {
    // Not a refusal pattern — must pass through unchanged.
    const benign = "I cannot stress enough how clear the scene is.";
    expect(sanitizeRefusal(benign, "en")).toBe(benign);
  });

  it("defaults to the Hebrew replacement when locale is omitted", () => {
    expect(sanitizeRefusal("I cannot assist with that")).toBe(
      GHOST_REFUSAL_MSG_HE,
    );
  });
});
