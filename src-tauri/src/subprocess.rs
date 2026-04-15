use serde_json::Value;
use std::process::Stdio;
use std::sync::Arc;
use tauri::AppHandle;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tracing::{error, info, warn};

#[derive(Debug, Clone, serde::Serialize)]
pub enum ProcessState {
    #[serde(rename = "idle")]
    Idle,
    #[serde(rename = "starting")]
    Starting,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "stopping")]
    Stopping,
    #[serde(rename = "error")]
    Error,
}

pub struct SubprocessManager {
    child: Option<Child>,
    stdin_writer: Option<Arc<Mutex<tokio::process::ChildStdin>>>,
    state: ProcessState,
    restart_count: u32,
    binary_path: Option<String>,
    cwd: Option<String>,
}

impl SubprocessManager {
    pub fn new() -> Self {
        Self {
            child: None,
            stdin_writer: None,
            state: ProcessState::Idle,
            restart_count: 0,
            binary_path: None,
            cwd: None,
        }
    }

    fn resolve_binary(&self) -> String {
        if let Some(ref path) = self.binary_path {
            return path.clone();
        }
        "pi".to_string()
    }

    pub async fn start(&mut self, app: &AppHandle, cwd: Option<String>) -> Result<(), String> {
        if matches!(self.state, ProcessState::Running) {
            return Ok(());
        }

        self.state = ProcessState::Starting;
        let _ = app.emit("pi:process_state", "starting");

        let binary = self.resolve_binary();
        let work_dir = cwd.clone().or_else(|| self.cwd.clone());

        let mut cmd = Command::new(&binary);
        cmd.arg("--mode").arg("rpc").arg("--no-session");

        if let Some(ref dir) = work_dir {
            cmd.arg("--cwd").arg(dir);
            self.cwd = Some(dir.clone());
        }

        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        match cmd.spawn() {
            Ok(mut child) => {
                let stdin = child.stdin.take().ok_or("Failed to take stdin")?;
                let stdout = child.stdout.take().ok_or("Failed to take stdout")?;
                let stderr = child.stderr.take().ok_or("Failed to take stderr")?;

                self.stdin_writer = Some(Arc::new(Mutex::new(stdin)));
                self.child = Some(child);
                self.state = ProcessState::Running;
                let _ = app.emit("pi:process_state", "running");

                // Spawn stdout reader
                let app_handle = app.clone();
                tokio::spawn(async move {
                    // Custom JSONL reader: split only on \n (0x0A)
                    let mut reader = BufReader::new(stdout);
                    let mut line_buf = String::new();
                    loop {
                        line_buf.clear();
                        match reader.read_line(&mut line_buf).await {
                            Ok(0) => break, // EOF
                            Ok(_) => {
                                let line = line_buf.trim_end_matches('\n').trim_end_matches('\r');
                                if line.is_empty() {
                                    continue;
                                }
                                match serde_json::from_str::<Value>(line) {
                                    Ok(parsed) => {
                                        if parsed.get("type").and_then(|t| t.as_str())
                                            == Some("response")
                                        {
                                            let _ = app_handle.emit("pi:response", &parsed);
                                        } else {
                                            let _ = app_handle.emit("pi:event", &parsed);
                                        }
                                    }
                                    Err(e) => {
                                        warn!("Failed to parse JSONL: {e}: {line}");
                                    }
                                }
                            }
                            Err(e) => {
                                error!("Stdout read error: {e}");
                                break;
                            }
                        }
                    }
                    info!("Pi stdout reader finished");
                    let _ = app_handle.emit("pi:process_state", "idle");
                });

                // Spawn stderr reader
                let app_handle2 = app.clone();
                tokio::spawn(async move {
                    let mut reader = BufReader::new(stderr);
                    let mut line_buf = String::new();
                    loop {
                        line_buf.clear();
                        match reader.read_line(&mut line_buf).await {
                            Ok(0) => break,
                            Ok(_) => {
                                let line = line_buf.trim();
                                if !line.is_empty() {
                                    warn!("pi stderr: {}", line);
                                    let _ = app_handle2.emit("pi:stderr", line);
                                }
                            }
                            Err(_) => break,
                        }
                    }
                });

                info!("Pi subprocess started with binary: {}", binary);
                Ok(())
            }
            Err(e) => {
                self.state = ProcessState::Error;
                let _ = app.emit("pi:process_state", "error");
                Err(format!("Failed to spawn pi: {e}"))
            }
        }
    }

    pub async fn send_command(&self, cmd: &Value) -> Result<(), String> {
        let writer = self
            .stdin_writer
            .as_ref()
            .ok_or("No stdin writer available")?;
        let mut stdin = writer.lock().await;
        let line = serde_json::to_string(cmd).map_err(|e| e.to_string())? + "\n";
        stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to stdin: {e}"))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush stdin: {e}"))?;
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<(), String> {
        self.state = ProcessState::Stopping;
        if let Some(ref mut child) = self.child {
            let _ = child.kill().await;
        }
        self.child = None;
        self.stdin_writer = None;
        self.state = ProcessState::Idle;
        Ok(())
    }

    pub fn set_binary_path(&mut self, path: String) {
        self.binary_path = Some(path);
    }

    pub fn set_cwd(&mut self, cwd: String) {
        self.cwd = Some(cwd);
    }
}
