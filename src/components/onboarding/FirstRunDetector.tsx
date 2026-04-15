import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProviderSetup } from "./ProviderSetup";

export function FirstRunDetector({ children }: { children: React.ReactNode }) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const result = await invoke<boolean>("check_first_run");
        setNeedsSetup(result);
      } catch {
        // If the command doesn't exist yet, skip onboarding
        setNeedsSetup(false);
      }
    }
    check();
  }, []);

  if (needsSetup === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (needsSetup) {
    return <ProviderSetup onComplete={() => setNeedsSetup(false)} />;
  }

  return <>{children}</>;
}
