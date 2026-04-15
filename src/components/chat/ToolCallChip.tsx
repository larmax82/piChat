import type { ToolExecution } from "@/types";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  FileEdit,
  File,
  Loader2,
  Check,
  X,
} from "lucide-react";

interface Props {
  tool: ToolExecution;
}

const TOOL_ICONS: Record<string, typeof Terminal> = {
  bash: Terminal,
  write: FileEdit,
  edit: FileEdit,
  read: File,
};

export function ToolCallChip({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);

  const Icon = TOOL_ICONS[tool.toolName] ?? Terminal;
  const statusIcon =
    tool.status === "running" ? (
      <Loader2 size={12} className="animate-spin text-blue-400" />
    ) : tool.status === "complete" ? (
      tool.isError ? (
        <X size={12} className="text-red-400" />
      ) : (
        <Check size={12} className="text-green-400" />
      )
    ) : null;

  const summary = getToolSummary(tool);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-zinc-800/50"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-zinc-500" />
        ) : (
          <ChevronRight size={12} className="text-zinc-500" />
        )}
        <Icon size={12} className="text-zinc-400" />
        <span className="font-mono text-zinc-300">{tool.toolName}</span>
        <span className="flex-1 truncate text-zinc-500">{summary}</span>
        {statusIcon}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-3 py-2">
          {tool.toolName === "bash" && (
            <div className="font-mono text-zinc-400">
              $ {(tool.args as { command?: string }).command}
            </div>
          )}
          {(tool.toolName === "write" || tool.toolName === "edit") && (
            <div className="text-zinc-400">
              {(tool.args as { file_path?: string }).file_path}
            </div>
          )}
          {(tool.result || tool.partialResult) && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-zinc-500">
              {tool.result ?? tool.partialResult}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function getToolSummary(tool: ToolExecution): string {
  const args = tool.args as Record<string, string>;
  switch (tool.toolName) {
    case "bash":
      return args.command ?? "";
    case "write":
    case "edit":
    case "read":
      return args.file_path ?? "";
    default:
      return JSON.stringify(tool.args).slice(0, 60);
  }
}
