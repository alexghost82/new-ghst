import {
  Layers,
  Plus,
  ChevronDown,
  Video,
  MoreHorizontal,
  Trash2,
  Radio,
  GripVertical,
  Camera,
  Clock3,
  ShieldAlert,
  Pencil,
  FolderPlus,
} from "lucide-react";
import { useLanguageStore } from "../../../stores/languageStore";

// Faithful, isolated replica of the sidebar organisation tree
// (`ConversationGroupsTree` + `AreaNode` + `GroupNode` + `ConversationItem`).
// Drag-and-drop and store wiring are removed; the markup and `ghost-*` classes
// are copied 1:1 so it looks identical to the live sidebar.

type ConvStatus = "live" | "camera" | "alert" | "messages";

interface ConvRow {
  title: string;
  time: string;
  status: ConvStatus;
  statusLabel: string;
  active?: boolean;
}

function ConvItem({ row, indent }: { row: ConvRow; indent: 0 | 1 | 2 }) {
  const statusNode = (() => {
    if (row.status === "alert") {
      return (
        <span className="inline-flex items-center gap-1 text-ghost-error">
          <ShieldAlert size={11} strokeWidth={2.2} className="flex-shrink-0" />
          <span className="truncate">{row.statusLabel}</span>
        </span>
      );
    }
    if (row.status === "live") {
      return (
        <span className="inline-flex items-center gap-1.5 text-ghost-text-secondary">
          <span className="ghost-conv-status-dot" aria-hidden="true" />
          <span className="truncate">{row.statusLabel}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-ghost-text-muted">
        <Video size={11} className="flex-shrink-0 opacity-80" />
        <span className="truncate">{row.statusLabel}</span>
      </span>
    );
  })();

  return (
    <div
      className={[
        "ghost-conv-item group w-full text-start ps-1.5 pe-2 py-2 cursor-pointer relative",
        indent === 1 ? "ghost-conv-item--indent-1" : "",
        indent === 2 ? "ghost-conv-item--indent-2" : "",
        row.active ? "ghost-conv-item--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="ghost-conv-drag-handle flex-shrink-0 flex items-center justify-center w-3.5 self-center rounded text-ghost-text-muted/35 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={14} aria-hidden="true" />
        </span>
        <div
          className={[
            "ghost-conv-avatar flex-shrink-0 self-center relative",
            row.status === "live" ? "ghost-conv-avatar--live" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          <span className="ghost-conv-avatar__icon">
            <Camera size={17} strokeWidth={1.75} />
          </span>
          {row.status === "live" && (
            <span className="ghost-conv-live-dot" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              {row.status === "alert" && (
                <ShieldAlert
                  size={13}
                  className="flex-shrink-0 text-ghost-error animate-pulse"
                />
              )}
              <p
                className={`text-[14px] truncate leading-snug ${
                  row.active
                    ? "text-ghost-text-primary font-semibold"
                    : "text-ghost-text-primary font-medium"
                }`}
              >
                {row.title}
              </p>
            </div>
            <div className="ghost-conv-endcap relative flex-shrink-0 self-start h-[18px]">
              <span className="ghost-conv-meta inline-flex items-center gap-1 text-[11px] leading-none text-ghost-text-muted/90 tabular-nums whitespace-nowrap">
                <Clock3 size={10} strokeWidth={2} className="flex-shrink-0 opacity-70" />
                <span className="truncate">{row.time}</span>
              </span>
              <div className="ghost-conv-actions absolute top-0 end-0 flex items-center gap-0.5">
                <span className="w-6 h-6 flex items-center justify-center rounded-md text-ghost-text-muted">
                  <FolderPlus size={14} />
                </span>
                <span className="w-6 h-6 flex items-center justify-center rounded-md text-ghost-text-muted">
                  <Pencil size={14} />
                </span>
                <span className="w-6 h-6 flex items-center justify-center rounded-md text-ghost-text-muted">
                  <Trash2 size={14} />
                </span>
              </div>
            </div>
          </div>
          <div className="ghost-conv-subtitle mt-1 text-[11.5px] leading-none truncate">
            {statusNode}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DemoSidebarTree() {
  const locale = useLanguageStore((s) => s.locale);
  const he = locale === "he";

  const t = he
    ? {
        organize: "\u05d0\u05e8\u05d2\u05d5\u05df \u05e9\u05d9\u05d7\u05d5\u05ea",
        addArea: "\u05d4\u05d5\u05e1\u05e3 \u05d0\u05d9\u05d6\u05d5\u05e8",
        areaName: "\u05d7\u05e6\u05e8 \u05e6\u05e4\u05d5\u05e0\u05d9\u05ea",
        groupName: "\u05e9\u05e2\u05e8\u05d9\u05dd",
        newGroup: "\u05e9\u05dd \u05e7\u05d1\u05d5\u05e6\u05d4 \u05d7\u05d3\u05e9\u05d4...",
        unassigned: "\u05e9\u05d9\u05d7\u05d5\u05ea \u05dc\u05dc\u05d0 \u05e9\u05d9\u05d5\u05da",
        gate: "\u05e9\u05e2\u05e8 \u05e8\u05d0\u05e9\u05d9",
        side: "\u05e9\u05e2\u05e8 \u05e6\u05d3\u05d3\u05d9",
        dock: "\u05e8\u05e6\u05d9\u05e3 \u05e4\u05e8\u05d9\u05e7\u05d4",
        lobby: "\u05dc\u05d5\u05d1\u05d9 \u05db\u05e0\u05d9\u05e1\u05d4",
        live: "\u05d7\u05d9",
        alert: "\u05de\u05e6\u05d1 \u05d4\u05ea\u05e8\u05d0\u05d4",
        oneCam: "\u05de\u05e6\u05dc\u05de\u05d4 1",
        now: "\u05e2\u05db\u05e9\u05d9\u05d5",
        min: "\u05dc\u05e4\u05e0\u05d9 3 \u05d3\u05e7\u05f3",
        hr: "\u05dc\u05e4\u05e0\u05d9 2 \u05e9\u05e2\u05f3",
      }
    : {
        organize: "Organize conversations",
        addArea: "Add area",
        areaName: "North Yard",
        groupName: "Gates",
        newGroup: "New group name...",
        unassigned: "Unassigned conversations",
        gate: "Main Gate",
        side: "Side Gate",
        dock: "Loading Bay",
        lobby: "Entrance Lobby",
        live: "Live",
        alert: "Alert mode",
        oneCam: "1 camera",
        now: "now",
        min: "3m ago",
        hr: "2h ago",
      };

  return (
    <div className="bg-ghost-sidebar p-2 h-full overflow-y-auto" style={{ maxWidth: 320 }}>
      <div className="ghost-groups-tree">
        <div className="ghost-groups-toolbar flex items-center justify-between gap-2 px-2 pt-2 pb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Layers size={12} className="text-ghost-text-muted flex-shrink-0" />
            <span className="text-[12px] font-semibold text-ghost-text-secondary truncate">
              {t.organize}
            </span>
          </div>
          <span className="ghost-groups-add-btn inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium text-ghost-text-secondary flex-shrink-0">
            <Plus size={12} />
            <span>{t.addArea}</span>
          </span>
        </div>

        <div className="ghost-areas-list space-y-2.5">
          <div className="ghost-area-node">
            <div className="ghost-area-header group/a flex items-center gap-2.5 ps-3 pe-2 py-2.5 select-none">
              <span className="flex-shrink-0 -m-1 p-1 rounded-md">
                <ChevronDown size={14} className="ghost-area-chevron text-ghost-text-muted" />
              </span>
              <span className="flex-1 min-w-0 text-start truncate text-[14px] font-semibold text-ghost-text-primary">
                {t.areaName}
              </span>
              <span className="ghost-area-stat flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums leading-none px-2 py-0.5 rounded-full text-ghost-text-secondary border border-ghost-border-subtle bg-ghost-surface/60">
                <Video size={11} aria-hidden="true" />
                <span>3</span>
                <span className="w-px h-3 bg-ghost-border-subtle/80 mx-0.5" aria-hidden="true" />
                <span className="inline-flex items-center gap-0.5 text-ghost-text-muted/85">
                  <Layers size={10} aria-hidden="true" />1
                </span>
              </span>
              <div className="ghost-area-actions flex items-center gap-0.5 flex-shrink-0">
                <span className="p-1.5 rounded-md text-ghost-text-muted">
                  <Radio size={13} />
                </span>
                <span className="p-1.5 rounded-md text-ghost-text-muted">
                  <Plus size={13} />
                </span>
                <span className="p-1.5 rounded-md text-ghost-text-muted">
                  <MoreHorizontal size={13} />
                </span>
                <span className="p-1.5 rounded-md text-ghost-text-muted">
                  <Trash2 size={13} />
                </span>
              </div>
            </div>

            <div className="ghost-area-body">
              <div className="ghost-area-new-group mx-2 mb-2 px-2.5 py-2 rounded-lg border border-ghost-border-subtle bg-ghost-surface/40 flex items-center gap-2">
                <Layers size={12} className="text-ghost-text-muted flex-shrink-0" />
                <span className="flex-1 min-w-0 text-[13px] text-ghost-text-muted/70">
                  {t.newGroup}
                </span>
              </div>

              <div className="ghost-area-groups space-y-1.5">
                <div className="ghost-group-node">
                  <div className="ghost-group-header group/g flex items-center gap-2 ps-2.5 pe-2 py-2 select-none">
                    <span className="ghost-group-drag-handle flex-shrink-0 -ms-1 flex items-center justify-center w-4 self-center rounded text-ghost-text-muted/35">
                      <GripVertical size={13} aria-hidden="true" />
                    </span>
                    <span className="flex-shrink-0 -m-1 p-1 rounded-md">
                      <ChevronDown size={12} className="ghost-group-chevron text-ghost-text-muted/80" />
                    </span>
                    <span className="ghost-group-marker flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0 text-start truncate text-[12.5px] font-semibold tracking-wide text-ghost-text-secondary">
                      {t.groupName}
                    </span>
                    <span className="ghost-group-stat flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium tabular-nums leading-none px-1.5 py-0.5 rounded-full text-ghost-text-secondary border border-ghost-border-subtle bg-ghost-surface/40">
                      <Video size={10} aria-hidden="true" />
                      <span>2</span>
                    </span>
                    <div className="ghost-group-actions flex items-center gap-0.5 flex-shrink-0">
                      <span className="p-1.5 rounded-md text-ghost-text-muted">
                        <Radio size={12} />
                      </span>
                      <span className="p-1.5 rounded-md text-ghost-text-muted">
                        <MoreHorizontal size={12} />
                      </span>
                      <span className="p-1.5 rounded-md text-ghost-text-muted">
                        <Trash2 size={12} />
                      </span>
                    </div>
                  </div>
                  <div className="ghost-group-body">
                    <div className="space-y-1 px-1">
                      <ConvItem
                        row={{ title: t.gate, time: t.live, status: "live", statusLabel: t.live, active: true }}
                        indent={2}
                      />
                      <ConvItem
                        row={{ title: t.side, time: t.min, status: "alert", statusLabel: t.alert }}
                        indent={2}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="ghost-area-direct">
                <div className="ghost-area-direct-label ps-3 pe-2 pt-2.5 pb-1.5 text-[11px] font-semibold text-ghost-text-muted/85">
                  {he ? "\u05d9\u05e9\u05d9\u05e8\u05d5\u05ea \u05d1\u05d0\u05d6\u05d5\u05e8" : "Directly in area"}
                </div>
                <div className="space-y-1 px-1">
                  <ConvItem
                    row={{ title: t.dock, time: t.hr, status: "camera", statusLabel: t.oneCam }}
                    indent={1}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ghost-groups-section-divider mt-4 mb-1.5 px-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ghost-text-muted">
            {t.unassigned}
            <span className="tabular-nums px-1.5 py-0.5 rounded-full bg-ghost-surface text-ghost-text-secondary text-[11px] leading-none">
              1
            </span>
          </span>
        </div>
        <div className="space-y-1 px-1">
          <ConvItem
            row={{ title: t.lobby, time: t.now, status: "camera", statusLabel: t.oneCam }}
            indent={0}
          />
        </div>
      </div>
    </div>
  );
}
