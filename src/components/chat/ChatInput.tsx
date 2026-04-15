import { useState, useRef, useCallback, useEffect } from "react";
import { useStore } from "@/store";
import { usePiCommand } from "@/hooks/usePiCommand";
import { useFileDrop } from "@/hooks/useFileDrop";
import { Send, Square, Paperclip, X } from "lucide-react";
import type { AttachedFile } from "@/types";

export function ChatInput() {
  const [text, setText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentStatus = useStore((s) => s.agentStatus);
  const fileSizeLimit = useStore((s) => s.settings.fileSizeLimit);
  const isStreaming = agentStatus === "thinking";
  const sendCommand = usePiCommand();

  const { handleDrop, handleDragOver } = useFileDrop(
    (files) => {
      setAttachedFiles((prev) => [...prev, ...files]);
      setIsDragging(false);
    },
    fileSizeLimit,
  );

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    // Build message content with attached files as fenced code blocks
    let fullContent = trimmed;
    if (attachedFiles.length > 0) {
      const fileBlocks = attachedFiles
        .map(
          (f) =>
            `\`\`\`${f.language ?? ""} ${f.name}\n${f.content}\n\`\`\``,
        )
        .join("\n\n");
      fullContent = fileBlocks + (trimmed ? "\n\n" + trimmed : "");
    }

    const id = crypto.randomUUID();
    useStore.getState().addMessage({
      id,
      role: "user",
      content: trimmed || "(attached files)",
      timestamp: Date.now(),
      attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
    });

    if (isStreaming) {
      sendCommand({ type: "follow_up", message: fullContent });
    } else {
      sendCommand({ type: "prompt", message: fullContent });
    }

    setText("");
    setAttachedFiles([]);
  }, [text, attachedFiles, isStreaming, sendCommand]);

  const handleAbort = useCallback(() => {
    sendCommand({ type: "abort" });
  }, [sendCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div
      className="border-t border-zinc-800 px-4 py-3"
      onDrop={handleDrop}
      onDragOver={(e) => {
        handleDragOver(e);
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
    >
      <div className="mx-auto max-w-3xl">
        {isDragging && (
          <div className="mb-2 rounded-lg border-2 border-dashed border-blue-500 bg-blue-950/20 px-4 py-3 text-center text-sm text-blue-400">
            Drop files to attach
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {attachedFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              >
                <Paperclip size={10} />
                <span>{f.name}</span>
                <span className="text-zinc-500">
                  ({(f.size / 1024).toFixed(1)} KB)
                </span>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-1 text-zinc-500 hover:text-zinc-300"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2">
          <button
            className="mb-0.5 text-zinc-500 hover:text-zinc-300"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message... (⌘Enter to send)"
            rows={1}
            className="max-h-[200px] flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none"
          />
          {isStreaming ? (
            <button
              onClick={handleAbort}
              className="mb-0.5 rounded-lg bg-red-600 p-1.5 text-white hover:bg-red-700"
              title="Abort (Escape)"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!text.trim() && attachedFiles.length === 0}
              className="mb-0.5 rounded-lg bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-30"
              title="Send (⌘Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
