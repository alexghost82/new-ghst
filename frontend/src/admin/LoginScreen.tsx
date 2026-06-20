import { useEffect, useRef, useState } from "react";

import { useAdminStore } from "./store";
import { AdminBrand, Banner, Button, Field, MonoLabel, Spinner } from "./ui";

const OTP_LENGTH = 6;

/**
 * Six-box one-time-code field. Typing a digit auto-advances to the next box;
 * Backspace steps back; pasting a full code fills all boxes. When the last box
 * is filled (no Enter required) `onComplete` fires for automatic verification.
 */
function OtpInput({
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  autoFocus = false,
}: {
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const focusBox = (index: number) => {
    const el = inputsRef.current[Math.max(0, Math.min(OTP_LENGTH - 1, index))];
    el?.focus();
    el?.select();
  };

  const commit = (next: string[], focusTo?: number) => {
    setDigits(next);
    const value = next.join("");
    onChange(value);
    if (focusTo !== undefined) focusBox(focusTo);
    if (value.length === OTP_LENGTH) onComplete(value);
  };

  const handleInput = (index: number, raw: string) => {
    const onlyDigits = raw.replace(/\D/g, "");
    if (!onlyDigits) return;
    const next = digits.slice();
    if (onlyDigits.length === 1) {
      next[index] = onlyDigits;
      commit(next, index < OTP_LENGTH - 1 ? index + 1 : index);
      return;
    }
    let cursor = index;
    for (const ch of onlyDigits) {
      if (cursor >= OTP_LENGTH) break;
      next[cursor] = ch;
      cursor += 1;
    }
    commit(next, Math.min(cursor, OTP_LENGTH - 1));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = digits.slice();
      if (next[index]) {
        next[index] = "";
        commit(next, index);
      } else if (index > 0) {
        next[index - 1] = "";
        commit(next, index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      focusBox(index - 1);
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    handleInput(index, text);
  };

  return (
    <div className="flex items-center justify-center gap-2" dir="ltr">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digit}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          autoFocus={autoFocus && index === 0}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleInput(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          className={`h-14 w-12 rounded-lg border bg-ghost-bg-secondary text-center font-mono text-xl text-ghost-text-primary outline-none transition-colors disabled:opacity-50 ${
            invalid
              ? "border-ghost-error/60 focus:border-ghost-error"
              : "border-ghost-border-subtle focus:border-ghost-text-secondary"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Secure admin sign-in: email + password, then TOTP 2FA. On first login the
 * server returns a provisioning secret to enroll in an authenticator app.
 */
export default function LoginScreen() {
  const stage = useAdminStore((s) => s.stage);
  const busy = useAdminStore((s) => s.busy);
  const error = useAdminStore((s) => s.error);
  const mfa = useAdminStore((s) => s.mfa);
  const submitPassword = useAdminStore((s) => s.submitPassword);
  const submitMfa = useAdminStore((s) => s.submitMfa);
  const clearError = useAdminStore((s) => s.clearError);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // Bumping this remounts (and clears) the OTP boxes after a failed attempt.
  const [attemptKey, setAttemptKey] = useState(0);

  useEffect(() => {
    if (error && (stage === "mfa" || stage === "mfa_setup")) {
      setCode("");
      setAttemptKey((k) => k + 1);
    }
  }, [error, stage]);

  const onPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) submitPassword(email, password);
  };
  const onMfa = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === OTP_LENGTH && !busy) submitMfa(code);
  };
  const onCodeChange = (value: string) => {
    setCode(value);
    if (error) clearError();
  };
  const onCodeComplete = (value: string) => {
    if (!busy) submitMfa(value);
  };

  return (
    <div dir="ltr" className="ghost-force-dark flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <AdminBrand size={48} />
          <div className="mt-5">
            <MonoLabel>Ghost // Admin Access</MonoLabel>
          </div>
          <h1
            className="mt-3 text-ghost-text-primary"
            style={{ fontSize: "1.6rem", fontWeight: 400, letterSpacing: "-0.03em" }}
          >
            Admin Console
          </h1>
          <p className="mt-1 text-sm text-ghost-text-muted">
            Secure access — system owner only
          </p>
        </div>

        <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-6">
          {stage === "login" && (
            <form onSubmit={onPassword} className="flex flex-col gap-4" dir="ltr">
              <Field
                label="Admin Email"
                type="email"
                autoComplete="username"
                dir="ltr"
                placeholder="owner@…"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
              <Field
                label="Password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <Banner tone="error">{error}</Banner>}
              <Button type="submit" disabled={busy || !email || !password} className="mt-1 w-full">
                {busy ? "Verifying…" : "Continue →"}
              </Button>
            </form>
          )}

          {(stage === "mfa" || stage === "mfa_setup") && (
            <form onSubmit={onMfa} className="flex flex-col gap-4" dir="ltr">
              {stage === "mfa_setup" && mfa?.totpSecret && (
                <div className="flex flex-col gap-2 rounded-lg border border-ghost-border-subtle bg-ghost-bg-secondary p-3">
                  <MonoLabel>Enroll 2FA</MonoLabel>
                  <p className="text-xs leading-relaxed text-ghost-text-secondary">
                    Add this secret to your authenticator app (Google Authenticator /
                    Authy), then enter the 6-digit code below:
                  </p>
                  <code className="select-all break-all rounded bg-ghost-bg px-2 py-1 text-center font-mono text-xs tracking-widest text-ghost-text-primary">
                    {mfa.totpSecret}
                  </code>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <span className="block">
                  <MonoLabel>Authenticator Code</MonoLabel>
                </span>
                <OtpInput
                  key={attemptKey}
                  onChange={onCodeChange}
                  onComplete={onCodeComplete}
                  disabled={busy}
                  invalid={!!error}
                  autoFocus
                />
              </div>
              {error ? (
                <Banner tone="error">{error}</Banner>
              ) : busy ? (
                <Spinner label="Verifying code…" />
              ) : (
                <p className="text-center text-xs text-ghost-text-muted">
                  Enter the 6-digit code — it submits automatically.
                </p>
              )}
              <Button type="submit" disabled={busy || code.length < OTP_LENGTH} className="mt-1 w-full">
                {busy ? "Verifying…" : "Enter console →"}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted">
          Authorized personnel only · All actions are logged
        </p>
      </div>
    </div>
  );
}
