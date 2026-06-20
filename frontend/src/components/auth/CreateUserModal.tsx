import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import GhostIcon from "../shared/GhostIcon";

interface CreateUserModalProps {
  onSuccess: () => void;
  onBack: () => void;
}

export default function CreateUserModal({ onSuccess, onBack }: CreateUserModalProps) {
  const [nickname, setNickname] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { createUser } = useUserStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onBack]);

  const handleSubmit = async () => {
    if (!nickname.trim() || !apiKey.trim()) {
      setError("Nickname and API key are required");
      return;
    }
    setIsLoading(true);
    setError(null);
    const user = await createUser(nickname.trim(), apiKey.trim());
    if (user) {
      setSuccess(true);
      setTimeout(() => onSuccess(), 1200);
    } else {
      setError("Failed to create user");
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 bg-ghost-bg flex items-center justify-center overflow-y-auto py-8" dir="ltr">
      <div className="w-full max-w-sm mx-4 my-auto fade-in">
        <div className="flex flex-col items-center mb-8">
          <GhostIcon size={56} className="mb-4" />
          <h1 className="text-[20px] font-semibold text-ghost-text-primary">
            Create account
          </h1>
        </div>

        {success ? (
          <div className="text-center fade-in">
            <div className="w-12 h-12 rounded-full bg-ghost-success/20 flex items-center justify-center mx-auto mb-3">
              <UserPlus size={20} className="text-ghost-success" />
            </div>
            <p className="text-body text-ghost-text-primary">
              User created successfully
            </p>
            <p className="text-sm text-ghost-text-muted mt-1">
              Returning to login...
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <input
                ref={inputRef}
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nickname"
                className="w-full h-11 bg-ghost-surface border border-ghost-border-subtle rounded-xl px-4 text-[15px] text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-text-secondary transition-colors duration-[160ms]"
              />
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ghost API Key"
                  dir="ltr"
                  className="w-full h-11 bg-ghost-surface border border-ghost-border-subtle rounded-xl px-4 pr-12 text-[15px] text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-text-secondary transition-colors duration-[160ms] text-left"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ghost-text-muted hover:text-ghost-text-primary transition-colors duration-[100ms]"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {error && (
                <p className="text-sm text-ghost-error text-center">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={isLoading || !nickname.trim() || !apiKey.trim()}
                className="w-full h-11 rounded-xl text-[15px] font-medium bg-ghost-accent text-ghost-bg hover:bg-ghost-accent-hover transition-colors duration-[100ms] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? "..." : "Create user"}
                {!isLoading && <UserPlus size={16} />}
              </button>
            </div>

            <button
              onClick={onBack}
              className="block mx-auto mt-6 text-[13px] text-ghost-text-muted hover:text-ghost-text-secondary transition-colors duration-[100ms]"
            >
              Esc to go back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
