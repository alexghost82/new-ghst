/**
 * Tiny per-conversation timestamp tracker shared between :mod:`alertEngine`
 * (which stamps the moment a scan iteration starts) and :mod:`alertStore`
 * (which reads the timestamp when the matching SSE ``alert_event`` arrives).
 *
 * The delta is the *perceived* end-to-end latency from the camera snapshot
 * leaving the browser to the alert overlay appearing on screen — exactly
 * the number the operator cares about and the budget the system is
 * tuned against (<=1.8s from frame sample to the flashing overlay).
 *
 * Values are intentionally cleared after read so a single SSE delivery
 * never accidentally attributes itself to a stale prior scan.
 */

const _starts = new Map<string, number>();

export function setLastScanStart(
  conversationId: string,
  startedAt: number = performance.now(),
): void {
  _starts.set(conversationId, startedAt);
}

export function consumeLastScanStart(
  conversationId: string,
): number | null {
  const value = _starts.get(conversationId);
  if (value === undefined) return null;
  _starts.delete(conversationId);
  return value;
}

export function clearLastScanStart(conversationId: string): void {
  _starts.delete(conversationId);
}
