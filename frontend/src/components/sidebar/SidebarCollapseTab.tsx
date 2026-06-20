import { PanelLeftOpen } from "lucide-react";
import { useSidebarStore } from "../../stores/sidebarStore";
import { useT } from "../../utils/i18n";

export default function SidebarCollapseTab() {
  const open = useSidebarStore((s) => s.open);
  const t = useT();

  return (
    <button
      type="button"
      onClick={open}
      className="fixed top-[120px] z-30 inset-inline-start-0 flex items-center justify-center w-7 h-10 rounded-e-md bg-ghost-sidebar border border-ghost-border-subtle border-s-0 text-ghost-text-muted hover:text-ghost-bronze hover:bg-ghost-bronze/10 hover:border-ghost-bronze/30 transition-all duration-[200ms] shadow-[2px_0_8px_rgb(0_0_0/0.12)]"
      aria-label={t("openSidebar")}
      title={t("openSidebar")}
    >
      <PanelLeftOpen size={16} className="rtl:scale-x-[-1]" aria-hidden="true" />
    </button>
  );
}
