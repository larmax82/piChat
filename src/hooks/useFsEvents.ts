import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "@/store";
import type { FsEvent, FileNode } from "@/types";

export function useFsEvents() {
  useEffect(() => {
    const unlisten = listen<FsEvent>("fs:event", (e) => {
      const event = e.payload;
      const store = useStore.getState();

      // Track recent event for UI indicators
      store.addRecentEvent({ path: event.path, kind: event.kind });

      // Reconcile the file tree
      store.setFileTree(reconcileTree(store.fileTree, event));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}

function reconcileTree(tree: FileNode[], event: FsEvent): FileNode[] {
  const pathParts = event.path.split("/");
  const fileName = pathParts[pathParts.length - 1];

  switch (event.kind) {
    case "created": {
      // Check if node already exists
      if (tree.some((n) => n.path === event.path)) return tree;
      const newNode: FileNode = {
        path: event.path,
        name: fileName,
        isDir: event.isDir,
        depth: 1, // Will be corrected by next full scan
        children: event.isDir ? [] : undefined,
      };
      return [...tree, newNode].sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }

    case "deleted":
      return tree.filter((n) => !n.path.startsWith(event.path));

    case "modified":
      return tree.map((n) =>
        n.path === event.path
          ? { ...n, lastModified: Date.now() }
          : n,
      );

    case "renamed":
      return tree;

    default:
      return tree;
  }
}
