import GhostIcon from "../shared/GhostIcon";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-ghost-bg flex items-center justify-center cursor-default select-none">
      <div className="relative z-10 opacity-0 animate-splash-in">
        <GhostIcon size={64} />
      </div>
    </div>
  );
}
