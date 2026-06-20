import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FolderPlus, Inbox, Layers, Plus } from "lucide-react";
import { useT } from "../../utils/i18n";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useLanguageStore } from "../../stores/languageStore";

interface AssignToGroupMenuProps {
  conversationId: string;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

interface PopoverPosition {
  top: number;
  left: number;
  width: number;
}

const POPOVER_WIDTH = 260;
const POPOVER_GUTTER = 8;
const POPOVER_MAX_HEIGHT = 360;

export default function AssignToGroupMenu({
  conversationId,
  anchorRef,
  onClose,
}: AssignToGroupMenuProps) {
  const t = useT();
  const dir = useLanguageStore((s) => s.dir);
  const containerRef = useRef<HTMLDivElement>(null);
  const areas = useConversationGroupsStore((s) => s.areas);
  const groups = useConversationGroupsStore((s) => s.groups);
  const assign = useConversationGroupsStore((s) => s.assignConversation);
  const unassign = useConversationGroupsStore((s) => s.unassignConversation);
  const createArea = useConversationGroupsStore((s) => s.createArea);
  const createGroup = useConversationGroupsStore((s) => s.createGroup);

  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(
    areas[0]?.id ?? null,
  );
  const [creatingAreaName, setCreatingAreaName] = useState<string | null>(null);
  const [creatingGroupName, setCreatingGroupName] = useState<string | null>(null);

  useEffect(() => {
    if (activeAreaId && !areas.find((a) => a.id === activeAreaId)) {
      setActiveAreaId(areas[0]?.id ?? null);
    }
    if (!activeAreaId && areas.length > 0) {
      setActiveAreaId(areas[0].id);
    }
  }, [areas, activeAreaId]);

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      const desiredWidth = Math.min(POPOVER_WIDTH, viewportW - 2 * POPOVER_GUTTER);
      let left: number;
      if (dir === "rtl") {
        left = rect.left;
        if (left + desiredWidth > viewportW - POPOVER_GUTTER) {
          left = viewportW - desiredWidth - POPOVER_GUTTER;
        }
      } else {
        left = rect.right - desiredWidth;
        if (left < POPOVER_GUTTER) left = POPOVER_GUTTER;
      }
      if (left < POPOVER_GUTTER) left = POPOVER_GUTTER;

      let top = rect.bottom + 6;
      if (top + POPOVER_MAX_HEIGHT > viewportH - POPOVER_GUTTER) {
        const above = rect.top - 6 - POPOVER_MAX_HEIGHT;
        if (above > POPOVER_GUTTER) top = above;
        else top = Math.max(POPOVER_GUTTER, viewportH - POPOVER_MAX_HEIGHT - POPOVER_GUTTER);
      }

      setPosition({ top, left, width: desiredWidth });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, dir]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      const inPopover = containerRef.current?.contains(target ?? null);
      const inAnchor = anchorRef.current?.contains(target ?? null);
      if (!inPopover && !inAnchor) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, anchorRef]);

  const groupsForActive = activeAreaId
    ? groups.filter((g) => g.area_id === activeAreaId)
    : [];

  const handleAssignArea = (areaId: string) => {
    assign(conversationId, { areaId, groupId: null });
    onClose();
  };

  const handleAssignGroup = (groupId: string) => {
    assign(conversationId, { areaId: null, groupId });
    onClose();
  };

  const handleUnassign = () => {
    unassign(conversationId);
    onClose();
  };

  const handleCreateArea = () => {
    const name = (creatingAreaName ?? "").trim();
    if (!name) {
      setCreatingAreaName(null);
      return;
    }
    const created = createArea(name);
    setCreatingAreaName(null);
    if (created) setActiveAreaId(created.id);
  };

  const handleCreateGroup = () => {
    const name = (creatingGroupName ?? "").trim();
    if (!name || !activeAreaId) {
      setCreatingGroupName(null);
      return;
    }
    const created = createGroup(activeAreaId, name);
    setCreatingGroupName(null);
    if (created) {
      assign(conversationId, { areaId: null, groupId: created.id });
      onClose();
    }
  };

  if (!position) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="ghost-assign-popover fixed z-[9999] rounded-xl border border-ghost-border-subtle bg-ghost-surface shadow-[0_12px_32px_rgba(0,0,0,0.45)] overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: POPOVER_MAX_HEIGHT,
        pointerEvents: "auto",
      }}
      role="menu"
      dir={dir}
    >
      <div className="px-3 py-2 border-b border-ghost-border-subtle/60 flex items-center gap-2">
        <Layers size={13} className="text-ghost-bronze" />
        <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-ghost-text-muted">
          {t("chooseDestination")}
        </span>
      </div>

      {areas.length === 0 ? (
        <div className="p-3">
          <div className="text-[12.5px] text-ghost-text-secondary leading-relaxed mb-2.5">
            {t("noAreasYet")}
          </div>
          {creatingAreaName !== null ? (
            <input
              value={creatingAreaName}
              autoFocus
              placeholder={t("newAreaPlaceholder")}
              onChange={(e) => setCreatingAreaName(e.target.value)}
              onBlur={handleCreateArea}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleCreateArea();
                if (e.key === "Escape") setCreatingAreaName(null);
              }}
              className="w-full bg-ghost-bg border border-ghost-bronze/50 focus:border-ghost-bronze rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold text-ghost-text-primary focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreatingAreaName("")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-ghost-bronze/12 hover:bg-ghost-bronze/20 text-ghost-bronze text-[12.5px] font-semibold border border-ghost-bronze/30 transition-colors"
            >
              <Plus size={12} />
              {t("addArea")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[112px_minmax(0,1fr)] divide-x divide-ghost-border-subtle/60 rtl:divide-x-reverse min-h-[120px] max-h-[260px] overflow-hidden">
          <div className="overflow-y-auto py-1">
            {areas.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => setActiveAreaId(area.id)}
                onMouseEnter={() => setActiveAreaId(area.id)}
                className={`w-full text-start ps-2.5 pe-2 py-1.5 text-[12.5px] truncate transition-colors ${
                  activeAreaId === area.id
                    ? "bg-ghost-bronze/10 text-ghost-text-primary border-s-2 border-ghost-bronze"
                    : "text-ghost-text-secondary hover:bg-ghost-surface-hover/60 border-s-2 border-transparent"
                }`}
                role="menuitem"
              >
                {area.name}
              </button>
            ))}
            {creatingAreaName !== null ? (
              <input
                value={creatingAreaName}
                autoFocus
                placeholder={t("newAreaPlaceholder")}
                onChange={(e) => setCreatingAreaName(e.target.value)}
                onBlur={handleCreateArea}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") handleCreateArea();
                  if (e.key === "Escape") setCreatingAreaName(null);
                }}
                className="m-1 w-[calc(100%-0.5rem)] bg-ghost-bg border border-ghost-bronze/50 rounded px-1.5 py-1 text-[11.5px] text-ghost-text-primary focus:outline-none focus:border-ghost-bronze"
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreatingAreaName("")}
                className="w-full text-start ps-2.5 pe-2 py-1.5 mt-0.5 text-[11.5px] text-ghost-text-muted hover:text-ghost-bronze hover:bg-ghost-surface-hover/40 transition-colors inline-flex items-center gap-1"
              >
                <Plus size={10} />
                {t("addArea")}
              </button>
            )}
          </div>

          <div className="overflow-y-auto py-1">
            {activeAreaId && (
              <>
                <button
                  type="button"
                  onClick={() => handleAssignArea(activeAreaId)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-ghost-text-secondary hover:bg-ghost-surface-hover/60 hover:text-ghost-text-primary transition-colors"
                  role="menuitem"
                >
                  <FolderPlus size={12} className="text-ghost-bronze/80" />
                  {t("directInArea")}
                </button>

                <div className="my-1 mx-3 h-px bg-ghost-border-subtle/60" />

                {groupsForActive.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleAssignGroup(group.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] text-ghost-text-secondary hover:bg-ghost-surface-hover/60 hover:text-ghost-text-primary transition-colors"
                    role="menuitem"
                  >
                    <span className="truncate inline-flex items-center gap-2">
                      <span className="ghost-group-marker flex-shrink-0" />
                      <span className="truncate">{group.name}</span>
                    </span>
                    <span className="text-[10px] tabular-nums text-ghost-text-muted/80">
                      {group.conversation_ids.length}
                    </span>
                  </button>
                ))}

                {creatingGroupName !== null ? (
                  <div className="px-2 py-1.5">
                    <input
                      value={creatingGroupName}
                      autoFocus
                      placeholder={t("newGroupPlaceholder")}
                      onChange={(e) => setCreatingGroupName(e.target.value)}
                      onBlur={handleCreateGroup}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleCreateGroup();
                        if (e.key === "Escape") setCreatingGroupName(null);
                      }}
                      className="w-full bg-ghost-bg border border-ghost-bronze/40 focus:border-ghost-bronze rounded px-2 py-1 text-[12px] text-ghost-text-primary focus:outline-none"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingGroupName("")}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11.5px] text-ghost-bronze/85 hover:text-ghost-bronze hover:bg-ghost-bronze/8 transition-colors"
                    role="menuitem"
                  >
                    <Plus size={11} />
                    {t("addGroup")}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {areas.length > 0 && (
        <button
          type="button"
          onClick={handleUnassign}
          className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover/60 border-t border-ghost-border-subtle/60 transition-colors"
          role="menuitem"
        >
          <Inbox size={12} />
          {t("targetUnassigned")}
        </button>
      )}
    </div>,
    document.body,
  );
}
