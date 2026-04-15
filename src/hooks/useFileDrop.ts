import { useCallback } from "react";
import type { AttachedFile } from "@/types";

function detectLanguage(name: string): string | undefined {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    rs: "rust",
    py: "python",
    go: "go",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    toml: "toml",
    yaml: "yaml",
    yml: "yaml",
    sh: "bash",
    sql: "sql",
  };
  return ext ? map[ext] : undefined;
}

export function useFileDrop(
  onFilesAttached: (files: AttachedFile[]) => void,
  fileSizeLimit: number,
) {
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const items = Array.from(e.dataTransfer.files);
      const attached: AttachedFile[] = [];

      for (const file of items) {
        if (file.size > fileSizeLimit) {
          const proceed = window.confirm(
            `${file.name} is ${(file.size / 1024).toFixed(1)} KB, which exceeds the ${(fileSizeLimit / 1024).toFixed(0)} KB limit. Include anyway?`,
          );
          if (!proceed) continue;
        }

        try {
          const text = await file.text();
          attached.push({
            name: file.name,
            path: file.name,
            content: text,
            size: file.size,
            language: detectLanguage(file.name),
          });
        } catch {
          // Binary file — just include metadata
          attached.push({
            name: file.name,
            path: file.name,
            content: `[Binary file: ${file.name}, ${file.size} bytes]`,
            size: file.size,
          });
        }
      }

      if (attached.length > 0) {
        onFilesAttached(attached);
      }
    },
    [onFilesAttached, fileSizeLimit],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return { handleDrop, handleDragOver };
}
