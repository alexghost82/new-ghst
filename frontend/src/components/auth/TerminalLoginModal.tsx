import type { RefObject } from "react";
import { Eye, EyeOff, ArrowRight, ArrowUpRight, FileDown } from "lucide-react";
import type { DownloadDoc } from "./LeadCapturePopup";

interface NavItem {
  kicker: string;
  label: string;
  onClick: () => void;
}

interface DocItem {
  id: string;
  label: string;
  sub: string;
  doc: DownloadDoc;
}

interface TerminalLoginModalProps {
  nickname: string;
  setNickname: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  error: string | null;
  isLoading: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  navItems: NavItem[];
  docs: DocItem[];
  onSelectDoc: (doc: DownloadDoc) => void;
  onShowTalk?: () => void;
}

// Retro secure-terminal skin of the Secure Access screen. Content and behaviour
// are identical to LoginModal — only the presentation changes (green phosphor
// CRT). All state/handlers are owned by LoginModal and passed in, so the two
// variants stay perfectly in sync. Must be rendered inside <CRT>.
export default function TerminalLoginModal({
  nickname,
  setNickname,
  apiKey,
  setApiKey,
  showKey,
  setShowKey,
  error,
  isLoading,
  canSubmit,
  onSubmit,
  onKeyDown,
  inputRef,
  navItems,
  docs,
  onSelectDoc,
  onShowTalk,
}: TerminalLoginModalProps) {
  return (
    <div
      dir="ltr"
      className="flex h-full w-full flex-col overflow-y-auto font-mono text-terminal-green"
    >
      {/* Centered form column */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="glitch-in w-full max-w-sm">
          {/* Ghost mark + heading */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 h-14 w-14 overflow-hidden rounded-md border border-terminal-green-dim/60">
              <img
                src="/ghost-icon.png"
                alt="Ghost"
                className="h-full w-full object-cover"
                style={{ filter: "grayscale(1) brightness(1.2) contrast(1.1)" }}
              />
            </div>
            <div className="text-[10px] tracking-[0.4em] text-terminal-green-dim">
              RESTRICTED // SECURE TERMINAL
            </div>
            <h1
              className="mt-2 text-4xl uppercase tracking-[0.18em] text-terminal-green text-glow"
              style={{ fontFamily: "'VT323', monospace" }}
            >
              Secure Access
            </h1>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] tracking-[0.25em] text-terminal-green-dim">
              <span>AUTH LINK</span>
              <span className="text-terminal-green">ONLINE</span>
              <span className="inline-block h-2 w-2 animate-blink bg-terminal-green" />
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[10px] tracking-[0.3em] text-terminal-green-dim">
                &gt; AGENT ACCESS
              </span>
              <input
                ref={inputRef}
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Agent Access"
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full rounded-sm border border-terminal-green-dim/50 bg-black/40 px-3 text-[15px] tracking-[0.12em] text-terminal-green caret-terminal-green outline-none transition-colors placeholder:text-terminal-green-dim/40 focus:border-terminal-green focus:text-glow"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] tracking-[0.3em] text-terminal-green-dim">
                &gt; GHOST KEY
              </span>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ghost Key"
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-11 w-full rounded-sm border border-terminal-green-dim/50 bg-black/40 px-3 pr-11 text-left text-[15px] tracking-[0.12em] text-terminal-green caret-terminal-green outline-none transition-colors placeholder:text-terminal-green-dim/40 focus:border-terminal-green focus:text-glow"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-green-dim transition-colors hover:text-terminal-green"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && (
              <p className="text-center text-sm tracking-[0.15em] text-terminal-red text-glow-red">
                {error}
              </p>
            )}

            <button
              onClick={onSubmit}
              disabled={isLoading || !canSubmit}
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-sm border border-terminal-green bg-terminal-green/10 text-[14px] font-medium uppercase tracking-[0.22em] text-terminal-green transition-colors hover:bg-terminal-green/20 hover:text-glow disabled:cursor-not-allowed disabled:border-terminal-green-dim/40 disabled:bg-transparent disabled:text-terminal-green-dim/40"
            >
              {isLoading ? "AUTHENTICATING..." : "Sign in"}
              {!isLoading && (
                <ArrowRight
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              )}
            </button>

            {onShowTalk && (
              <button
                type="button"
                onClick={onShowTalk}
                className="group flex h-11 w-full items-center justify-center gap-2 rounded-sm border border-terminal-green-dim/50 bg-black/30 text-[13px] uppercase tracking-[0.18em] text-terminal-green transition-colors hover:border-terminal-green hover:text-glow"
              >
                <span className="h-1.5 w-1.5 animate-blink bg-terminal-green" />
                Talk to Ghost — 8-minute live trial
                <ArrowRight
                  size={15}
                  className="text-terminal-green-dim transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-terminal-green"
                />
              </button>
            )}
          </div>

          {/* Navigation */}
          {navItems.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2.5 px-1">
                <span className="text-[10px] uppercase tracking-[0.3em] text-terminal-green-dim">
                  Ghost // Explore
                </span>
                <span className="h-px flex-1 bg-terminal-green-dim/40" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {navItems.map(({ kicker, label, onClick }, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className={`group h-full w-full rounded-sm border border-terminal-green-dim/50 bg-black/30 px-3.5 py-3 text-left transition-colors hover:border-terminal-green hover:bg-terminal-green/10 ${
                      index === 0 ? "col-span-2" : ""
                    }`}
                  >
                    <span className="block text-[9px] uppercase tracking-[0.22em] text-terminal-green-dim">
                      {kicker}
                    </span>
                    <span className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium uppercase leading-tight tracking-[0.08em] text-terminal-green group-hover:text-glow">
                        {label}
                      </span>
                      <ArrowUpRight
                        size={14}
                        className="flex-shrink-0 text-terminal-green-dim transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-terminal-green"
                      />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Briefs & documents */}
      <div className="relative border-t border-terminal-green-dim/40 bg-black/40">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="text-[10px] uppercase tracking-[0.3em] text-terminal-green-dim">
              Briefs &amp; documents
            </span>
            <span className="h-px flex-1 bg-terminal-green-dim/40" />
            <span className="hidden text-[10px] uppercase tracking-[0.22em] text-terminal-green-dim sm:inline">
              Name + email or phone to download
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {docs.map(({ id, label, sub, doc }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectDoc(doc)}
                className="group flex items-center gap-3 rounded-sm border border-terminal-green-dim/50 bg-black/30 px-3.5 py-3 text-left transition-colors hover:border-terminal-green hover:bg-terminal-green/10"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm border border-terminal-green-dim/50 bg-black/50 text-terminal-green-dim transition-colors group-hover:text-terminal-green">
                  <FileDown size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium uppercase tracking-[0.06em] text-terminal-green group-hover:text-glow">
                    {label}
                  </span>
                  <span className="block truncate text-[11px] tracking-[0.08em] text-terminal-green-dim">
                    {sub}
                  </span>
                </span>
                <ArrowRight
                  size={15}
                  className="flex-shrink-0 text-terminal-green-dim transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-terminal-green"
                />
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] uppercase leading-relaxed tracking-[0.12em] text-terminal-green-dim sm:hidden">
            Leave your name and email or phone to download.
          </p>
        </div>
      </div>
    </div>
  );
}
