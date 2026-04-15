use ignore::WalkBuilder;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::Path;
use std::sync::mpsc;
use std::time::Duration;
use tauri::AppHandle;
use tauri::Emitter;
use tracing::{error, info};

#[derive(Debug, Clone, Serialize)]
pub struct FileNode {
    pub path: String,
    pub name: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
    pub depth: u32,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FsChangeEvent {
    pub kind: String,
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
}

pub fn scan_directory(root: &str, show_gitignored: bool) -> Vec<FileNode> {
    let mut builder = WalkBuilder::new(root);
    builder
        .hidden(false)
        .git_ignore(!show_gitignored)
        .max_depth(Some(10));

    let mut nodes: Vec<FileNode> = Vec::new();

    for entry in builder.build().flatten() {
        let path = entry.path();
        if path.to_str() == Some(root) {
            continue;
        }

        let depth = entry.depth() as u32;
        let is_dir = path.is_dir();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let size = if !is_dir {
            std::fs::metadata(path).ok().map(|m| m.len())
        } else {
            None
        };

        nodes.push(FileNode {
            path: path.to_string_lossy().to_string(),
            name,
            is_dir,
            children: if is_dir { Some(Vec::new()) } else { None },
            depth,
            size,
        });
    }

    nodes
}

pub fn start_watcher(app: AppHandle, root: String) -> Option<RecommendedWatcher> {
    let (tx, rx) = mpsc::channel::<Result<Event, notify::Error>>();

    let mut watcher = RecommendedWatcher::new(tx, Config::default().with_poll_interval(Duration::from_millis(200)))
        .ok()?;

    watcher
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .ok()?;

    let app_handle = app.clone();
    std::thread::spawn(move || {
        // Debounce buffer
        let mut pending: Vec<FsChangeEvent> = Vec::new();
        let debounce = Duration::from_millis(200);

        loop {
            match rx.recv_timeout(debounce) {
                Ok(Ok(event)) => {
                    for path in &event.paths {
                        let kind = match event.kind {
                            notify::EventKind::Create(_) => "created",
                            notify::EventKind::Modify(_) => "modified",
                            notify::EventKind::Remove(_) => "deleted",
                            _ => continue,
                        };
                        pending.push(FsChangeEvent {
                            kind: kind.to_string(),
                            path: path.to_string_lossy().to_string(),
                            is_dir: path.is_dir(),
                        });
                    }
                }
                Ok(Err(e)) => {
                    error!("Watcher error: {e}");
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if !pending.is_empty() {
                        for event in pending.drain(..) {
                            let _ = app_handle.emit("fs:event", &event);
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    info!("Watcher channel disconnected");
                    break;
                }
            }
        }
    });

    Some(watcher)
}
