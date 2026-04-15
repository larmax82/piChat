import { useEffect } from "react";
import { useStore } from "@/store";
import { usePiCommand } from "@/hooks/usePiCommand";
import { invoke } from "@tauri-apps/api/core";

export function ModelPicker() {
  const availableModels = useStore((s) => s.availableModels);
  const sessionState = useStore((s) => s.sessionState);
  const sendCommand = usePiCommand();

  // Fetch models on mount
  useEffect(() => {
    invoke("pi_command", {
      cmd: { type: "get_available_models" },
    }).catch(() => {});
  }, []);

  if (availableModels.length === 0) return null;

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [provider, modelId] = e.target.value.split("::");
    if (provider && modelId) {
      await sendCommand({ type: "set_model", provider, modelId });
    }
  };

  const currentValue = sessionState?.model
    ? `${sessionState.model.provider}::${sessionState.model.id}`
    : "";

  return (
    <select
      value={currentValue}
      onChange={handleChange}
      className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300 outline-none hover:border-zinc-600 focus:border-zinc-500"
      title="Switch model (⌘L)"
    >
      {availableModels.map((m) => (
        <option key={`${m.provider}::${m.id}`} value={`${m.provider}::${m.id}`}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
