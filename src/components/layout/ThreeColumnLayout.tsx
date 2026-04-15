import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { useStore } from "@/store";
import { FilePanel } from "./FilePanel";
import { ChatCanvas } from "./ChatCanvas";
import { RightPanel } from "./RightPanel";

const FILE_PANEL_KEY = "piChat:filePanelSize";
const RIGHT_PANEL_KEY = "piChat:rightPanelSize";

function loadSize(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return Number(stored);
  } catch {
    // ignore
  }
  return fallback;
}

function saveSize(key: string, size: number) {
  try {
    localStorage.setItem(key, String(size));
  } catch {
    // ignore
  }
}

export function ThreeColumnLayout() {
  const panelCollapsed = useStore((s) => s.panelCollapsed);
  const rightPanelOpen = useStore((s) => s.rightPanelOpen);

  return (
    <PanelGroup direction="horizontal" className="h-full">
      {!panelCollapsed && (
        <>
          <Panel
            id="file-panel"
            order={1}
            defaultSize={loadSize(FILE_PANEL_KEY, 20)}
            minSize={10}
            maxSize={35}
            onResize={(size) => saveSize(FILE_PANEL_KEY, size)}
          >
            <FilePanel />
          </Panel>
          <PanelResizeHandle className="w-px bg-zinc-700 hover:bg-zinc-500 transition-colors" />
        </>
      )}

      {panelCollapsed && <FilePanel />}

      <Panel id="chat-canvas" order={2} minSize={30}>
        <ChatCanvas />
      </Panel>

      {rightPanelOpen && (
        <>
          <PanelResizeHandle className="w-px bg-zinc-700 hover:bg-zinc-500 transition-colors" />
          <Panel
            id="right-panel"
            order={3}
            defaultSize={loadSize(RIGHT_PANEL_KEY, 20)}
            minSize={10}
            maxSize={35}
            onResize={(size) => saveSize(RIGHT_PANEL_KEY, size)}
          >
            <RightPanel />
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}
