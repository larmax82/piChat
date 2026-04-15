import type { StateCreator } from "zustand";
import type { FileNode } from "@/types";

export interface FsSlice {
  fileTree: FileNode[];
  attachedFolder: string | null;
  panelCollapsed: boolean;
  expandedDirs: Set<string>;
  selectedFiles: Set<string>;
  showGitignored: boolean;
  recentEvents: Array<{ path: string; kind: string; timestamp: number }>;

  setFileTree: (tree: FileNode[]) => void;
  setAttachedFolder: (folder: string | null) => void;
  setPanelCollapsed: (collapsed: boolean) => void;
  togglePanelCollapsed: () => void;
  toggleDirExpanded: (path: string) => void;
  toggleFileSelected: (path: string, multi?: boolean) => void;
  clearSelection: () => void;
  setShowGitignored: (show: boolean) => void;
  addRecentEvent: (event: { path: string; kind: string }) => void;
}

export const createFsSlice: StateCreator<FsSlice> = (set) => ({
  fileTree: [],
  attachedFolder: null,
  panelCollapsed: false,
  expandedDirs: new Set<string>(),
  selectedFiles: new Set<string>(),
  showGitignored: false,
  recentEvents: [],

  setFileTree: (fileTree) => set({ fileTree }),
  setAttachedFolder: (attachedFolder) => set({ attachedFolder }),
  setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
  togglePanelCollapsed: () =>
    set((state) => ({ panelCollapsed: !state.panelCollapsed })),
  toggleDirExpanded: (path) =>
    set((state) => {
      const next = new Set(state.expandedDirs);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { expandedDirs: next };
    }),
  toggleFileSelected: (path, multi) =>
    set((state) => {
      const next = multi ? new Set(state.selectedFiles) : new Set<string>();
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { selectedFiles: next };
    }),
  clearSelection: () => set({ selectedFiles: new Set<string>() }),
  setShowGitignored: (showGitignored) => set({ showGitignored }),
  addRecentEvent: (event) =>
    set((state) => ({
      recentEvents: [
        ...state.recentEvents.filter(
          (e) => Date.now() - e.timestamp < 5000,
        ),
        { ...event, timestamp: Date.now() },
      ],
    })),
});
