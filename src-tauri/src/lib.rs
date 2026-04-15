mod fs_watcher;
mod settings;
mod subprocess;

use fs_watcher::{scan_directory, start_watcher};
use notify::RecommendedWatcher;
use serde_json::Value;
use settings::{load_settings, save_settings, AppSettings};
use std::sync::Arc;
use subprocess::SubprocessManager;
use tauri::Emitter;
use tokio::sync::Mutex;
use tracing::info;

struct AppState {
    subprocess: Arc<Mutex<SubprocessManager>>,
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
    settings: Arc<Mutex<AppSettings>>,
}

#[tauri::command]
async fn pi_command(state: tauri::State<'_, AppState>, cmd: Value) -> Result<(), String> {
    let mgr = state.subprocess.lock().await;
    mgr.send_command(&cmd).await
}

#[tauri::command]
async fn pi_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    cwd: Option<String>,
) -> Result<(), String> {
    let mut mgr = state.subprocess.lock().await;
    mgr.start(&app, cwd).await
}

#[tauri::command]
async fn pi_restart(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut mgr = state.subprocess.lock().await;
    mgr.stop().await?;
    mgr.start(&app, None).await
}

#[tauri::command]
async fn pi_stop(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut mgr = state.subprocess.lock().await;
    mgr.stop().await
}

#[tauri::command]
async fn fs_watch(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<Vec<fs_watcher::FileNode>, String> {
    let settings = state.settings.lock().await;
    let nodes = scan_directory(&path, settings.show_gitignored);
    let _ = app.emit("fs:tree", &nodes);

    let watcher = start_watcher(app, path);
    let mut w = state.watcher.lock().await;
    *w = watcher;

    Ok(nodes)
}

#[tauri::command]
async fn open_folder_dialog(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;

    let dialog = app.dialog().file();
    let path = dialog.blocking_pick_folder();

    if let Some(folder) = path {
        let folder_str = folder.to_string();
        info!("Folder selected: {}", folder_str);

        // Update settings
        {
            let mut settings = state.settings.lock().await;
            settings.last_attached_folder = Some(folder_str.clone());
            let _ = save_settings(&settings);
        }

        // Scan and watch
        let settings = state.settings.lock().await;
        let nodes = scan_directory(&folder_str, settings.show_gitignored);
        let _ = app.emit("fs:tree", &nodes);

        let watcher = start_watcher(app.clone(), folder_str.clone());
        let mut w = state.watcher.lock().await;
        *w = watcher;

        // Restart pi with new cwd
        drop(w);
        drop(settings);
        let mut mgr = state.subprocess.lock().await;
        let _ = mgr.stop().await;
        mgr.set_cwd(folder_str);
        let _ = mgr.start(&app, None).await;
    }

    Ok(())
}

#[tauri::command]
async fn get_settings(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state.settings.lock().await;
    Ok(settings.clone())
}

#[tauri::command]
async fn update_settings(
    state: tauri::State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    let mut current = state.settings.lock().await;
    *current = settings;
    save_settings(&current)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    let loaded_settings = load_settings();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            subprocess: Arc::new(Mutex::new(SubprocessManager::new())),
            watcher: Arc::new(Mutex::new(None)),
            settings: Arc::new(Mutex::new(loaded_settings)),
        })
        .invoke_handler(tauri::generate_handler![
            pi_command,
            pi_start,
            pi_restart,
            pi_stop,
            fs_watch,
            open_folder_dialog,
            get_settings,
            update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
