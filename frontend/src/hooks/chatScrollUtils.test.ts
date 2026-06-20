import { describe, it, expect } from "vitest";
import {
  distanceToBottom,
  isAtBottom,
  detectUserScrollUp,
  resolveScrollState,
  shouldPinToBottom,
  pickScrollBehavior,
  SCROLL_BOTTOM_THRESHOLD,
} from "./chatScrollUtils";

describe("distanceToBottom / isAtBottom", () => {
  it("computes the remaining distance to the bottom", () => {
    expect(
      distanceToBottom({ scrollTop: 100, scrollHeight: 1000, clientHeight: 800 }),
    ).toBe(100);
  });

  it("treats a small remaining distance as 'at bottom'", () => {
    expect(
      isAtBottom({ scrollTop: 110, scrollHeight: 1000, clientHeight: 800 }),
    ).toBe(true); // distance 90 < 120
  });

  it("treats a large remaining distance as not at bottom", () => {
    expect(
      isAtBottom({ scrollTop: 0, scrollHeight: 1000, clientHeight: 800 }),
    ).toBe(false); // distance 200 >= 120
  });
});

describe("detectUserScrollUp", () => {
  it("flags a deliberate up-scroll beyond the epsilon", () => {
    expect(detectUserScrollUp(500, 480)).toBe(true);
  });

  it("ignores tiny jitter within the epsilon", () => {
    expect(detectUserScrollUp(500, 499)).toBe(false);
  });

  it("ignores downward movement (programmatic pin)", () => {
    expect(detectUserScrollUp(500, 520)).toBe(false);
  });
});

describe("resolveScrollState", () => {
  it("disengages auto-scroll on a deliberate up-scroll away from bottom", () => {
    const r = resolveScrollState(
      true,
      { scrollTop: 100, scrollHeight: 2000, clientHeight: 800 },
      400, // was lower → moved up
    );
    expect(r.autoScroll).toBe(false);
    expect(r.showJumpButton).toBe(true);
  });

  it("re-arms auto-scroll when the view reaches the bottom", () => {
    const r = resolveScrollState(
      false,
      { scrollTop: 1150, scrollHeight: 2000, clientHeight: 800 }, // distance 50
      1140,
    );
    expect(r.autoScroll).toBe(true);
    expect(r.showJumpButton).toBe(false);
  });

  it("does NOT disengage on programmatic downward pin (scrollTop increased)", () => {
    const r = resolveScrollState(
      true,
      { scrollTop: 900, scrollHeight: 2000, clientHeight: 800 }, // distance 300, not bottom
      850, // previous lower → moved DOWN, not a user up-scroll
    );
    expect(r.autoScroll).toBe(true); // unchanged
    expect(r.showJumpButton).toBe(true);
  });

  it("leaves auto-scroll unchanged when neither scrolled up nor at bottom", () => {
    const rTrue = resolveScrollState(
      true,
      { scrollTop: 900, scrollHeight: 2000, clientHeight: 800 },
      900, // no movement
    );
    expect(rTrue.autoScroll).toBe(true);
    const rFalse = resolveScrollState(
      false,
      { scrollTop: 900, scrollHeight: 2000, clientHeight: 800 },
      900,
    );
    expect(rFalse.autoScroll).toBe(false);
  });
});

describe("shouldPinToBottom / pickScrollBehavior", () => {
  it("always pins for a brand-new user message", () => {
    expect(
      shouldPinToBottom({ autoScroll: false, isNewUserMessage: true }),
    ).toBe(true);
  });

  it("pins while auto-scroll is engaged", () => {
    expect(
      shouldPinToBottom({ autoScroll: true, isNewUserMessage: false }),
    ).toBe(true);
  });

  it("does not pin when auto-scroll off and no new user message", () => {
    expect(
      shouldPinToBottom({ autoScroll: false, isNewUserMessage: false }),
    ).toBe(false);
  });

  it("glides smoothly for a new user message, instant otherwise", () => {
    expect(pickScrollBehavior({ isNewUserMessage: true })).toBe("smooth");
    expect(pickScrollBehavior({ isNewUserMessage: false })).toBe("auto");
  });

  it("exposes the calibrated bottom threshold", () => {
    expect(SCROLL_BOTTOM_THRESHOLD).toBe(120);
  });
});
