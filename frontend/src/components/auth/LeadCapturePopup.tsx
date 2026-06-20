import { useEffect, useRef, useState } from "react";
import { X, ArrowUp, Check, FileText } from "lucide-react";
import { api } from "../../api/client";
import GhostIcon from "../shared/GhostIcon";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import type { Locale } from "../../stores/languageStore";

// The reader-facing copy of a gated document. English lives directly on the
// DownloadDoc; a Hebrew variant rides along under `he` (the mono kicker is a
// brand-signature English label and is shared by both).
export interface DownloadDocCopy {
  /** The user-bubble question that opens the mini thread. */
  question: string;
  /** Bold opening line of Ghost's reply. */
  headline: string;
  /** Secondary continuation of the headline. */
  headlineDim: string;
  /** Supporting paragraph under the headline. */
  intro: string;
  /** Bulleted capability lines. */
  points: { title: string; desc: string }[];
  /** Title shown on the success state. */
  successTitle?: string;
}

// A single gated document the popup can unlock. The defaults below reproduce
// the original Defense & National Security brief behaviour, so existing
// callers that pass no `doc` keep working unchanged.
export interface DownloadDoc extends DownloadDocCopy {
  /** Public path of the PDF (served from /public). */
  path: string;
  filename: string;
  /** Mono kicker shown at the top of the panel (English in both locales). */
  kicker: string;
  /** Hebrew copy, shown when the site runs in Hebrew. */
  he?: DownloadDocCopy;
  /** Whether the company field is required (default: true). */
  requireCompany?: boolean;
  /**
   * When set, the gate collects full name, company, work email AND mobile
   * phone as four separate required fields (used for classified / need-to-know
   * documents). When unset, a single email-or-phone contact field is used.
   */
  requireFullContact?: boolean;
}

// Popup chrome — labels, placeholders, validation — per locale.
const POPUP_COPY: Record<
  Locale,
  {
    ariaLabel: string;
    close: string;
    successFallbackTitle: string;
    successBody: string;
    downloadAgain: string;
    fullName: string;
    company: string;
    companyOptional: string;
    workEmail: string;
    mobilePhone: string;
    emailOrPhone: string;
    submitLabel: string;
    validationFull: string;
    validationCompany: string;
    validation: string;
    ndaFootnote: string;
  }
> = {
  en: {
    ariaLabel: "Download the Ghost capabilities brief",
    close: "Close",
    successFallbackTitle: "Your document is downloading",
    successBody: "Check your downloads for the PDF.",
    downloadAgain: "Download again",
    fullName: "Full name",
    company: "Company / organization",
    companyOptional: "Company / organization (optional)",
    workEmail: "Work email",
    mobilePhone: "Mobile phone",
    emailOrPhone: "Work email or mobile phone",
    submitLabel: "Download the document",
    validationFull:
      "Enter your full name, company, work email and mobile phone.",
    validationCompany:
      "Enter your name, company, and a valid email or mobile phone.",
    validation: "Enter your name and a valid email or mobile phone.",
    ndaFootnote:
      "Shared under NDA terms · We'll only use this to send your document.",
  },
  he: {
    ariaLabel: "הורדת תדריך היכולות של Ghost",
    close: "סגירה",
    successFallbackTitle: "המסמך שלכם בהורדה",
    successBody: "בדקו את תיקיית ההורדות עבור ה-PDF.",
    downloadAgain: "הורדה חוזרת",
    fullName: "שם מלא",
    company: "חברה / ארגון",
    companyOptional: "חברה / ארגון (לא חובה)",
    workEmail: "אימייל עבודה",
    mobilePhone: "טלפון נייד",
    emailOrPhone: "אימייל עבודה או טלפון נייד",
    submitLabel: "הורדת המסמך",
    validationFull: "הזינו שם מלא, חברה, אימייל עבודה וטלפון נייד.",
    validationCompany: "הזינו שם, חברה, ואימייל או טלפון נייד תקינים.",
    validation: "הזינו שם ואימייל או טלפון נייד תקינים.",
    ndaFootnote: "משותף בכפוף לתנאי NDA · נשתמש בפרטים רק לשליחת המסמך.",
  },
};

interface LeadCapturePopupProps {
  onClose: () => void;
  doc?: DownloadDoc;
}

