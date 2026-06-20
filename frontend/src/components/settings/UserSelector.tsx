import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import { useT } from "../../utils/i18n";

interface UserSelectorProps {
  onCreateUser: () => void;
}

export default function UserSelector({ onCreateUser }: UserSelectorProps) {
  const { users, activeUserId, setActiveUser } = useUserStore();
  const [open, setOpen] = useState(false);
  const activeUser = users.find((u) => u.id === activeUserId);
  const t = useT();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-ghost-surface border border-ghost-border-subtle text-ghost-text-secondary text-small hover:border-ghost-text-muted transition-colors duration-[100ms]"
      >
        <span className="truncate">
          {activeUser?.nickname || t("noUsers")}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 transition-transform duration-[160ms] ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full start-0 end-0 mb-1 bg-ghost-bg-secondary border border-ghost-border-subtle rounded-lg shadow-lg overflow-hidden z-20 fade-in">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                setActiveUser(user.id);
                setOpen(false);
              }}
              className={`
                w-full text-start px-3 py-2 text-small
                transition-colors duration-[100ms]
                ${
                  user.id === activeUserId
                    ? "text-ghost-accent bg-ghost-surface"
                    : "text-ghost-text-secondary hover:bg-ghost-surface-hover"
                }
              `}
            >
              {user.nickname}
            </button>
          ))}
          <button
            onClick={() => {
              setOpen(false);
              onCreateUser();
            }}
            className="w-full text-start px-3 py-2 text-small text-ghost-accent hover:bg-ghost-surface-hover transition-colors duration-[100ms] border-t border-ghost-border-subtle flex items-center gap-1.5"
          >
            <Plus size={12} />
            {t("addUser")}
          </button>
        </div>
      )}
    </div>
  );
}
