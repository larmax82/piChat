import { useEffect } from "react";
import { useStore } from "@/store";

export function useResponsiveLayout() {
  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      const store = useStore.getState();

      if (width < 800 && !store.panelCollapsed) {
        store.setPanelCollapsed(true);
      }
      if (width < 600 && store.rightPanelOpen) {
        store.setRightPanelOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    handleResize(); // Check on mount

    return () => window.removeEventListener("resize", handleResize);
  }, []);
}