const LEAD_KEY = "ghost_capabilities_lead";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose phone validity — at least 7 digits, optional +, spaces, dashes, parens.
const PHONE_RE = /[\d]/g;

// The "What Ghost Can Do" field guide — nine capabilities, one page each.
// Shared by the login screen and the capabilities page so the gate copy and
// gated file stay in sync.
export const FIELD_GUIDE_DOC: DownloadDoc = {
  path: "/docs/Ghost_Capabilities_Field_Guide.pdf",
  filename: "Ghost_Capabilities_Field_Guide.pdf",
  kicker: "Field Guide · What Ghost Can Do",
  question: "Show me everything Ghost can do.",
  headline: "Nine capabilities, one conversation.",
  headlineDim: "Every action, explained.",
  intro:
    "A plain-language walkthrough of all nine things Ghost does — one page each. Get the full field guide:",
  points: [
    { title: "Ask your camera anything", desc: "Plain-language questions, plain-language answers." },
    { title: "History you can talk to", desc: "Question the past instead of scrubbing footage." },
    { title: "Talk to a whole zone", desc: "One question across every camera in an area." },
    { title: "Rules you define", desc: "Describe a watch; Ghost flags only the deviations." },
  ],
  successTitle: "Your field guide is downloading",
  requireCompany: false,
  he: {
    question: "תראה לי את כל מה ש-Ghost יודע לעשות.",
    headline: "תשע יכולות, שיחה אחת.",
    headlineDim: "כל פעולה, מוסברת.",
    intro:
      "מדריך בשפה פשוטה לכל תשעת הדברים ש-Ghost עושה — עמוד לכל יכולת. קבלו את מדריך השדה המלא:",
    points: [
      {
        title: "לשאול את המצלמה כל דבר",
        desc: "שאלות בשפה חופשית, תשובות בשפה חופשית.",
      },
      {
        title: "היסטוריה שאפשר לדבר איתה",
        desc: "לתחקר את העבר במקום לגלול הקלטות.",
      },
      {
        title: "לדבר עם אזור שלם",
        desc: "שאלה אחת על כל המצלמות באזור.",
      },
      {
        title: "חוקים שאתם מגדירים",
        desc: "מתארים משימת צפייה; Ghost מסמן רק את החריגות.",
      },
    ],
    successTitle: "מדריך השדה שלכם בהורדה",
  },
};

// The classified LKM-Drone counter-UAS field report. Need-to-know: the gate
// requires full name, company/organization, work email AND mobile phone before
// the PDF is released.
export const LKM_DRONE_DOC: DownloadDoc = {
  path: "/docs/Ghost_LKM_Drone_Field_Report.pdf",
  filename: "Ghost_LKM_Drone_Field_Report.pdf",
  kicker: "SECRET // NOFORN · Need-to-know",
  question: "Send me the LKM-Drone counter-UAS field report.",
  headline: "Classified counter-UAS field report.",
  headlineDim: "Released on a need-to-know basis.",
  intro:
    "A five-page field report on LKM-Drone — doctrine, the proprietary detection engine, and results from a controlled counter-UAS trial. Released under NDA to verified recipients:",
  points: [
    { title: "Threat & detection doctrine", desc: "Why small drones defeat conventional systems — and how Ghost reads behavior, not shape." },
    { title: "Proprietary detection engine", desc: "Micro-Signature Tracking, Micro-Flutter Analysis and Heat Atlas, working as one." },
    { title: "Field-trial evidence", desc: "Thermal-only classification of a stabilised quadcopter across desert and border terrain." },
    { title: "Deployment & handling", desc: "Rapid integration on existing sensors, plus strict distribution controls." },
  ],
  successTitle: "Your field report is downloading",
  requireCompany: true,
  requireFullContact: true,
  he: {
    question: "שלחו לי את דוח השטח של LKM-Drone ללוחמה בכטב\"מים.",
    headline: "דוח שטח מסווג ללוחמה בכטב\"מים.",
    headlineDim: "משוחרר על בסיס צורך-לדעת.",
    intro:
      "דוח שטח בן חמישה עמודים על LKM-Drone — דוקטרינה, מנוע הגילוי הקנייני, ותוצאות מניסוי מבוקר בלוחמה בכטב\"מים. משוחרר תחת NDA לנמענים מאומתים:",
    points: [
      {
        title: "דוקטרינת איום וגילוי",
        desc: "למה רחפנים קטנים מביסים מערכות קונבנציונליות — ואיך Ghost קורא התנהגות, לא צורה.",
      },
      {
        title: "מנוע גילוי קנייני",
        desc: "Micro-Signature Tracking, Micro-Flutter Analysis ו-Heat Atlas, פועלים כאחד.",
      },
      {
        title: "ראיות מניסוי שטח",
        desc: "סיווג תרמי בלבד של רחפן מיוצב בתנאי מדבר וגבול.",
      },
      {
        title: "פריסה ובקרת הפצה",
        desc: "אינטגרציה מהירה על חיישנים קיימים, עם בקרות הפצה קשיחות.",
      },
    ],
    successTitle: "דוח השטח שלכם בהורדה",
  },
};

