import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  X,
  Eye,
  EyeOff,
  Users,
  UserPlus,
  KeyRound,
  Mic,
  SlidersHorizontal,
  GraduationCap,
  ArrowUpRight,
  FileText,
  Download,
  Check,
} from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import {
  useOnboardingStore,
  selectActiveStep,
} from "../../stores/onboardingStore";
import { TOTAL_CHAPTERS } from "../../onboarding/tourSteps";
import { useT } from "../../utils/i18n";
import QuickLoginLinkSection from "./QuickLoginLinkSection";
import VoiceCommandSection from "./VoiceCommandSection";
import AdvancedSettingsSection from "./AdvancedSettingsSection";

interface SettingsPanelProps {
  onClose: () => void;
}

type SectionId = "account" | "access" | "voice" | "tuning" | "learning";

/**
 * Scroll/switch-into-view fade-up. Re-keying it (key={active}) lets each
 * section gently animate in as it becomes the active pane. Honors
 * prefers-reduced-motion.
 */
function Reveal({
  children,
  y = 12,
}: {
  children: ReactNode;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(true);
      return;
    }
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : `translateY(${y}px)`,
        transition:
          "opacity 420ms cubic-bezier(0.16,1,0.3,1), transform 420ms cubic-bezier(0.16,1,0.3,1)",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

/** Mono eyebrow + hairline + title + description — one canonical section header. */
function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-7">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted">
          {eyebrow}
        </span>
        <span className="flex-1 h-px bg-ghost-border-subtle" />
      </div>
      <h3 className="text-[20px] font-semibold leading-tight text-ghost-text-primary">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ghost-text-secondary">
          {description}
        </p>
      )}
    </header>
  );
}

/** Neutral grouped surface used to box related controls. */
function Panel({
  children,
  className,
  dataTour,
}: {
  children: ReactNode;
  className?: string;
  dataTour?: string;
}) {
  return (
    <div
      data-tour={dataTour}
      className={`rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 p-5${
        className ? ` ${className}` : ""
      }`}
    >
      {children}
    </div>
  );
}

