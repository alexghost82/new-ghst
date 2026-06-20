// ---------------------------------------------------------------------------
// Shared demo / trial settings (NON-SECRET).
//
// A single pre-seeded Ghost agent ("ghostdemo") powers BOTH entry points:
//   1. The hidden 8+0 chord on the login screen (admin).
//   2. The public "Talk to Ghost" 8-minute guided trial.
//
// SECURITY: the shared demo OpenAI API key and the GM authorization code are
// NO LONGER stored in the client bundle. They live server-side only
// (GHOST_DEMO_API_KEY / GHOST_GM_CODE) and are exercised through dedicated
// backend endpoints (POST /users/demo/trial, /users/demo/admin-login,
// /users/verify-gm). This file holds only non-secret display/timing constants.
// ---------------------------------------------------------------------------

// Display nickname of the shared legacy demo account. Not a secret — the
// server resolves the real account using its own demo key.
export const DEMO_NICKNAME = "ghostdemo";

// How long the public guided trial stays live before the session auto-expires.
export const TRIAL_SESSION_DURATION_MS = 8 * 60 * 1000;

// In the public trial (sessionType === "trial", shared ghostdemo agent, no
// personal user) alert mode may stay armed for at most this long continuously,
// then it auto-disarms. Visitors with their own user have no such cap.
export const TRIAL_ALERT_MAX_MS = 30 * 1000;