// The Operator Training Program booklet — gated behind the next-cohort
// waitlist on the Operator Training Syllabus page. Submitting the form joins
// the waitlist (tracked via the downloads ledger) and releases the booklet.
export const TRAINING_SYLLABUS_DOC: DownloadDoc = {
  path: "/docs/Ghost_Operator_Training_Program.pdf",
  filename: "Ghost_Operator_Training_Program.pdf",
  kicker: "Ghost Academy · Operator Training",
  question: "Put me on the waitlist for the next operator cohort.",
  headline: "Reserve your seat.",
  headlineDim: "Get the full training booklet now.",
  intro:
    "Leave your details to join the waitlist for the next operator certification cohort — and download the complete 50-page training program immediately:",
  points: [
    {
      title: "The full 10-part syllabus",
      desc: "From your first question to running an entire site.",
    },
    {
      title: "50 lessons, one per page",
      desc: "Every control in the console, explained the way operators work.",
    },
    {
      title: "14 hands-on field drills",
      desc: "Each with a pass condition — performed on a live console.",
    },
    {
      title: "Certification track",
      desc: "Capstone exercises and the practical exam that close the program.",
    },
  ],
  successTitle: "You're on the waitlist — your booklet is downloading",
  requireCompany: false,
  he: {
    question: "רשמו אותי לרשימת ההמתנה למחזור המפעילים הבא.",
    headline: "שריינו את המקום שלכם.",
    headlineDim: "קבלו את חוברת ההכשרה המלאה עכשיו.",
    intro:
      "השאירו פרטים כדי להצטרף לרשימת ההמתנה למחזור ההסמכה הבא — והורידו מיד את תוכנית ההכשרה המלאה בת 50 העמודים:",
    points: [
      {
        title: "הסילבוס המלא ב-10 חלקים",
        desc: "מהשאלה הראשונה ועד תפעול אתר שלם.",
      },
      {
        title: "50 שיעורים, עמוד לכל שיעור",
        desc: "כל פקד בקונסול, מוסבר כמו שמפעילים עובדים.",
      },
      {
        title: "14 תרגילי שטח מעשיים",
        desc: "לכל אחד תנאי מעבר — מבוצעים על קונסול חי.",
      },
      {
        title: "מסלול הסמכה",
        desc: "תרגילי גמר והמבחן המעשי שסוגרים את התוכנית.",
      },
    ],
    successTitle: "אתם ברשימת ההמתנה — החוברת שלכם בהורדה",
  },
};

