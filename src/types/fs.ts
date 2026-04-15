export interface FileNode {
  path: string;
  name: string;
  isDir: boolean;
  children?: FileNode[];
  depth: number;
  lastModified?: number;
  size?: number;
}

export type FsEventKind = "created" | "modified" | "deleted" | "renamed";

export interface FsEvent {
  kind: FsEventKind;
  path: string;
  isDir: boolean;
}
