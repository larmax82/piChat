import type { StateCreator } from "zustand";
import type { AppSettings, ActivityLogEntry } from "@/types";

export interface SettingsSlice {
  settings: AppSettings;
  settingsOpen: boolean;
  rightPanelOpen: boolean;
  activityLog: ActivityLogEntry[];

  updateSettings: (update: Partial<AppSettings>) => void;
  setSettingsOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  addActivityEntry: (entry: ActivityLogEntry) => void;
  updateActivityEntry: (id: string, update: Partial<ActivityLogEntry>) => void;
  clearActivityLog: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoReattach: true,
  showGitignored: false,
  fileSizeLimit: 500 * 1024,
  theme: "dark",
  fontSize: 14,
  logLevel: "info",
  maxRetries: 5,
  toolApprovalGate: false,
  activityLog: true,
  gitCheckpoint: false,
};

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,
  settingsOpen: false,
  rightPanelOpen: false,
  activityLog: [],

  updateSettings: (update) =>
    set((state) => ({ settings: { ...state.settings, ...update } })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  addActivityEntry: (entry) =>
    set((state) => ({ activityLog: [...state.activityLog, entry] })),
  updateActivityEntry: (id, update) =>
    set((state) => ({
      activityLog: state.activityLog.map((e) =>
        e.id === id ? { ...e, ...update } : e,
      ),
    })),
  clearActivityLog: () => set({ activityLog: [] }),
});
