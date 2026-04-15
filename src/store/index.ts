import { create } from "zustand";
import { createPiSlice, type PiSlice } from "./pi-slice";
import { createSessionSlice, type SessionSlice } from "./session-slice";
import { createFsSlice, type FsSlice } from "./fs-slice";
import { createSettingsSlice, type SettingsSlice } from "./settings-slice";

export type AppStore = PiSlice & SessionSlice & FsSlice & SettingsSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createPiSlice(...a),
  ...createSessionSlice(...a),
  ...createFsSlice(...a),
  ...createSettingsSlice(...a),
}));
