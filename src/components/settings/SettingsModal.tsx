import { useStore } from "@/store";
import { useState } from "react";
import { X } from "lucide-react";
import { GeneralTab } from "./GeneralTab";
import { ProvidersTab } from "./ProvidersTab";
import { HooksTab } from "./HooksTab";

type Tab = "general" | "providers" | "hooks";

export function SettingsModal() {
  const settingsOpen = useStore((s) => s.settingsOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const [activeTab, setActiveTab] = useState<Tab>("general");

  if (!settingsOpen) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "providers", label: "Providers" },
    { id: "hooks", label: "Hooks" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="h-[500px] w-[600px] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
          <h2 className="text-sm font-medium text-zinc-200">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex h-[calc(100%-49px)]">
          <div className="w-36 border-r border-zinc-800 bg-zinc-950 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-4 py-1.5 text-left text-sm ${
                  activeTab === tab.id
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "general" && <GeneralTab />}
            {activeTab === "providers" && <ProvidersTab />}
            {activeTab === "hooks" && <HooksTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
