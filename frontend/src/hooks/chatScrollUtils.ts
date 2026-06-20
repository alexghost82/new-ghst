/**
 * Pure helpers for the chat auto-scroll behavior. Extracted from
 * ``MessageList`` so the (deliberately subtle) pin/disengage logic is
 * specified and unit-tested in isolation — the component/hook becomes thin
 * wiring around these functions, with identical runtime behavior.
 */

/** Distance (px) from the bottom below which we consider the view "at bottom". */
export const SCROLL_BOTTOM_THRESHOLD = 120;

/**
 * Minimum upward delta (px) that counts as a *deliberate* user scroll-up.
 * Programmatic bottom-pinning only ever increases scrollTop, so it can never
 * be mistaken for a user scroll-up.
 */
export const SCROLL_UP_EPSILON = 2;

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function distanceToBottom(m: ScrollMetrics): number {
  return m.scrollHeight - m.scrollTop - m.clientHeight;
}

export function isAtBottom(
  m: ScrollMetrics,
  threshold: number = SCROLL_BOTTOM_THRESHOLD,
): boolean {
  return distanceToBottom(m) < threshold;
}

/**
 * True when the user scrolled up by more than {@link SCROLL_UP_EPSILON}.
 * ``currentTop < prevTop - epsilon``.
 */
export function detectUserScrollUp(
  prevTop: number,
  currentTop: number,
  epsilon: number = SCROLL_UP_EPSILON,
): boolean {
  return currentTop < prevTop - epsilon;
}

export interface ScrollResolution {
  showJumpButton: boolean;
  autoScroll: boolean;
}

/**
 * Given the previous auto-scroll state, the current scroll metrics and the
 * last observed scrollTop, compute the next jump-button + auto-scroll state.
 *
 * Mirrors ``MessageList.checkScroll`` exactly:
 *  - the jump button shows whenever the view is not at the bottom;
 *  - only a deliberate user up-scroll disengages auto-scroll;
 *  - reaching the bottom re-arms auto-scroll;
 *  - otherwise auto-scroll is left unchanged.
 */
export function resolveScrollState(
  prevAutoScroll: boolean,
  metrics: ScrollMetrics,
  lastScrollTop: number,
  threshold: number = SCROLL_BOTTOM_THRESHOLD,
  epsilon: number = SCROLL_UP_EPSILON,
): ScrollResolution {
  const atBottom = isAtBottom(metrics, threshold);
  const scrolledUp = detectUserScrollUp(
    lastScrollTop,
    metrics.scrollTop,
    epsilon,
  );

  let autoScroll = prevAutoScroll;
  if (scrolledUp && !atBottom) {
    autoScroll = false;
  } else if (atBottom) {
    autoScroll = true;
  }

  return { showJumpButton: !atBottom, autoScroll };
}

/**
 * Whether the view should be pinned to the bottom on a render. A brand-new
 * user message always pins; otherwise we only pin while auto-scroll is engaged.
 */
export function shouldPinToBottom(opts: {
  autoScroll: boolean;
  isNewUserMessage: boolean;
}): boolean {
  return opts.autoScroll || opts.isNewUserMessage;
}

/**
 * A brand-new user message glides smoothly; streaming token growth pins
 * instantly ("auto") so the snap can never lag behind the growing height.
 */
export function pickScrollBehavior(opts: {
  isNewUserMessage: boolean;
}): ScrollBehavior {
  return opts.isNewUserMessage ? "smooth" : "auto";
}