// The gated capabilities brief — already shipped to /public/docs.
export const DEFENSE_BRIEF_DOC: DownloadDoc = {
  path: "/docs/Ghost_Defense_Intelligence_Brief.pdf",
  filename: "Ghost_Defense_Intelligence_Brief.pdf",
  kicker: "Confidential · Capabilities Brief",
  question: "What can Ghost do for my control room?",
  headline: "Your cameras already see everything.",
  headlineDim: "Now question them.",
  intro:
    "Ghost turns the feeds you already operate into a memory you question in plain language. Get the full brief:",
  points: [
    {
      title: "Agentless",
      desc: "Ingests your existing RTSP / HDMI streams — nothing installed on cameras.",
    },
    {
      title: "Air-gap ready",
      desc: "Runs fully disconnected for sovereign, high-assurance sites.",
    },
    {
      title: "History you can talk to",
      desc: "Every feed becomes searchable memory — ask, don't scrub.",
    },
    {
      title: "Checks you define",
      desc: "Describe a watch in plain language; Ghost flags only the deviations.",
    },
  ],
  he: {
    question: "מה Ghost יכול לעשות בחמ\"ל שלי?",
    headline: "המצלמות שלכם כבר רואות הכול.",
    headlineDim: "עכשיו תחקרו אותן.",
    intro:
      "Ghost הופך את הפידים שאתם כבר מפעילים לזיכרון שמתחקרים בשפה חופשית. קבלו את התדריך המלא:",
    points: [
      {
        title: "ללא סוכן",
        desc: "קולט את זרמי ה-RTSP / HDMI הקיימים — שום דבר לא מותקן על המצלמות.",
      },
      {
        title: "מוכן ל-Air-gap",
        desc: "רץ מנותק לחלוטין לאתרים ריבוניים ברמת אבטחה גבוהה.",
      },
      {
        title: "היסטוריה שאפשר לדבר איתה",
        desc: "כל פיד הופך לזיכרון בר-תחקור — שואלים, לא גוללים.",
      },
      {
        title: "בדיקות שאתם מגדירים",
        desc: "מתארים משימת צפייה בשפה חופשית; Ghost מסמן רק את החריגות.",
      },
    ],
  },
};

