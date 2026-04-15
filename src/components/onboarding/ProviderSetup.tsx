import { useState } from "react";
import { usePiCommand } from "@/hooks/usePiCommand";
import { Key, Globe, ArrowRight } from "lucide-react";

interface Props {
  onComplete: () => void;
}

interface ProviderOption {
  id: string;
  name: string;
  group: "subscription" | "apikey";
  description: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: "anthropic-subscription",
    name: "Anthropic (Subscription)",
    group: "subscription",
    description: "Use your Anthropic subscription via OAuth",
  },
  {
    id: "anthropic",
    name: "Anthropic (API Key)",
    group: "apikey",
    description: "Use your own Anthropic API key",
  },
  {
    id: "openai",
    name: "OpenAI",
    group: "apikey",
    description: "Use your OpenAI API key",
  },
  {
    id: "google",
    name: "Google (Vertex AI)",
    group: "apikey",
    description: "Use Google Cloud credentials",
  },
];

export function ProviderSetup({ onComplete }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const sendCommand = usePiCommand();

  const handleContinue = async () => {
    if (selected === "anthropic-subscription") {
      // Send /login as prompt to trigger OAuth flow
      await sendCommand({ type: "prompt", message: "/login" });
    }
    onComplete();
  };

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md space-y-6 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-light text-zinc-100">
            Welcome to piChat
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Choose how you&apos;d like to connect to an AI provider
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-medium text-zinc-500 uppercase">
            Subscription
          </h3>
          {PROVIDERS.filter((p) => p.group === "subscription").map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              selected={selected === p.id}
              onSelect={() => setSelected(p.id)}
            />
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-medium text-zinc-500 uppercase">
            API Key
          </h3>
          {PROVIDERS.filter((p) => p.group === "apikey").map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              selected={selected === p.id}
              onSelect={() => setSelected(p.id)}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onComplete}
            className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:border-zinc-600"
          >
            Skip for now
          </button>
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  selected,
  onSelect,
}: {
  provider: ProviderOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
        selected
          ? "border-blue-500 bg-blue-950/30"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center gap-3">
        {provider.group === "subscription" ? (
          <Globe size={18} className="text-zinc-400" />
        ) : (
          <Key size={18} className="text-zinc-400" />
        )}
        <div>
          <div className="text-sm font-medium text-zinc-200">
            {provider.name}
          </div>
          <div className="text-xs text-zinc-500">{provider.description}</div>
        </div>
      </div>
    </button>
  );
}
