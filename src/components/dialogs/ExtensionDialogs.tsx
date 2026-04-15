import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { ExtensionUIRequest } from "@/types";
import { X } from "lucide-react";

interface DialogState {
  id: string;
  method: string;
  title: string;
  options?: string[];
  message?: string;
  placeholder?: string;
  prefill?: string;
}

export function ExtensionDialogs() {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    const unlisten = listen<ExtensionUIRequest>("pi:event", (e) => {
      const event = e.payload;
      if (event.type !== "extension_ui_request") return;

      // Only handle dialog methods
      if (
        event.method === "select" ||
        event.method === "confirm" ||
        event.method === "input" ||
        event.method === "editor"
      ) {
        setDialog({
          id: event.id,
          method: event.method,
          title: event.title,
          options: event.method === "select" ? event.options : undefined,
          message: event.method === "confirm" ? event.message : undefined,
          placeholder: event.method === "input" ? event.placeholder : undefined,
          prefill: event.method === "editor" ? event.prefill : undefined,
        });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (!dialog) return null;

  const respond = async (response: Record<string, unknown>) => {
    await invoke("pi_command", {
      cmd: { type: "extension_ui_response", id: dialog.id, ...response },
    }).catch(() => {});
    setDialog(null);
  };

  const cancel = () =>
    respond({ cancelled: true });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-200">
            {dialog.title}
          </h3>
          <button
            onClick={cancel}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <X size={14} />
          </button>
        </div>

        {dialog.method === "select" && dialog.options && (
          <SelectDialog
            options={dialog.options}
            onSelect={(value) => respond({ value })}
            onCancel={cancel}
          />
        )}

        {dialog.method === "confirm" && (
          <ConfirmDialog
            message={dialog.message ?? ""}
            onConfirm={() => respond({ confirmed: true })}
            onDeny={() => respond({ confirmed: false })}
          />
        )}

        {dialog.method === "input" && (
          <InputDialog
            placeholder={dialog.placeholder}
            onSubmit={(value) => respond({ value })}
            onCancel={cancel}
          />
        )}

        {dialog.method === "editor" && (
          <EditorDialog
            prefill={dialog.prefill}
            onSubmit={(value) => respond({ value })}
            onCancel={cancel}
          />
        )}
      </div>
    </div>
  );
}

function SelectDialog({
  options,
  onSelect,
  onCancel,
}: {
  options: string[];
  onSelect: (value: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-left text-sm text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
        >
          {opt}
        </button>
      ))}
      <button
        onClick={onCancel}
        className="mt-2 w-full text-center text-xs text-zinc-500 hover:text-zinc-400"
      >
        Cancel
      </button>
    </div>
  );
}

function ConfirmDialog({
  message,
  onConfirm,
  onDeny,
}: {
  message: string;
  onConfirm: () => void;
  onDeny: () => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm text-zinc-400">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onDeny}
          className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500"
        >
          Deny
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          Allow
        </button>
      </div>
    </div>
  );
}

function InputDialog({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? "Enter a value..."}
        className="mb-3 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit(value);
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit(value)}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function EditorDialog({
  prefill,
  onSubmit,
  onCancel,
}: {
  prefill?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(prefill ?? "");

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        className="mb-3 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit(value)}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