function triggerDownload(doc: DownloadDoc) {
  const a = document.createElement("a");
  a.href = doc.path;
  a.download = doc.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function LeadCapturePopup({
  onClose,
  doc = DEFENSE_BRIEF_DOC,
}: LeadCapturePopupProps) {
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const t = POPUP_COPY[locale];
  // Reader-facing doc copy, falling back to English when no Hebrew exists.
  const copy: DownloadDocCopy = locale === "he" && doc.he ? doc.he : doc;

  const requireCompany = doc.requireCompany ?? true;
  const requireFullContact = doc.requireFullContact ?? false;
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Esc closes the popup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmedContact = contact.trim();
  const isEmail = EMAIL_RE.test(trimmedContact);
  const isPhone = (trimmedContact.match(PHONE_RE)?.length ?? 0) >= 7;
  const contactValid = isEmail || isPhone;
  const companyValid = !requireCompany || company.trim().length > 0;

  // Four-field (need-to-know) mode requires a valid email AND a valid phone.
  const trimmedEmail = email.trim();
  const fullEmailValid = EMAIL_RE.test(trimmedEmail);
  const fullPhoneValid = (phone.match(PHONE_RE)?.length ?? 0) >= 7;
  const valid = requireFullContact
    ? name.trim().length > 0 &&
      companyValid &&
      fullEmailValid &&
      fullPhoneValid
    : name.trim().length > 0 && companyValid && contactValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;

    const payload = requireFullContact
      ? {
          name: name.trim(),
          company: company.trim() || undefined,
          email: trimmedEmail,
          phone: phone.trim(),
          file: doc.filename,
        }
      : {
          name: name.trim(),
          company: company.trim() || undefined,
          email: isEmail ? trimmedContact : undefined,
          phone: !isEmail && isPhone ? trimmedContact : undefined,
          file: doc.filename,
        };

    try {
      window.localStorage.setItem(LEAD_KEY, JSON.stringify(payload));
    } catch {
      // best-effort persistence only
    }

    // Fire-and-forget — a tracking failure must never block the download.
    void api.trackDownload(payload);
    setDone(true);
    triggerDownload(doc);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 pb-safe-4"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={t.ariaLabel}
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label={t.close}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_200ms_ease]"
      />

      {/* Panel — ChatGPT thread + composer */}
      <div
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[400px] flex-col overflow-hidden rounded-[20px] border border-ghost-border-subtle bg-ghost-bg shadow-[0_24px_80px_rgb(0_0_0/0.55)] sm:max-h-[calc(100dvh-3rem)]"
        style={{
          animation: "leadPopIn 320ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-3 end-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ghost-bg/70 text-ghost-text-muted backdrop-blur transition-colors hover:bg-ghost-surface-hover hover:text-ghost-text-primary"
        >
          <X size={17} />
        </button>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-5 sm:px-6">
          {/* Kicker — brand-signature English mono, LTR in both locales */}
          <div className="mb-3 flex items-center gap-2.5 pe-9" dir="ltr">
            <span className="h-1.5 w-1.5 rounded-full bg-ghost-text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ghost-text-muted">
              {doc.kicker}
            </span>
          </div>

          {done ? (
            /* ── Success state ── */
            <div className="py-2">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ghost-border-subtle bg-ghost-surface">
                  <Check size={18} className="text-ghost-text-primary" />
                </span>
                <div>
                  <p className="text-[16px] font-semibold tracking-[-0.01em] text-ghost-text-primary">
                    {copy.successTitle ?? t.successFallbackTitle}
                  </p>
                  <p className="text-[13px] text-ghost-text-secondary">
                    {t.successBody}
                  </p>
                </div>
              </div>
              <button
                onClick={() => triggerDownload(doc)}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-ghost-border-subtle bg-ghost-surface px-4 py-2 text-[13px] font-medium text-ghost-text-primary transition-colors hover:bg-ghost-surface-hover"
              >
                <FileText size={14} />
                {t.downloadAgain}
              </button>
            </div>
          ) : (
            <>
              {/* Mini chat thread */}
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-[16px] bg-ghost-surface px-3.5 py-2 text-[13.5px] leading-snug text-ghost-text-primary">
                  {copy.question}
                </div>
              </div>

              <div className="mt-3 flex gap-2.5">
                <GhostIcon size={26} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold leading-[1.2] tracking-[-0.01em] text-ghost-text-primary">
                    {copy.headline}{" "}
                    <span className="text-ghost-text-secondary">
                      {copy.headlineDim}
                    </span>
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ghost-text-secondary">
                    {copy.intro}
                  </p>

                  <ul className="mt-2 flex flex-col">
                    {copy.points.map((p) => (
                      <li
                        key={p.title}
                        className="flex items-start gap-2 border-b border-ghost-border-subtle py-1.5 last:border-b-0"
                      >
                        <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ghost-text-primary" />
                        <span className="min-w-0">
                          <span className="text-[12.5px] font-semibold text-ghost-text-primary">
                            {p.title}
                          </span>
                          <span className="block text-[11.5px] leading-snug text-ghost-text-muted">
                            {p.desc}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Composer-style form */}
              <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
                <input
                  ref={firstFieldRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.fullName}
                  autoComplete="name"
                  className="h-10 rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 text-[14px] text-ghost-text-primary outline-none transition-colors placeholder:text-ghost-text-muted focus:border-ghost-text-muted"
                />
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={requireCompany ? t.company : t.companyOptional}
                  autoComplete="organization"
                  className="h-10 rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 text-[14px] text-ghost-text-primary outline-none transition-colors placeholder:text-ghost-text-muted focus:border-ghost-text-muted"
                />
                {requireFullContact && (
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.workEmail}
                    type="email"
                    autoComplete="email"
                    className="h-10 rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 text-[14px] text-ghost-text-primary outline-none transition-colors placeholder:text-ghost-text-muted focus:border-ghost-text-muted"
                  />
                )}
                <div className="relative">
                  <input
                    value={requireFullContact ? phone : contact}
                    onChange={(e) =>
                      requireFullContact
                        ? setPhone(e.target.value)
                        : setContact(e.target.value)
                    }
                    placeholder={
                      requireFullContact ? t.mobilePhone : t.emailOrPhone
                    }
                    type={requireFullContact ? "tel" : undefined}
                    autoComplete={requireFullContact ? "tel" : "email"}
                    className="h-11 w-full rounded-3xl border border-ghost-border-subtle bg-ghost-surface ps-4 pe-12 text-[14px] text-ghost-text-primary outline-none transition-colors placeholder:text-ghost-text-muted focus:border-ghost-text-muted"
                  />
                  <button
                    type="submit"
                    aria-label={t.submitLabel}
                    disabled={!valid}
                    className="absolute end-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ghost-accent text-ghost-bg transition-opacity disabled:opacity-30"
                  >
                    <ArrowUp size={17} strokeWidth={2.5} />
                  </button>
                </div>

                {touched && !valid && (
                  <p className="px-1 text-[12px] text-ghost-error">
                    {requireFullContact
                      ? t.validationFull
                      : requireCompany
                        ? t.validationCompany
                        : t.validation}
                  </p>
                )}

                <p className="mt-0.5 px-1 text-center text-[11px] leading-relaxed text-ghost-text-muted">
                  {t.ndaFootnote}
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
