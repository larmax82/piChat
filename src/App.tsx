import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { usePiEvents } from "@/hooks/usePiEvents";
import { useSessionStats } from "@/hooks/useSessionStats";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useExtensionUI } from "@/hooks/useExtensionUI";
import { useFsEvents } from "@/hooks/useFsEvents";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { ExtensionDialogs } from "@/components/dialogs/ExtensionDialogs";

export default function App() {
  usePiEvents();
  useSessionStats();
  useKeyboardShortcuts();
  useExtensionUI();
  useFsEvents();
  useSessionPersistence();
  useResponsiveLayout();

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100">
      <ThreeColumnLayout />
      <SettingsModal />
      <ExtensionDialogs />
    </div>
  );
}
