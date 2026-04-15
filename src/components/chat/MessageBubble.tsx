import type { ChatMessage } from "@/types";
import { ToolCallChip } from "./ToolCallChip";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { useState } from "react";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const [showThinking, setShowThinking] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm text-white">
          {message.attachedFiles && message.attachedFiles.length > 0 && (
            <div className="mb-2 space-y-1">
              {message.attachedFiles.map((f) => (
                <div
                  key={f.path}
                  className="rounded bg-blue-700/50 px-2 py-1 text-xs"
                >
                  📎 {f.name} ({(f.size / 1024).toFixed(1)} KB)
                </div>
              ))}
            </div>
          )}
          <MarkdownRenderer content={message.content} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        {message.thinkingContent && (
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-400"
          >
            <Brain size={12} />
            {showThinking ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            Thinking
          </button>
        )}
        {showThinking && message.thinkingContent && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-500 italic">
            {message.thinkingContent}
          </div>
        )}

        <div className="rounded-2xl rounded-bl-md bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100">
          <MarkdownRenderer content={message.content} />
          {message.isStreaming && (
            <span className="inline-block h-4 w-1 animate-pulse bg-zinc-400" />
          )}
        </div>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1 pl-2">
            {message.toolCalls.map((tc) => (
              <ToolCallChip key={tc.toolCallId} tool={tc} />
            ))}
          </div>
        )}

        {message.model && (
          <div className="pl-1 text-[10px] text-zinc-600">
            {message.model}
          </div>
        )}
      </div>
    </div>
  );
}
