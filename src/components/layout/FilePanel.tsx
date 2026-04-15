import { useRef, useCallback, useEffect } from "react";
import { FolderOpen, ChevronRight, ChevronDown, File } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useStore } from "@/store";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { FileNode } from "@/types";
import { SessionList } from "./SessionList";

function flattenTree(
  nodes: FileNode[],
  expandedDirs: Set<string>,
): FileNode[] {
  // The backend sends a flat list (children are always empty).
  // Visibility is determined by whether all ancestor directories are expanded.
  const dirSet = new Set(nodes.filter((n) => n.isDir).map((n) => n.path));

  function isVisible(path: string): boolean {
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) return true;
    const parentPath = path.substring(0, lastSlash);
    // If the parent is not in the tree it's the scan root — always visible
    if (!dirSet.has(parentPath)) return true;
    return expandedDirs.has(parentPath) && isVisible(parentPath);
  }

  // Depth-1 nodes are direct children of the attached folder — always visible
  return nodes.filter((node) => node.depth === 1 || isVisible(node.path));
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "🟦";
    case "js":
    case "jsx":
      return "🟨";
    case "rs":
      return "🦀";
    case "json":
      return "📋";
    case "md":
      return "📝";
    case "css":
    case "scss":
      return "🎨";
    case "html":
      return "🌐";
    case "toml":
    case "yaml":
    case "yml":
      return "⚙️";
    default:
      return "📄";
  }
}

export function FilePanel() {
  const panelCollapsed = useStore((s) => s.panelCollapsed);
  const attachedFolder = useStore((s) => s.attachedFolder);
  const fileTree = useStore((s) => s.fileTree);
  const expandedDirs = useStore((s) => s.expandedDirs);
  const selectedFiles = useStore((s) => s.selectedFiles);
  const recentEvents = useStore((s) => s.recentEvents);
  const setFileTree = useStore((s) => s.setFileTree);
  const setAttachedFolder = useStore((s) => s.setAttachedFolder);

  // Listen for fs:tree events
  useEffect(() => {
    const unlisten = listen<FileNode[]>("fs:tree", (e) => {
      setFileTree(e.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setFileTree]);

  // Listen for open_folder_dialog results
  useEffect(() => {
    const unlisten = listen<string>("fs:attached", (e) => {
      setAttachedFolder(e.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setAttachedFolder]);

  const flatNodes = flattenTree(fileTree, expandedDirs);
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

  const handleClick = useCallback(
    (node: FileNode, e: React.MouseEvent) => {
      if (node.isDir) {
        useStore.getState().toggleDirExpanded(node.path);
      } else {
        useStore
          .getState()
          .toggleFileSelected(node.path, e.metaKey || e.ctrlKey);
      }
    },
    [],
  );

  const handleOpenFolder = useCallback(async () => {
    try {
      await invoke("open_folder_dialog");
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  }, []);

  if (panelCollapsed) {
    return (
      <div className="flex h-full w-6 flex-col items-center border-r border-zinc-700 bg-zinc-900 pt-2">
        <button
          onClick={() => useStore.getState().togglePanelCollapsed()}
          className="text-zinc-400 hover:text-zinc-200"
          title="Expand file panel"
        >
          <FolderOpen size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-r border-zinc-700 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
        <span className="text-xs font-medium text-zinc-400 uppercase">
          Files
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleOpenFolder}
            className="text-zinc-500 hover:text-zinc-300"
            title="Open folder (⌘O)"
          >
            <FolderOpen size={14} />
          </button>
        </div>
      </div>

      {!attachedFolder && fileTree.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-sm text-zinc-500">
          <FolderOpen size={32} className="mb-2 opacity-50" />
          <p>No folder attached</p>
          <button
            onClick={handleOpenFolder}
            className="mt-2 text-xs text-blue-500 hover:text-blue-400"
          >
            Open a folder (⌘O)
          </button>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-y-auto">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const node = flatNodes[virtualItem.index];
              const isSelected = selectedFiles.has(node.path);
              const recentEvent = recentEvents.find(
                (e) => e.path === node.path,
              );
              const isCreated =
                recentEvent?.kind === "created" &&
                Date.now() - recentEvent.timestamp < 5000;
              const isModified =
                recentEvent?.kind === "modified" &&
                Date.now() - recentEvent.timestamp < 5000;

              return (
                <div
                  key={node.path}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  onClick={(e) => handleClick(node, e)}
                  className={`flex cursor-pointer items-center gap-1 px-2 text-xs hover:bg-zinc-800 ${
                    isSelected ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
                  }`}
                >
                  <span
                    style={{ paddingLeft: `${(node.depth - 1) * 12}px` }}
                    className="flex items-center gap-1"
                  >
                    {node.isDir ? (
                      <>
                        {expandedDirs.has(node.path) ? (
                          <ChevronDown size={12} />
                        ) : (
                          <ChevronRight size={12} />
                        )}
                        <span>📁</span>
                      </>
                    ) : (
                      <>
                        <span className="w-3" />
                        <span>{getFileIcon(node.name)}</span>
                      </>
                    )}
                  </span>
                  <span className="truncate">{node.name}</span>
                  {isCreated && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  )}
                  {isModified && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <SessionList />
    </div>
  );
}
