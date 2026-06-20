import { useEffect } from "react";

import AdminShell from "./AdminShell";
import LoginScreen from "./LoginScreen";
import { useAdminStore } from "./store";
import { Spinner } from "./ui";

export default function AdminApp() {
  const stage = useAdminStore((s) => s.stage);
  const init = useAdminStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  if (stage === "loading") {
    return (
      <div className="ghost-force-dark flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <Spinner label="Loading console…" />
      </div>
    );
  }

  if (stage === "authed") {
    return <AdminShell />;
  }

  return <LoginScreen />;
}