function PanelHeading({
  icon,
  title,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-ghost-text-muted">{icon}</span>
      <h4 className="text-small font-medium text-ghost-text-secondary">
        {title}
      </h4>
      {trailing && <span className="ms-auto">{trailing}</span>}
    </div>
  );
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { users, activeUserId, updateOwnApiKey } = useUserStore();
  const openHub = useOnboardingStore((s) => s.openHub);
  const completedChapterIds = useOnboardingStore((s) => s.completedChapterIds);
  const tourTarget = useOnboardingStore((s) => selectActiveStep(s)?.target);
  const t = useT();

  const onbCompleted = completedChapterIds.length;
  const onbPct = Math.min(
    100,
    Math.round((onbCompleted / TOTAL_CHAPTERS) * 100)
  );

  const openLearningCenter = () => {
    openHub();
    onClose();
  };

  const activeUser = users.find((u) => u.id === activeUserId) ?? null;

  const [active, setActive] = useState<SectionId>("account");

  // Self-service: the connected operator updating their own Ghost API key.
  const [ownKey, setOwnKey] = useState("");
  const [showOwnKey, setShowOwnKey] = useState(false);
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);
  const [ownKeyError, setOwnKeyError] = useState<string | null>(null);
  const [ownKeySaved, setOwnKeySaved] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Keep the guided tour functional: when a settings step is spotlighted, jump
  // to the section that actually mounts its ``data-tour`` anchor.
  useEffect(() => {
    if (!tourTarget) return;
    const targetSection: Record<string, SectionId> = {
      "settings-users": "account",
      "settings-add-user": "account",
      "settings-quick-login": "access",
      "settings-voice": "voice",
      "settings-accuracy": "tuning",
      "settings-learning-center": "learning",
    };
    const next = targetSection[tourTarget];
    if (next) setActive(next);
  }, [tourTarget]);

  const handleUpdateOwnKey = async () => {
    if (!ownKey.trim()) {
      setOwnKeyError(t("keyRequired"));
      return;
    }
    setIsUpdatingKey(true);
    setOwnKeyError(null);
    setOwnKeySaved(false);
    const ok = await updateOwnApiKey(ownKey.trim());
    if (ok) {
      setOwnKey("");
      setShowOwnKey(false);
      setOwnKeySaved(true);
      window.setTimeout(() => setOwnKeySaved(false), 3000);
    } else {
      setOwnKeyError(t("failedUpdateKey"));
    }
    setIsUpdatingKey(false);
  };

  const navItems: { id: SectionId; label: string; icon: ReactNode }[] = [
    { id: "account", label: t("settingsNavAccount"), icon: <Users size={16} /> },
    {
      id: "access",
      label: t("settingsNavAccess"),
      icon: <KeyRound size={16} />,
    },
    { id: "voice", label: t("settingsNavVoice"), icon: <Mic size={16} /> },
    {
      id: "tuning",
      label: t("settingsNavTuning"),
      icon: <SlidersHorizontal size={16} />,
    },
    {
      id: "learning",
      label: t("settingsNavLearning"),
      icon: <GraduationCap size={16} />,
    },
  ];

  const headerCopy: Record<
    SectionId,
    { title: string; description?: string }
  > = {
    account: {
      title: t("settingsNavAccount"),
      description: t("settingsAccountDescription"),
    },
    access: {
      title: t("quickLoginLink"),
      description: t("settingsAccessDescription"),
    },
    voice: {
      title: t("voiceCommand"),
      description: t("voiceCommandDescription"),
    },
    tuning: {
      title: t("advancedSettings"),
      description: t("advancedSettingsDescription"),
    },
    learning: {
      title: t("onbHubTitle"),
      description: t("onbHubSubtitle"),
    },
  };

  const renderSection = () => {
    switch (active) {
      case "account":
        return (
          <div className="space-y-4">
            <Panel dataTour="settings-users">
              <PanelHeading
                icon={<Users size={14} />}
                title={t("users")}
                trailing={
                  <span className="font-mono text-[11px] tabular-nums text-ghost-text-muted">
                    {users.length}
                  </span>
                }
              />
              {users.length === 0 ? (
                <p className="text-small text-ghost-text-muted">
                  {t("noUsersCreated")}
                </p>
              ) : (
                <div className="space-y-1">
                  {users.map((u) => {
                    const isActive = u.id === activeUserId;
                    return (
                      <div
                        key={u.id}
                        className={`flex items-center gap-3 h-12 px-3 rounded-xl transition-colors duration-150 ${
                          isActive
                            ? "bg-ghost-surface"
                            : "hover:bg-ghost-surface-hover/60"
                        }`}
                      >
                        <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-ghost-surface border border-ghost-border-subtle text-small font-medium uppercase text-ghost-text-secondary">
                          {u.nickname.slice(0, 1)}
                        </span>
                        <span
                          className={`flex-1 min-w-0 truncate text-small ${
                            isActive
                              ? "text-ghost-text-primary font-medium"
                              : "text-ghost-text-secondary"
                          }`}
                        >
                          {u.nickname}
                        </span>
                        {isActive && (
                          <span className="shrink-0 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-ghost-surface border border-ghost-border-subtle font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-secondary">
                            <span className="w-1.5 h-1.5 rounded-full bg-ghost-success" />
                            {t("settingsActiveUser")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            {activeUser && (
              <Panel>
                <PanelHeading
                  icon={<KeyRound size={14} />}
                  title={t("myApiKeyTitle")}
                  trailing={
                    <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted truncate max-w-[40%]">
                      {activeUser.nickname}
                    </span>
                  }
                />
                <p className="mb-3 text-xs leading-relaxed text-ghost-text-muted">
                  {t("myApiKeyDescription")}
                </p>
                <label className="block mb-1.5 text-xs font-medium text-ghost-text-secondary">
                  {t("newApiKeyLabel")}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showOwnKey ? "text" : "password"}
                      value={ownKey}
                      onChange={(e) => {
                        setOwnKey(e.target.value);
                        setOwnKeySaved(false);
                        setOwnKeyError(null);
                      }}
                      placeholder={t("apiKeyPlaceholder")}
                      autoComplete="off"
                      className="w-full h-10 bg-ghost-surface border border-ghost-border-subtle rounded-xl px-3 pe-10 text-small text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-text-secondary transition-colors duration-[160ms]"
                    />
                    <button
                      onClick={() => setShowOwnKey(!showOwnKey)}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 text-ghost-text-muted hover:text-ghost-text-secondary transition-colors duration-[100ms]"
                      aria-label={showOwnKey ? "Hide API key" : "Show API key"}
                    >
                      {showOwnKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={handleUpdateOwnKey}
                    disabled={isUpdatingKey || !ownKey.trim()}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-xl text-small font-medium bg-ghost-accent hover:bg-ghost-accent-hover text-ghost-bg transition-colors duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingKey ? t("updatingKey") : t("updateKey")}
                  </button>
                </div>

                {ownKeyError && (
                  <p className="mt-3 text-xs text-ghost-error">{ownKeyError}</p>
                )}
                {ownKeySaved && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ghost-success">
                    <Check size={13} />
                    {t("keyUpdated")}
                  </p>
                )}
              </Panel>
            )}

            <Panel dataTour="settings-add-user">
              <PanelHeading icon={<UserPlus size={14} />} title={t("addUser")} />
              <p className="text-small leading-relaxed text-ghost-text-secondary">
                {t("addUserMovedToAdmin")}
              </p>
            </Panel>
          </div>
        );

      case "access":
        return (
          <Panel dataTour="settings-quick-login">
            {activeUserId ? (
              <QuickLoginLinkSection userId={activeUserId} />
            ) : (
              <p className="text-small text-ghost-text-muted">
                {t("settingsAccessNoUser")}
              </p>
            )}
          </Panel>
        );

      case "voice":
        return (
          <Panel dataTour="settings-voice">
            <VoiceCommandSection />
          </Panel>
        );

      case "tuning":
        return (
          <Panel dataTour="settings-accuracy">
            <AdvancedSettingsSection />
          </Panel>
        );

      case "learning":
        return (
          <Panel dataTour="settings-learning-center">
            <div className="flex items-center gap-4">
              <span className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-ghost-surface border border-ghost-border-subtle">
                <GraduationCap size={22} className="text-ghost-accent" />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-[15px] font-semibold text-ghost-text-primary">
                  {t("settingsLearningTitle")}
                </h4>
                <p className="mt-0.5 text-[13px] text-ghost-text-secondary">
                  {t("onbHubSubtitle")}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2 font-mono text-[11px] tracking-[0.16em] uppercase text-ghost-text-muted">
                <span className="tabular-nums">
                  {onbCompleted}/{TOTAL_CHAPTERS}
                </span>
                <span className="tabular-nums">{onbPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-ghost-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-ghost-accent transition-[width] duration-500"
                  style={{ width: `${onbPct}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={openLearningCenter}
              className="group mt-5 w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-small font-medium bg-ghost-accent hover:bg-ghost-accent-hover text-ghost-bg transition-colors duration-[120ms]"
            >
              <span>{t("settingsOpenLearning")}</span>
              <ArrowUpRight
                size={15}
                className="transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </button>

            {/* Visual training appendix — direct PDF download */}
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-ghost-border-subtle bg-ghost-surface/40 p-4">
              <span className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-ghost-surface border border-ghost-border-subtle">
                <FileText size={20} className="text-ghost-accent" />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-[14px] font-semibold text-ghost-text-primary">
                  {t("settingsAppendixTitle")}
                </h4>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ghost-text-secondary">
                  {t("settingsAppendixDescription")}
                </p>
                <a
                  href="/docs/Ghost_Operator_Training_Visual_Appendix.pdf"
                  download="Ghost_Operator_Training_Visual_Appendix.pdf"
                  className="group mt-2.5 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-ghost-border-subtle bg-ghost-bg text-[13px] font-medium text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[120ms]"
                >
                  <Download
                    size={14}
                    className="text-ghost-text-muted transition-colors duration-150 group-hover:text-ghost-text-primary"
                  />
                  <span>{t("settingsAppendixDownload")}</span>
                </a>
              </div>
            </div>
          </Panel>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-ghost-bg-secondary border border-ghost-border-subtle rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[92vh] flex flex-col overflow-hidden fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ghost-border-subtle shrink-0">
          <h2 className="text-title text-ghost-text-primary">{t("settings")}</h2>
          <button
            onClick={onClose}
            className="grid place-items-center w-8 h-8 rounded-lg text-ghost-text-muted hover:text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body: nav rail + content pane */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <nav
            aria-label={t("settingsNavAria")}
            className="shrink-0 md:w-60 border-b md:border-b-0 md:border-e border-ghost-border-subtle bg-ghost-bg/40 flex flex-col"
          >
            <div className="hidden md:flex items-center gap-3 px-5 pt-5 pb-3">
              <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-ghost-text-muted">
                Ghost // Console
              </span>
            </div>
            <div className="flex md:flex-col gap-1 px-3 py-3 md:py-1 overflow-x-auto md:overflow-y-auto">
              {navItems.map((item) => {
                const selected = active === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActive(item.id)}
                    aria-current={selected ? "page" : undefined}
                    className={`group shrink-0 md:w-full flex items-center gap-2.5 h-10 px-3 rounded-xl text-small whitespace-nowrap transition-colors duration-150 ${
                      selected
                        ? "bg-ghost-surface text-ghost-text-primary"
                        : "text-ghost-text-secondary hover:bg-ghost-surface-hover hover:text-ghost-text-primary"
                    }`}
                  >
                    <span
                      className={
                        selected
                          ? "text-ghost-accent"
                          : "text-ghost-text-muted group-hover:text-ghost-text-secondary"
                      }
                    >
                      {item.icon}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="relative flex-1 min-h-0 overflow-y-auto">
            <div className="ghost-ambient" aria-hidden>
              <div
                className="ghost-ambient__blob ghost-ambient__blob--1"
                style={{
                  top: -160,
                  left: "-8%",
                  width: 420,
                  height: 420,
                  background:
                    "radial-gradient(circle, rgb(96 116 132 / 0.55), transparent 70%)",
                }}
              />
              <div
                className="ghost-ambient__blob ghost-ambient__blob--3"
                style={{
                  top: 300,
                  right: "-10%",
                  width: 440,
                  height: 440,
                  background:
                    "radial-gradient(circle, rgb(104 116 78 / 0.5), transparent 72%)",
                }}
              />
            </div>

            <div className="relative z-10 px-6 sm:px-8 py-7 max-w-3xl mx-auto">
              <Reveal key={active}>
                <SectionHeader
                  eyebrow={`Ghost // ${headerCopy[active].title}`}
                  title={headerCopy[active].title}
                  description={headerCopy[active].description}
                />
                {renderSection()}
              </Reveal>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-ghost-border-subtle shrink-0">
          <p className="text-xs text-ghost-text-muted text-center">
            {t("version")}
          </p>
        </div>
      </div>
    </div>
  );
}
