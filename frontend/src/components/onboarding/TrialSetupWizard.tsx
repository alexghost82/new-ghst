import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  FolderTree,
  Layers,
  Loader2,
  MessageSquare,
} from "lucide-react";
import GhostIcon from "../shared/GhostIcon";
import { useUserStore } from "../../stores/userStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useLiveStore } from "../../stores/liveStore";
import { useLanguageStore } from "../../stores/languageStore";

// ── Guided first-setup for fresh trial accounts ──────────────────────────────
// Every "Talk to Ghost" trial opens a brand-new, completely clean account.
// This wizard walks the visitor through standing up their workspace in four
// short, visually-guided steps — first area, first group, first conversation,
// first camera — performing each action for them as they confirm it.

type StepId = "intro" | "area" | "group" | "conversation" | "camera";

const STEP_ORDER: StepId[] = ["intro", "area", "group", "conversation", "camera"];

const COPY = {
  he: {
    kicker: "Ghost // First setup",
    introTitle: "ברוך הבא, ",
    introBody:
      "נפתח עבורך סביבה חדשה ונקייה. בארבעה צעדים קצרים נקים יחד אזור ראשון, קבוצה ראשונה, שיחה ראשונה — ונחבר את המצלמה הראשונה שלך.",
    introCta: "מתחילים",
    stepLabel: (n: number) => `שלב ${n} מתוך 4`,
    areaTitle: "אזור ראשון",
    areaBody:
      "אזור הוא היחידה הגדולה ביותר במרחב שלך — אתר, מתחם או מתקן. תן לו שם.",
    areaPlaceholder: "האתר הראשי",
    groupTitle: "קבוצה ראשונה",
    groupBody:
      "קבוצה מרכזת שיחות ומצלמות סביב גזרה אחת בתוך האזור — כניסה, חניון, היקף.",
    groupPlaceholder: "כניסה ראשית",
    convTitle: "שיחה ראשונה",
    convBody:
      "שיחה היא ערוץ העבודה מול Ghost — שאלות, תחקור והתראות. נפתח את הראשונה.",
    convPlaceholder: "סיור ראשון",
    cameraTitle: "חיבור מצלמה ראשונה",
    cameraBody:
      "בחר מצלמה כדי ש-Ghost יוכל לראות את הזירה. התמונה נשארת מקומית עד שתשאל.",
    cameraDetecting: "מאתר מצלמות…",
    cameraDenied: "הגישה למצלמה נדחתה. אפשר להמשיך בלעדיה ולחבר מאוחר יותר.",
    cameraNone: "לא נמצאו מצלמות. אפשר להמשיך ולחבר מאוחר יותר.",
    cameraFailed: "איתור המצלמות נכשל. אפשר להמשיך ולחבר מאוחר יותר.",
    skipCamera: "דלג בינתיים",
    connectCamera: "חבר מצלמה וסיים",
    finishing: "מקים…",
    next: "המשך",
    back: "חזרה",
    required: "נדרש שם כדי להמשיך.",
    createFailed: "הפעולה נכשלה. נסה שוב.",
    summaryArea: "אזור",
    summaryGroup: "קבוצה",
    summaryConv: "שיחה",
  },
  en: {
    kicker: "Ghost // First setup",
    introTitle: "Welcome, ",
    introBody:
      "A brand-new, clean workspace was opened for you. In four short steps we will stand up your first area, first group, first conversation — and connect your first camera.",
    introCta: "Begin",
    stepLabel: (n: number) => `Step ${n} of 4`,
    areaTitle: "First area",
    areaBody:
      "An area is the largest unit of your space — a site, compound or facility. Name it.",
    areaPlaceholder: "Main site",
    groupTitle: "First group",
    groupBody:
      "A group gathers conversations and cameras around one sector inside the area — an entrance, a lot, a perimeter.",
    groupPlaceholder: "Main entrance",
    convTitle: "First conversation",
    convBody:
      "A conversation is your working channel with Ghost — questions, investigation and alerts. Let's open the first one.",
    convPlaceholder: "First patrol",
    cameraTitle: "Connect a first camera",
    cameraBody:
      "Pick a camera so Ghost can see the scene. The feed stays local until you ask.",
    cameraDetecting: "Detecting cameras…",
    cameraDenied: "Camera access was denied. You can continue and connect later.",
    cameraNone: "No cameras found. You can continue and connect later.",
    cameraFailed: "Camera detection failed. You can continue and connect later.",
    skipCamera: "Skip for now",
    connectCamera: "Connect camera & finish",
    finishing: "Setting up…",
    next: "Continue",
    back: "Back",
    required: "A name is required to continue.",
    createFailed: "The action failed. Try again.",
    summaryArea: "Area",
    summaryGroup: "Group",
    summaryConv: "Conversation",
  },
} as const;

