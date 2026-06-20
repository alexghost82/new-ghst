import { useState } from "react";
import { Brain, X, Activity, Camera, User, Car } from "lucide-react";
import { useLanguageStore } from "../../../stores/languageStore";

// Faithful, isolated replica of `components/shared/MemoryPanel.tsx` — the three
// tabs (tracking / observations / facts), header and tab bar copied 1:1, fed by
// static data. Rendered as a contained panel instead of a full-height aside.
type Tab = "tracking" | "observations" | "facts";

export default function DemoMemoryPanel() {
  const locale = useLanguageStore((s) => s.locale);
  const he = locale === "he";
  const [tab, setTab] = useState<Tab>("tracking");

  const L = he
    ? {
        memory: "\u05d6\u05d9\u05db\u05e8\u05d5\u05df",
        tracking: "\u05de\u05e2\u05e7\u05d1",
        observations: "\u05ea\u05e6\u05e4\u05d9\u05d5\u05ea",
        facts: "\u05e2\u05d5\u05d1\u05d3\u05d5\u05ea",
        trackingOn: "\u05de\u05e2\u05e7\u05d1 \u05e4\u05e2\u05d9\u05dc",
        items: "\u05e4\u05e8\u05d9\u05d8\u05d9\u05dd",
        person: "\u05d0\u05d3\u05dd",
        vehicle: "\u05e8\u05db\u05d1",
        people: "\u05d0\u05e0\u05e9\u05d9\u05dd",
        vehicles: "\u05db\u05dc\u05d9 \u05e8\u05db\u05d1",
        cam: "\u05e9\u05e2\u05e8 \u05e8\u05d0\u05e9\u05d9",
        cam2: "\u05e8\u05e6\u05d9\u05e3 \u05e4\u05e8\u05d9\u05e7\u05d4",
        fact: "\u05e2\u05d5\u05d1\u05d3\u05d4",
        instruction: "\u05d4\u05d5\u05e8\u05d0\u05d4",
        rows: [
          {
            type: "person",
            badge: "bg-sky-500/15 text-sky-400",
            time: "22:14:08",
            main: "\u05d6\u05db\u05e8 \u00b7 \u05de\u05e2\u05d9\u05dc \u05db\u05d4\u05d4 \u05e2\u05dd \u05e7\u05e4\u05d5\u05e9\u05d5\u05df \u00b7 \u05ea\u05d9\u05e7 \u05d2\u05d1 \u05d4\u05d5\u05e9\u05d0\u05e8 \u05e2\u05dc \u05d4\u05e8\u05e6\u05e4\u05d4",
            deep: "\u05e6\u05de\u05d5\u05d3 \u05dc\u05d7\u05dc\u05d5\u05df \u05e2\u05de\u05d3\u05ea \u05d4\u05e9\u05d5\u05de\u05e8, \u05db\u05e3 \u05d9\u05d3 \u05e6\u05de\u05d5\u05d3\u05d4 \u05dc\u05d6\u05db\u05d5\u05db\u05d9\u05ea \u05d5\u05de\u05e6\u05d9\u05e5 \u05e4\u05e0\u05d9\u05de\u05d4.",
          },
          {
            type: "vehicle",
            badge: "bg-amber-500/15 text-amber-400",
            time: "21:52:30",
            main: "\u05e6\u05d4\u05d5\u05d1 \u00b7 \u05de\u05dc\u05d2\u05d6\u05d4 \u00b7 \u05de\u05d9\u05db\u05dc \u05d2\u05d6 \u05de\u05d0\u05d7\u05d5\u05e8",
            deep: "\u05d7\u05d5\u05e0\u05d4 \u05e2\u05dd \u05d4\u05d7\u05e8\u05d8\u05d5\u05dd \u05d0\u05dc \u05e2\u05e8\u05d9\u05de\u05ea \u05d0\u05e8\u05d2\u05d6\u05d9\u05dd \u05d4\u05e0\u05e2\u05e8\u05de\u05ea \u05de\u05d5\u05dc \u05d3\u05dc\u05ea \u05d9\u05e6\u05d9\u05d0\u05ea \u05d4\u05d7\u05d9\u05e8\u05d5\u05dd.",
          },
        ],
        obs: [
          {
            type: "person",
            label: "\u05d0\u05e0\u05e9\u05d9\u05dd",
            badge: "bg-sky-500/15 text-sky-400",
            time: "21:46",
            cam: "\u05e8\u05e6\u05d9\u05e3 \u05e4\u05e8\u05d9\u05e7\u05d4",
            desc: "\u05de\u05e4\u05e2\u05d9\u05dc \u05d1\u05d0\u05e4\u05d5\u05d3 \u05d6\u05d5\u05d4\u05e8 \u05d9\u05e8\u05d3 \u05d5\u05e2\u05e8\u05dd \u05e9\u05e0\u05d9 \u05d0\u05e8\u05d2\u05d6\u05d9\u05dd \u05e2\u05d8\u05d5\u05e4\u05d9 \u05e1\u05e8\u05d8 \u05de\u05d5\u05dc \u05d3\u05dc\u05ea \u05d9\u05e6\u05d9\u05d0\u05ea \u05d4\u05d7\u05d9\u05e8\u05d5\u05dd, \u05d5\u05d0\u05d6 \u05d8\u05d9\u05e4\u05e1 \u05d1\u05d7\u05d6\u05e8\u05d4 \u05dc\u05de\u05dc\u05d2\u05d6\u05d4.",
            chips: ["\u05d0\u05e4\u05d5\u05d3 \u05d6\u05d5\u05d4\u05e8", "\u05d9\u05e6\u05d9\u05d0\u05ea \u05d7\u05d9\u05e8\u05d5\u05dd"],
          },
          {
            type: "vehicle",
            label: "\u05db\u05dc\u05d9 \u05e8\u05db\u05d1",
            badge: "bg-amber-500/15 text-amber-400",
            time: "21:52",
            cam: "\u05e8\u05e6\u05d9\u05e3 \u05e4\u05e8\u05d9\u05e7\u05d4",
            desc: "\u05de\u05dc\u05d2\u05d6\u05d4 \u05e6\u05d4\u05d5\u05d1\u05d4 \u05d7\u05d5\u05e0\u05d4 \u05e2\u05dd \u05d4\u05d7\u05e8\u05d8\u05d5\u05dd \u05d0\u05dc \u05e2\u05e8\u05d9\u05de\u05ea \u05d4\u05d0\u05e8\u05d2\u05d6\u05d9\u05dd, \u05de\u05d9\u05db\u05dc \u05d4\u05d2\u05d6 \u05de\u05d5\u05e8\u05db\u05d1 \u05de\u05d0\u05d7\u05d5\u05e8, \u05d5\u05d7\u05d5\u05e1\u05de\u05ea \u05d0\u05ea \u05d4\u05d2\u05d9\u05e9\u05d4 \u05dc\u05d9\u05e6\u05d9\u05d0\u05d4.",
            chips: ["\u05de\u05dc\u05d2\u05d6\u05d4", "\u05de\u05d9\u05db\u05dc \u05d2\u05d6"],
          },
        ],
        factsList: [
          { type: "\u05d4\u05d5\u05e8\u05d0\u05d4", badge: "bg-violet-500/15 text-violet-400", score: 92, content: "\u05d9\u05e6\u05d9\u05d0\u05ea \u05d4\u05d7\u05d9\u05e8\u05d5\u05dd \u05d1\u05e8\u05e6\u05d9\u05e3 \u05d4\u05e4\u05e8\u05d9\u05e7\u05d4 \u05d7\u05d9\u05d9\u05d1\u05ea \u05dc\u05d4\u05d9\u05e9\u05d0\u05e8 \u05e4\u05e0\u05d5\u05d9\u05d4 \u05ea\u05de\u05d9\u05d3. \u05d0\u05e8\u05d2\u05d6\u05d9\u05dd \u05d0\u05d5 \u05de\u05e9\u05d8\u05d7\u05d9\u05dd \u05de\u05d5\u05dc\u05d4 \u05d4\u05dd \u05d7\u05e8\u05d9\u05d2\u05d4." },
          { type: "\u05e2\u05d5\u05d1\u05d3\u05d4", badge: "bg-emerald-500/15 text-emerald-400", score: 78, content: "\u05d4\u05de\u05dc\u05d2\u05d6\u05d4 \u05d4\u05e6\u05d4\u05d5\u05d1\u05d4 \u05d7\u05d5\u05e0\u05d4 \u05d1\u05d3\u05e8\u05da \u05db\u05dc\u05dc \u05d1\u05de\u05e4\u05e8\u05e5 3 \u05d1\u05d9\u05df \u05e1\u05d1\u05d1\u05d9\u05dd, \u05dc\u05d0 \u05e6\u05de\u05d5\u05d3 \u05dc\u05e7\u05d9\u05e8 \u05d4\u05d9\u05e6\u05d9\u05d0\u05d4." },
        ],
      }
    : {
        memory: "Memory",
        tracking: "Tracking",
        observations: "Observations",
        facts: "Facts",
        trackingOn: "Tracking active",
        items: "items",
        person: "Person",
        vehicle: "Vehicle",
        people: "People",
        vehicles: "Vehicles",
        cam: "Main Gate",
        cam2: "Loading Bay",
        fact: "fact",
        instruction: "instruction",
        rows: [
          {
            type: "person",
            badge: "bg-sky-500/15 text-sky-400",
            time: "22:14:08",
            main: "Male \u00b7 dark hooded coat \u00b7 backpack left on ground",
            deep: "Pressed against the guard-booth window, one hand flat on the glass, peering inside.",
          },
          {
            type: "vehicle",
            badge: "bg-amber-500/15 text-amber-400",
            time: "21:52:30",
            main: "Yellow \u00b7 LPG forklift \u00b7 gas cylinder on rear",
            deep: "Parked nose-in against cartons stacked at the emergency-exit door.",
          },
        ],
        obs: [
          {
            type: "person",
            label: "People",
            badge: "bg-sky-500/15 text-sky-400",
            time: "21:46",
            cam: "Loading Bay",
            desc: "An operator in a hi-vis vest stepped down and stacked two taped cartons in front of the emergency-exit door, then climbed back onto the forklift.",
            chips: ["hi-vis vest", "emergency exit"],
          },
          {
            type: "vehicle",
            label: "Vehicles",
            badge: "bg-amber-500/15 text-amber-400",
            time: "21:52",
            cam: "Loading Bay",
            desc: "Yellow LPG forklift parked nose-in at the carton stack, gas cylinder mounted on the rear, blocking the exit approach.",
            chips: ["forklift", "gas cylinder"],
          },
        ],
        factsList: [
          { type: "instruction", badge: "bg-violet-500/15 text-violet-400", score: 92, content: "The loading-bay emergency exit must stay clear at all times. Boxes or pallets in front of it are an anomaly." },
          { type: "fact", badge: "bg-emerald-500/15 text-emerald-400", score: 78, content: "The yellow forklift is normally parked in bay 3 between runs, not against the exit wall." },
        ],
      };

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`flex-1 px-3 py-2 text-small transition-colors duration-[100ms] ${
        tab === key
          ? "text-ghost-text-primary border-b-2 border-ghost-accent"
          : "text-ghost-text-muted hover:text-ghost-text-secondary"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="bg-ghost-bg-secondary border border-ghost-border-subtle rounded-xl flex flex-col overflow-hidden w-full max-w-[320px]"
      style={{ height: 460 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-ghost-border-subtle">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-ghost-accent" />
          <h2 className="text-title text-ghost-text-primary">{L.memory}</h2>
        </div>
        <span className="p-1.5 rounded-lg text-ghost-text-muted">
          <X size={16} />
        </span>
      </div>

      <div className="flex border-b border-ghost-border-subtle">
        {tabBtn("tracking", L.tracking)}
        {tabBtn("observations", L.observations)}
        {tabBtn("facts", L.facts)}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === "tracking" && (
          <div className="space-y-2">
            <div className="bg-ghost-surface rounded-lg p-2.5 border border-ghost-border-subtle">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-ghost-accent" />
                  <span className="text-xs font-medium text-ghost-text-primary">
                    {L.trackingOn}
                  </span>
                  <span className="text-[10px] text-ghost-text-muted">
                    ({L.rows.length} {L.items})
                  </span>
                </div>
                <span className="relative h-5 w-9 flex-shrink-0 rounded-full bg-ghost-accent" dir="ltr">
                  <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm translate-x-4" />
                </span>
              </div>
            </div>

            {L.rows.map((obj, i) => {
              const Icon = obj.type === "person" ? User : Car;
              const typeLabel = obj.type === "person" ? L.person : L.vehicle;
              return (
                <div
                  key={i}
                  className="bg-ghost-surface rounded-md p-2 border border-ghost-border-subtle"
                >
                  <div className="flex gap-2">
                    <img
                      src={i === 0 ? "/ghost-cam-gate-night.png" : "/ghost-cam-dock-night.png"}
                      alt={typeLabel}
                      className="w-14 h-14 flex-shrink-0 rounded border border-ghost-border-subtle bg-ghost-bg-secondary object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${obj.badge}`}>
                          <Icon size={10} />
                          {typeLabel}
                        </span>
                        <span className="text-[10px] text-ghost-text-muted flex-1 text-end">
                          {obj.time}
                        </span>
                        <span className="text-[10px] text-ghost-text-muted inline-flex items-center gap-0.5">
                          <Camera size={9} />
                          {i === 0 ? L.cam : L.cam2}
                        </span>
                      </div>
                      <p className="text-xs text-ghost-text-secondary leading-snug mb-0.5">
                        {obj.main}
                      </p>
                      <p className="text-[11px] text-ghost-text-secondary leading-snug">
                        {obj.deep}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "observations" && (
          <div className="space-y-4">
            {L.obs.map((o, i) => {
              const Icon = o.type === "person" ? User : Car;
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className="text-ghost-text-secondary" />
                    <h3 className="text-small font-medium text-ghost-text-secondary">
                      {o.label}
                    </h3>
                    <span className="text-xs text-ghost-text-muted">(1)</span>
                  </div>
                  <div className="bg-ghost-surface rounded-lg p-3 border border-ghost-border-subtle">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.badge}`}>
                        {o.label}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-ghost-text-muted">
                        <span>{o.time}</span>
                        <span className="inline-flex items-center gap-1">
                          <Camera size={11} />
                          {o.cam}
                        </span>
                      </div>
                    </div>
                    <p className="text-small text-ghost-text-secondary leading-relaxed mb-1.5">
                      {o.desc}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {o.chips.map((chip) => (
                        <span
                          key={chip}
                          className="text-xs px-2 py-0.5 rounded bg-ghost-surface-hover text-ghost-text-muted"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "facts" && (
          <div className="space-y-2">
            {L.factsList.map((item, i) => (
              <div
                key={i}
                className="group bg-ghost-surface rounded-lg p-3 border border-ghost-border-subtle"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.badge}`}>
                    {item.type}
                  </span>
                  <span className="text-xs text-ghost-text-muted">{item.score}%</span>
                </div>
                <p className="text-small text-ghost-text-secondary leading-relaxed">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
