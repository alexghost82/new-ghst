export default function LoadingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      <span
        className="w-1.5 h-1.5 rounded-full bg-ghost-text-muted animate-pulse-dot"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-ghost-text-muted animate-pulse-dot"
        style={{ animationDelay: "200ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-ghost-text-muted animate-pulse-dot"
        style={{ animationDelay: "400ms" }}
      />
    </div>
  );
}