function deviceLabel(device: MediaDeviceInfo): string {
  return device.label || `Camera ${device.deviceId.slice(0, 8)}`;
}

export default function TrialSetupWizard() {
  const locale = useLanguageStore((s) => s.locale);
  const dir = useLanguageStore((s) => s.dir);
  const c = COPY[locale];

  const activeUserId = useUserStore((s) => s.activeUserId);
  const users = useUserStore((s) => s.users);
  const completeTrialSetup = useUserStore((s) => s.completeTrialSetup);

  const groupsStore = useConversationGroupsStore();
  const createConversation = useConversationStore((s) => s.createConversation);
  const saveCameraSetup = useLiveStore((s) => s.saveCameraSetup);
  const enableLive = useLiveStore((s) => s.enableLive);

  const operatorName =
    users.find((u) => u.id === activeUserId)?.nickname ?? "";

  const [step, setStep] = useState<StepId>("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [areaName, setAreaName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [convName, setConvName] = useState("");

  const [areaId, setAreaId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(null);

  // Camera step state.
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // The groups tree is keyed per user in localStorage — make sure the store
  // is hydrated for the freshly-created trial account before we write to it.
  useEffect(() => {
    if (activeUserId && groupsStore.userId !== activeUserId) {
      groupsStore.loadForUser(activeUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  useEffect(() => {
    setError(null);
    if (step === "area" || step === "group" || step === "conversation") {
      const id = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(id);
    }
  }, [step]);

  const stopPreview = useCallback(() => {
    previewStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    previewStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPreviewing(false);
  }, []);

  // Camera enumeration on entering the camera step.
  useEffect(() => {
    if (step !== "camera") return;
    let cancelled = false;
    setCameraLoading(true);
    setCameraError(null);

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        stream.getTracks().forEach((tr) => tr.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((all) => {
        if (cancelled) return;
        const video = all.filter((d) => d.kind === "videoinput");
        setDevices(video);
        if (video.length === 0) {
          setCameraError(c.cameraNone);
        } else {
          setSelectedDevice(video[0].deviceId);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setCameraError(
          err?.name === "NotAllowedError" ? c.cameraDenied : c.cameraFailed,
        );
      })
      .finally(() => {
        if (!cancelled) setCameraLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Live preview of the selected device.
  useEffect(() => {
    if (step !== "camera" || !selectedDevice) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: selectedDevice } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        stopPreview();
        previewStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
        setPreviewing(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [step, selectedDevice, stopPreview]);

  useEffect(() => stopPreview, [stopPreview]);

  const goBack = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  const handleAreaNext = () => {
    const name = (areaName.trim() || c.areaPlaceholder).trim();
    if (!name) {
      setError(c.required);
      return;
    }
    if (areaId) {
      groupsStore.renameArea(areaId, name);
    } else {
      const area = groupsStore.createArea(name);
      if (!area) {
        setError(c.createFailed);
        return;
      }
      setAreaId(area.id);
    }
    setAreaName(name);
    setStep("group");
  };

  const handleGroupNext = () => {
    const name = (groupName.trim() || c.groupPlaceholder).trim();
    if (!name || !areaId) {
      setError(c.required);
      return;
    }
    if (groupId) {
      groupsStore.renameGroup(groupId, name);
    } else {
      const group = groupsStore.createGroup(areaId, name);
      if (!group) {
        setError(c.createFailed);
        return;
      }
      setGroupId(group.id);
    }
    setGroupName(name);
    setStep("conversation");
  };

  const handleConversationNext = async () => {
    const name = (convName.trim() || c.convPlaceholder).trim();
    if (!name || !activeUserId || !groupId) {
      setError(c.required);
      return;
    }
    setConvName(name);
    if (convId) {
      setStep("camera");
      return;
    }
    setBusy(true);
    setError(null);
    const conv = await createConversation(activeUserId, name);
    setBusy(false);
    if (!conv) {
      setError(c.createFailed);
      return;
    }
    setConvId(conv.id);
    groupsStore.assignConversation(conv.id, { areaId, groupId });
    setStep("camera");
  };

  const finish = useCallback(() => {
    stopPreview();
    completeTrialSetup();
  }, [stopPreview, completeTrialSetup]);

  const handleConnectCamera = async () => {
    if (!convId || !activeUserId || !selectedDevice) {
      finish();
      return;
    }
    const device = devices.find((d) => d.deviceId === selectedDevice);
    const label = device ? deviceLabel(device) : `Camera ${selectedDevice.slice(0, 8)}`;
    setBusy(true);
    await saveCameraSetup(convId, activeUserId, [
      { device_id: selectedDevice, label, position: 0 },
    ]);
    enableLive(convId, [{ device_id: selectedDevice, label }]);
    setBusy(false);
    finish();
  };

  const stepNumber = Math.max(0, STEP_ORDER.indexOf(step));

  const renderProgress = () => (
    <div className="flex items-center gap-1.5" dir="ltr" aria-hidden>
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`h-[3px] w-8 rounded-full transition-colors duration-200 ${
            n <= stepNumber ? "bg-ghost-accent" : "bg-ghost-border-subtle"
          }`}
        />
      ))}
    </div>
  );

  const renderNameStep = (opts: {
    icon: React.ReactNode;
    title: string;
    body: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    onNext: () => void;
    summary?: { label: string; value: string }[];
  }) => (
    <>
      <div className="flex items-center gap-3 mb-3">
        <span className="grid place-items-center w-10 h-10 rounded-xl border border-ghost-border-subtle bg-ghost-surface/40 text-ghost-text-secondary">
          {opts.icon}
        </span>
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ghost-text-primary">
          {opts.title}
        </h2>
      </div>
      <p className="text-[13.5px] leading-relaxed text-ghost-text-secondary mb-5">
        {opts.body}
      </p>

      {opts.summary && opts.summary.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {opts.summary.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-ghost-border-subtle bg-ghost-surface/40 text-[12px] text-ghost-text-secondary"
            >
              <Check size={12} className="text-ghost-success" />
              <span className="text-ghost-text-muted">{s.label}:</span>
              <span className="text-ghost-text-primary font-medium">{s.value}</span>
            </span>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          opts.onNext();
        }}
        className="flex flex-col gap-3"
      >
        <input
          ref={inputRef}
          value={opts.value}
          onChange={(e) => opts.onChange(e.target.value)}
          placeholder={opts.placeholder}
          disabled={busy}
          className="h-12 rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 text-[15px] text-ghost-text-primary outline-none transition-colors placeholder:text-ghost-text-muted focus:border-ghost-text-muted disabled:opacity-60"
        />
        {error && <p className="px-1 text-[12px] text-ghost-error">{error}</p>}
        <div className="mt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-[13px] text-ghost-text-muted transition-colors hover:text-ghost-text-primary hover:bg-ghost-surface-hover disabled:opacity-50"
          >
            {dir === "rtl" ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
            {c.back}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="group inline-flex items-center gap-2 h-11 px-6 rounded-full bg-ghost-accent text-[14px] font-semibold text-ghost-bg transition-all hover:bg-ghost-accent-hover active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {c.finishing}
              </>
            ) : (
              <>
                {c.next}
                {dir === "rtl" ? (
                  <ArrowLeft size={15} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                ) : (
                  <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                )}
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-ghost-bg"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={c.kicker}
    >
      {/* Ambient tactical wash — the only "color" on the stage */}
      <div className="ghost-ambient" aria-hidden>
        <div
          className="ghost-ambient__blob ghost-ambient__blob--1"
          style={{
            top: -160,
            left: "-10%",
            width: 420,
            height: 420,
            background:
              "radial-gradient(circle, rgb(96 116 132 / 0.4), transparent 70%)",
          }}
        />
        <div
          className="ghost-ambient__blob ghost-ambient__blob--3"
          style={{
            bottom: -180,
            right: "-10%",
            width: 460,
            height: 460,
            background:
              "radial-gradient(circle, rgb(104 116 78 / 0.35), transparent 72%)",
          }}
        />
      </div>

      <div
        className="relative w-full max-w-[520px] rounded-[20px] border border-ghost-border-subtle bg-ghost-bg shadow-[0_24px_80px_rgb(0_0_0/0.45)] overflow-hidden"
        style={{ animation: "leadPopIn 320ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        {/* Header rail: mono kicker + progress */}
        <div className="flex items-center justify-between gap-4 px-6 pt-5">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-ghost-text-muted"
            dir="ltr"
          >
            {c.kicker}
          </span>
          {step !== "intro" && renderProgress()}
        </div>

        <div className="px-6 pt-5 pb-6">
          {step === "intro" && (
            <div className="flex flex-col items-center text-center py-4">
              <GhostIcon size={56} className="mb-5" />
              <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ghost-text-primary">
                {c.introTitle}
                <span className="text-ghost-text-secondary">{operatorName}</span>
              </h1>
              <p className="mt-3 max-w-[400px] text-[14px] leading-relaxed text-ghost-text-secondary">
                {c.introBody}
              </p>
              <div className="mt-6 grid grid-cols-2 xs:grid-cols-4 gap-2 w-full max-w-[400px]" dir={dir}>
                {[
                  { icon: <Layers size={15} />, label: c.areaTitle },
                  { icon: <FolderTree size={15} />, label: c.groupTitle },
                  { icon: <MessageSquare size={15} />, label: c.convTitle },
                  { icon: <Camera size={15} />, label: c.cameraTitle },
                ].map((it, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-ghost-border-subtle bg-ghost-surface/30 px-1.5 py-3"
                  >
                    <span className="text-ghost-text-secondary">{it.icon}</span>
                    <span className="text-[10.5px] leading-tight text-ghost-text-muted text-center">
                      {it.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep("area")}
                className="group mt-7 inline-flex items-center gap-2 h-12 px-8 rounded-full bg-ghost-accent text-[15px] font-semibold text-ghost-bg transition-all hover:bg-ghost-accent-hover active:scale-[0.99]"
              >
                {c.introCta}
                {dir === "rtl" ? (
                  <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                ) : (
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                )}
              </button>
            </div>
          )}

          {step === "area" && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ghost-text-muted mb-4" dir="ltr">
                {c.stepLabel(1)}
              </p>
              {renderNameStep({
                icon: <Layers size={18} />,
                title: c.areaTitle,
                body: c.areaBody,
                placeholder: c.areaPlaceholder,
                value: areaName,
                onChange: setAreaName,
                onNext: handleAreaNext,
              })}
            </>
          )}

          {step === "group" && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ghost-text-muted mb-4" dir="ltr">
                {c.stepLabel(2)}
              </p>
              {renderNameStep({
                icon: <FolderTree size={18} />,
                title: c.groupTitle,
                body: c.groupBody,
                placeholder: c.groupPlaceholder,
                value: groupName,
                onChange: setGroupName,
                onNext: handleGroupNext,
                summary: [{ label: c.summaryArea, value: areaName }],
              })}
            </>
          )}

          {step === "conversation" && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ghost-text-muted mb-4" dir="ltr">
                {c.stepLabel(3)}
              </p>
              {renderNameStep({
                icon: <MessageSquare size={18} />,
                title: c.convTitle,
                body: c.convBody,
                placeholder: c.convPlaceholder,
                value: convName,
                onChange: setConvName,
                onNext: () => void handleConversationNext(),
                summary: [
                  { label: c.summaryArea, value: areaName },
                  { label: c.summaryGroup, value: groupName },
                ],
              })}
            </>
          )}

          {step === "camera" && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ghost-text-muted mb-4" dir="ltr">
                {c.stepLabel(4)}
              </p>
              <div className="flex items-center gap-3 mb-3">
                <span className="grid place-items-center w-10 h-10 rounded-xl border border-ghost-border-subtle bg-ghost-surface/40 text-ghost-text-secondary">
                  <Camera size={18} />
                </span>
                <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ghost-text-primary">
                  {c.cameraTitle}
                </h2>
              </div>
              <p className="text-[13.5px] leading-relaxed text-ghost-text-secondary mb-4">
                {c.cameraBody}
              </p>

              {/* Live preview — VISINT framing */}
              <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-xl border border-ghost-border-subtle bg-black">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
                {cameraLoading && (
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ghost-text-muted" dir="ltr">
                      {c.cameraDetecting}
                    </span>
                  </div>
                )}
                {previewing && (
                  <span
                    className="absolute top-2 start-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/80"
                    dir="ltr"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-ghost-success animate-pulse" />
                    Live
                  </span>
                )}
              </div>

              {cameraError && (
                <p className="mb-3 text-[12.5px] text-ghost-error">{cameraError}</p>
              )}

              {devices.length > 0 && (
                <div className="mb-4 space-y-1.5 max-h-36 overflow-y-auto">
                  {devices.map((d) => {
                    const checked = selectedDevice === d.deviceId;
                    return (
                      <button
                        key={d.deviceId}
                        onClick={() => setSelectedDevice(d.deviceId)}
                        className={`w-full flex items-center gap-3 px-3 h-11 rounded-xl border text-start transition-colors duration-150 ${
                          checked
                            ? "border-ghost-accent/50 bg-ghost-surface"
                            : "border-ghost-border-subtle hover:bg-ghost-surface-hover"
                        }`}
                        aria-pressed={checked}
                      >
                        <Camera
                          size={15}
                          className={checked ? "text-ghost-text-primary" : "text-ghost-text-muted"}
                        />
                        <span
                          className={`flex-1 min-w-0 truncate text-[13.5px] ${
                            checked
                              ? "text-ghost-text-primary font-medium"
                              : "text-ghost-text-secondary"
                          }`}
                        >
                          {deviceLabel(d)}
                        </span>
                        {checked && <Check size={14} className="text-ghost-success" />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={finish}
                  disabled={busy}
                  className="h-10 px-3 rounded-full text-[13px] text-ghost-text-muted transition-colors hover:text-ghost-text-primary hover:bg-ghost-surface-hover disabled:opacity-50"
                >
                  {c.skipCamera}
                </button>
                <button
                  onClick={() => void handleConnectCamera()}
                  disabled={busy || !selectedDevice}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-ghost-accent text-[14px] font-semibold text-ghost-bg transition-all hover:bg-ghost-accent-hover active:scale-[0.99] disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      {c.finishing}
                    </>
                  ) : (
                    c.connectCamera
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
