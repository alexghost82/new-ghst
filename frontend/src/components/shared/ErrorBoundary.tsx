import { Component, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 gap-3 text-center h-full">
          <p className="text-ghost-text-muted text-small">
            {this.props.fallbackLabel ?? "משהו השתבש בטעינת הפאנל."}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-[13px] font-medium text-ghost-text-secondary bg-ghost-surface hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
          >
            <X size={13} />
            סגור ונסה שוב
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
