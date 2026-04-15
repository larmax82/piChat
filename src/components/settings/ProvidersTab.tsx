import { useStore } from "@/store";
import { usePiCommand } from "@/hooks/usePiCommand";

export function ProvidersTab() {
  const sessionState = useStore((s) => s.sessionState);
  const availableModels = useStore((s) => s.availableModels);
  const sendCommand = usePiCommand();

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [provider, modelId] = e.target.value.split("::");
    if (provider && modelId) {
      await sendCommand({ type: "set_model", provider, modelId });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-300">Current Model</h3>
        {sessionState?.model ? (
          <div className="rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300">
            {sessionState.model.name} ({sessionState.model.provider})
          </div>
        ) : (
          <div className="text-sm text-zinc-500">No model selected</div>
        )}
      </div>

      {availableModels.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-300">Switch Model</h3>
          <select
            onChange={handleModelChange}
            value={
              sessionState?.model
                ? `${sessionState.model.provider}::${sessionState.model.id}`
                : ""
            }
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500"
          >
            <option value="">Select a model...</option>
            {availableModels.map((m) => (
              <option key={`${m.provider}::${m.id}`} value={`${m.provider}::${m.id}`}>
                {m.name} ({m.provider})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-300">API Keys</h3>
        <p className="text-xs text-zinc-500">
          API keys are read from environment variables by <code className="text-zinc-400">pi</code> (e.g.{" "}
          <code className="text-zinc-400">GEMINI_API_KEY</code>,{" "}
          <code className="text-zinc-400">ANTHROPIC_API_KEY</code>). Set them in your shell profile and restart the app.
        </p>
      </div>
    </div>
  );
}
