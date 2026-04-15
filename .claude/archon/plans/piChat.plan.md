# piChat — Corrected Implementation Plan

| | |
|---|---|
| **Status** | Draft v1.0 |
| **Date** | April 2026 |
| **Source PRD** | `PRD.md` |
| **RPC Reference** | `pi-mono/packages/coding-agent/docs/rpc.md` |
| **RPC Types** | `pi-mono/packages/coding-agent/src/modes/rpc/rpc-types.ts` |

---

## Protocol Corrections Applied

The following errors in the PRD have been corrected throughout this plan based on a direct cross-reference with the actual pi-mono RPC protocol source:

| # | PRD Error | Correct Behaviour |
|---|---|---|
| C1 | Cancel command is `interrupt` | Correct command is **`abort`** (`{"type":"abort"}`) |
| C2 | `session_shutdown` handled as stdout RPC event | `session_shutdown` is an **internal extension hook event only** — not emitted on stdout; remove from event handler |
| C3 | `session_stats` as a pushed/subscribed event | `get_session_stats` is a **pull command** only; toolbar context indicator must **poll** (suggest every 10 s) |
| C4 | `tool_use` / `tool_result` as `message_update` sub-types | Tool call streaming uses **`toolcall_start` / `toolcall_delta` / `toolcall_end`** inside `message_update.assistantMessageEvent`; separate **`tool_execution_start` / `tool_execution_update` / `tool_execution_end`** events (with `toolCallId`) carry actual execution state |
| C5 | Model switch requires subprocess restart | **`set_model`** RPC command switches model in-process; no restart needed (PRD §13 open question resolved) |
| C6 | OAuth emits `onAuth` / `onDeviceCode` / `onPrompt` events | OAuth is triggered by sending `/login` as a `prompt` command; pi then emits standard **`extension_ui_request`** events with `method: "input" | "confirm" | "select"` |
| C7 | Hook/extension files live at `hooks/` subdirectory | Extensions live at **`~/.pi/agent/extensions/`** (global) or **`.pi/extensions/`** (project-local); **no `hooks/` subdirectory** |
| C8 | Missing RPC commands | Must also implement: **`steer`**, **`follow_up`**, **`new_session`**, **`set_model`**, **`compact`**, **`abort_retry`** |
| C9 | Missing RPC events | Must also handle: **`compaction_start/end`** (show indicator), **`auto_retry_start/end`** (show retry pill), **`queue_update`** (show pending count) |

---

## Technology Stack

### Frontend
| Package | Version | Purpose |
|---|---|---|
| `react` + `react-dom` | ^19 | UI framework |
| `@tauri-apps/api` | ^2 | IPC bridge |
| `zustand` | ^5 | Global state |
| `@tanstack/react-virtual` | ^3 | Virtualised file tree |
| `react-markdown` + `remark-gfm` | latest | Markdown rendering |
| `shiki` | ^1 | Code block highlighting |
| `react-resizable-panels` | ^2 | Drag-resize layout |
| `@radix-ui/react-*` | latest | Accessible primitives |
| `tailwindcss` | ^4 | Utility styling |
| `lucide-react` | ^0.4 | Icons |

### Backend (Rust / Tauri)
| Crate | Version | Purpose |
|---|---|---|
| `tauri` | ^2 | App framework |
| `notify` | ^6 | Cross-platform FS watching |
| `ignore` | ^0.4 | gitignore-aware directory walk |
| `tokio` | ^1 | Async runtime |
| `serde` + `serde_json` | ^1 | Serialisation |
| `tracing` + `tracing-subscriber` | ^0.3 | Structured logging |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (React / TypeScript)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  File Panel  │  │  Chat Canvas │  │ Right Panel   │ │
│  │  (FS tree)   │  │  (messages)  │  │ (activity log)│ │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘ │
│         │  Zustand store  │                             │
│         └────────┬────────┘                            │
│               invoke() / listen()                       │
└───────────────────┬─────────────────────────────────────┘
                    │ Tauri IPC
┌───────────────────┴─────────────────────────────────────┐
│  Tauri Backend (Rust)                                   │
│  ┌─────────────────────┐   ┌─────────────────────────┐  │
│  │  Subprocess Manager │   │  Filesystem Watcher     │  │
│  │  (pi lifecycle)     │   │  (notify crate)         │  │
│  └──────────┬──────────┘   └─────────────────────────┘  │
│             │ stdin/stdout JSONL                         │
└─────────────┼───────────────────────────────────────────┘
              │
┌─────────────┴───────────────────────────────────────────┐
│  pi CLI process                                         │
│  pi --mode rpc --no-session --cwd <folder>              │
└─────────────────────────────────────────────────────────┘
```

---

## Milestone Plan

### M0 — Repository Scaffold (Week 2)

**Deliverables:**
- Tauri 2 + React 19 + TypeScript + Tailwind project initialised via `create-tauri-app`
- ESLint + Prettier + rustfmt configured; pre-commit hooks via Husky
- GitHub Actions CI: `cargo test`, `cargo clippy`, `tsc --noEmit`, lint, on every PR
- Vitest for unit tests; Playwright for E2E (skeleton)
- Three-panel layout skeleton with `react-resizable-panels` — File Panel (280 px), Chat Canvas (flex), Right Panel (hidden)
- Panel width persistence in `localStorage`; restore on launch
- Zustand store initialised with slices: `pi`, `session`, `fs`, `settings`
- Tauri `allowlist` locked down: renderer has no raw FS/subprocess access — all calls go through named `invoke` commands

**Key files:**
```
src-tauri/
  src/
    main.rs
    lib.rs            # tauri::Builder setup
    subprocess.rs     # M1 scaffold
    fs_watcher.rs     # M4 scaffold
    settings.rs       # M8 scaffold
src/
  App.tsx
  store/
    pi-slice.ts
    session-slice.ts
    fs-slice.ts
    settings-slice.ts
  components/
    layout/
      ThreeColumnLayout.tsx
      FilePanel.tsx
      ChatCanvas.tsx
      RightPanel.tsx
```

---

### M1 — Subprocess Manager & RPC Transport (Week 4)

**Core task:** Spawn and manage the pi CLI process; implement the complete JSONL line reader and RPC dispatcher.

#### 1.1 Process Lifecycle

```rust
// src-tauri/src/subprocess.rs
pub struct SubprocessManager {
    child: Option<Child>,
    state: ProcessState,  // Idle | Starting | Running | Stopping | Error
    restart_count: u32,
}
```

- Resolve binary: (1) user settings override, (2) sidecar bundled binary, (3) PATH
- Spawn: `pi --mode rpc --no-session --cwd <folder>`
- Pipe stdin as writable; stdout as readable
- On unexpected exit: exponential backoff (500 ms → 1 s → 2 s → 4 s, max 30 s), max 5 retries
- On app quit: SIGTERM → wait 3 s → SIGKILL
- Log all raw stdout/stderr to rotating file at `~/.pi-mono-shell/logs/`

#### 1.2 JSONL Line Reader (CRITICAL)

> **Do NOT use Node readline or Rust's `BufRead::lines()`** — both split on Unicode line separators (U+2028, U+2029) which are valid inside JSON strings.

```rust
// Custom reader: accumulate bytes until b'\n', then parse
async fn read_jsonl_lines(reader: impl AsyncRead) -> impl Stream<Item = String> {
    // Buffer bytes; split only on b'\n' (0x0A)
    // Strip trailing \r if present (for \r\n input tolerance)
    // Emit complete lines
}
```

#### 1.3 RPC Command Dispatch (Shell → pi stdin)

All commands serialised as one JSON object per line + `\n`.

**Full command set to implement (C8 — corrected):**

| Command | Type string | When used |
|---|---|---|
| Send prompt | `prompt` | User submits message |
| Steer agent | `steer` | Mid-stream course correction |
| Follow-up | `follow_up` | Queue message for after agent finishes |
| **Abort (C1)** | `abort` | Escape / Cancel button — NOT `interrupt` |
| Abort retry | `abort_retry` | Cancel in-progress retry delay |
| New session | `new_session` | ⌘N |
| Set model | `set_model` | Model picker dropdown (no restart — C5) |
| Get state | `get_state` | On connect / session restore |
| Get session stats | `get_session_stats` | **Polled every 10 s** (C3 — NOT subscribed) |
| Compact | `compact` | Manual compact button |
| Get available models | `get_available_models` | Populating model picker |

```rust
pub async fn send_command(&self, cmd: RpcCommand) -> Result<()> {
    let line = serde_json::to_string(&cmd)? + "\n";
    self.stdin.write_all(line.as_bytes()).await?;
    Ok(())
}
```

#### 1.4 RPC Event Handling (pi stdout → Shell)

Parse each stdout line and dispatch to the Tauri event bus.

**Complete event table (corrected — C2, C4, C9):**

| Event type | `assistantMessageEvent.type` | Shell action |
|---|---|---|
| `agent_start` | — | Set status → Thinking; show streaming cursor |
| `agent_end` | — | Set status → Idle; mark message complete |
| `turn_start` | — | (internal bookkeeping) |
| `turn_end` | — | Persist turn to session file |
| `message_start` | — | Create new message bubble |
| `message_update` | `text_delta` | Append delta string to streaming bubble |
| `message_update` | `text_start/end` | Begin/finalise text block |
| `message_update` | `thinking_start/delta/end` | Show/stream/hide thinking block |
| `message_update` | `toolcall_start` | Create tool-call chip (pending) — C4 |
| `message_update` | `toolcall_delta` | Stream tool call args into chip — C4 |
| `message_update` | `toolcall_end` | Chip shows tool name + full args — C4 |
| `message_update` | `done` / `error` | Mark message stream ended |
| `message_end` | — | Finalise bubble |
| `tool_execution_start` | — | Mark chip as "Running" (by `toolCallId`) — C4 |
| `tool_execution_update` | — | Stream partial result into chip — C4 |
| `tool_execution_end` | — | Show result / error in chip — C4 |
| `queue_update` | — | Show pending message count badge — C9 |
| `compaction_start` | — | Show "Compacting…" indicator — C9 |
| `compaction_end` | — | Hide indicator; update token stats — C9 |
| `auto_retry_start` | — | Show retry pill ("Retry 1/3, wait 2 s") — C9 |
| `auto_retry_end` | — | Hide retry pill; show success or final error — C9 |
| `extension_ui_request` | — | Route to UI request handler (auth, hooks) |
| `extension_error` | — | Show error toast in toolbar |

> **Removed from PRD (C2):** `session_shutdown` is NOT a stdout event. Do not handle it here.
> `session_shutdown` is an internal extension hook — it fires inside pi's extension system and is never emitted to stdout.

#### 1.5 Toolbar Context Indicator — Polling (C3)

```typescript
// src/hooks/useSessionStats.ts
useEffect(() => {
  const poll = setInterval(async () => {
    await invoke('pi_command', { cmd: { type: 'get_session_stats' } });
    // response arrives as a pi:response event with command: 'get_session_stats'
  }, 10_000);
  return () => clearInterval(poll);
}, [isConnected]);
```

> **Corrected:** `session_stats` is NOT a pushed event. The toolbar context-window indicator must poll via `get_session_stats` (pull command). Poll every 10 s while agent is idle; optionally poll once after each `agent_end`.

---

### M2 — Chat UI (Week 6)

**Deliverables:**
- Message list component with auto-scroll (anchored to bottom unless user has scrolled up)
- Streaming message bubble: append `text_delta` tokens in real time; blinking cursor during generation
- Markdown rendering: `react-markdown` + `remark-gfm`; fenced code blocks with `shiki` highlighting + copy button
- Tool-call chips — corrected two-phase rendering (C4):
  - **Phase 1 (toolcall_start/delta/end in `message_update`):** Chip created when `toolcall_start` fires; args streamed via `toolcall_delta`; chip shows full args on `toolcall_end`
  - **Phase 2 (tool_execution_* events):** Same chip transitions to "Running" on `tool_execution_start` (matched by `toolCallId`); streams partial output on `tool_execution_update`; shows result/error on `tool_execution_end`
- Tool-specific chip UI:
  - **`bash`** — command + exit code + stdout/stderr (20 lines, expandable)
  - **`write` / `edit`** — filename + diff preview
  - **`read`** — filename only
- Status pills: Idle / Thinking / Compacting / Retrying (N/M) / Error
- Queue indicator badge (from `queue_update.steering.length + queue_update.followUp.length`) — C9
- Abort button (sends `{"type":"abort"}`) visible during streaming — C1
- Input area: multi-line auto-grow textarea; Send (⌘Enter), Attach, Steer (mid-stream shortcut)
- Message bubble: user right-aligned; assistant left-aligned

---

### M3 — Provider Onboarding & Auth (Week 8)

**Deliverables:**
- First-run detection: check for `~/.pi/agent/auth.json` existence and absence of recognised API key env vars
- Provider Setup screen with provider list (Subscription vs API Key groups)
- Settings → Providers tab: active provider, model, API keys (OS keychain via Tauri `stronghold`)
- Env var forwarding: construct clean subprocess environment (PATH + HOME + explicit allow-list)

#### 3.1 OAuth Flow (C6 — corrected)

> **Corrected:** OAuth is NOT driven by `onAuth` / `onDeviceCode` / `onPrompt` events. The shell sends `/login` as a prompt command; pi then emits `extension_ui_request` events on stdout.

```
User clicks "Login" in Settings
  → shell sends: {"type": "prompt", "message": "/login"}
  → pi emits: extension_ui_request events (method: "input" | "confirm" | "select")
```

**`extension_ui_request` method → shell action mapping:**

| `method` | Shell action |
|---|---|
| `"select"` | Show modal with option list; respond with selected string |
| `"confirm"` | Show confirm dialog; respond with `confirmed: true/false` |
| `"input"` | Show text input (e.g. for device code, URL); respond with entered value |
| `"notify"` | Show toast notification; no response needed |
| `"setStatus"` | Update status bar text; no response needed |
| `"setWidget"` | Display inline widget above/below editor; no response needed |
| `"setTitle"` | Update window title; no response needed |

For OAuth URL opening: if an `input` request message contains a URL (`https://`), open it in the system browser via `shell::open()` (Tauri) in addition to showing the input field.

**Response:**
```json
{"type": "extension_ui_response", "id": "<matching id>", "value": "<user input>"}
// or
{"type": "extension_ui_response", "id": "<matching id>", "confirmed": true}
// or
{"type": "extension_ui_response", "id": "<matching id>", "cancelled": true}
```

#### 3.2 Model Switching (C5 — resolved)

> **Resolved PRD §13 open question:** Model switching does NOT require subprocess restart.

```typescript
// Model picker dropdown onChange:
await invoke('pi_command', {
  cmd: { type: 'set_model', provider: selectedProvider, modelId: selectedModelId }
});
// Response: {"type":"response","command":"set_model","success":true,"data":{...model...}}
// No restart. Update toolbar display from response.data.
```

Populate model picker via `get_available_models` on session start.

---

### M4 — File Browser (Week 10)

**Deliverables:**
- Folder picker via Tauri `dialog::pick_folder()`
- Tauri `invoke('fs_watch', { path })` → Rust triggers `notify` watcher + `ignore`-aware depth-first scan
- `fs:tree` event delivers initial `FileNode[]` snapshot to renderer
- Virtualised tree with `@tanstack/react-virtual` (handles 10,000+ files without jank)
- File nodes: indent, type icon (extension → SVG map), name, last-modified badge on hover
- Expand/collapse directory nodes; state persisted per-session
- Multi-select: Cmd/Ctrl+click, Shift+click
- Right-click context menu: Open in System, Copy Path, Inject into Context
- Panel collapse to 24 px icon strip; toggle with ⌘B

---

### M5 — Filesystem Watching (Week 12)

**Deliverables:**
- `notify` watcher emits `created` / `modified` / `deleted` / `renamed` events
- Backend debounces at 200 ms before forwarding `fs:event { kind, path, isDir }` to renderer
- React file tree reconciles: add/update/remove node with fade animation
- Live state indicators:
  - Green pulse — created in last 5 s
  - Yellow dot — modified in last 5 s
  - Red strikethrough fading — deleted (removed after 3 s)
- Dynamic `.gitignore` parsing (re-read when `.gitignore` files change)
- "Show gitignored files" toggle in Settings

---

### M6 — Context Injection & Folder Attachment (Week 14)

**Deliverables:**
- Folder attachment: restart pi with `--cwd <folder>`; scan + watch begin
- Last-attached folder persisted in settings; auto-reattach on launch
- File drag-to-chat: drop files onto input area → inject as fenced code block chips above input
- File content read (UTF-8); binary files → metadata only
- Files > 500 KB: prompt user (inject full / inject summary / cancel)
- Chips show filename + size; dismissible before send
- On send: file content embedded in prompt message as fenced code block with language label

---

### M7 — Hooks & Extension Integration (Week 16)

**Extension file paths (C7 — corrected):**

> **Corrected:** Extension files are at:
> - Global: `~/.pi/agent/extensions/` (NOT `~/.pi/agent/hooks/`)
> - Project-local: `.pi/extensions/` inside the attached folder (NOT `.pi/hooks/`)

#### 7.1 Shell-Managed Extensions

The shell writes three built-in extension files to `.pi/extensions/` inside the attached folder on session start (if the user has enabled them in Settings):

**`shell-permissions.ts`** (Tool approval gate — default: off)
- Intercepts `tool_execution_start` for `bash` and `write`/`edit` calls
- Emits `extension_ui_request` with `method: "confirm"` or `method: "select"` (options: Allow / Deny / Always Allow)
- Shell renders approve/deny card in chat canvas
- Shell responds via `extension_ui_response`

**`shell-audit.ts`** (Activity log — default: on)
- Subscribes to `tool_execution_start` and `tool_execution_end`
- Emits `extension_ui_request` with `method: "notify"` carrying audit data
- Shell appends to Right Panel activity log (name, args, exit code, duration)

**`shell-git-checkpoint.ts`** (Auto git commit — default: off)
- Subscribes to `turn_end`
- Runs `git add -A && git commit -m "pi: <turn summary>"` if folder is a git repo and turn produced mutations

#### 7.2 Right Panel — Activity Log

- Shows all tool calls (from shell-audit extension events)
- Columns: timestamp, tool name, args (truncated), exit code, duration
- Filter by tool name; search by text
- Cleared on new session

#### 7.3 Settings → Hooks Tab

- List of `.ts` extension files currently loaded from `.pi/extensions/`
- Per-file: view source, toggle on/off, open in system editor
- Template library: Permission Gate, Git Checkpoint, Path Protection, Audit Log

---

### M8 — Session Persistence & Settings (Week 18)

**Deliverables:**

**Session persistence:**
- Serialise each session as JSON to `~/.pi-mono-shell/sessions/<uuid>.json` on every message
- Schema: `{ id, createdAt, updatedAt, attachedFolder, messages: [{role, content, timestamp, attachedFiles}] }`
- Session list in Left Panel footer: 20 most recent; title = first user message (truncated); relative timestamp
- Click to restore: load history + re-attach folder if it exists
- Right-click → Export as Markdown or Export as JSON
- `new_session` RPC command for in-process session reset (C8)

**Settings modal (⌘,):**
- General tab: binary path, extra CLI args, auto-reattach, gitignore toggle, file size limit, theme, font size, log level, max retries
- Providers tab: provider/model picker, API keys (keychain), OAuth login/logout buttons, Google Cloud fields, extra env vars
- Hooks tab: tool approval gate, activity log, git checkpoint toggles and configuration
- Diagnostics tab: uptime, restart count, memory usage, log viewer

---

### M9 — Polish, Shortcuts & Responsive Layout (Week 20)

**Keyboard shortcuts:**

| Shortcut | Action | Implementation |
|---|---|---|
| ⌘Enter / Ctrl+Enter | Send message | `keydown` on textarea |
| Escape | **Abort** (sends `{"type":"abort"}`) — C1 | Global keydown listener |
| ⌘B / Ctrl+B | Toggle file browser | Zustand `fs.panelCollapsed` |
| ⌘K / Ctrl+K | Toggle context inspector | Zustand `ui.rightPanelOpen` |
| ⌘N / Ctrl+N | New session (sends `new_session` RPC) | Global handler |
| ⌘, / Ctrl+, | Open settings | Global handler |
| ⌘O / Ctrl+O | Open folder picker | Global handler |
| ⌘L / Ctrl+L | Open model picker | Global handler |
| ⌘/ / Ctrl+/ | Focus chat input | Ref focus |
| F5 | Restart pi subprocess | Invoke `pi_restart` |
| ⌘S / Ctrl+S | Export current session | Invoke `session_export` |

**Responsive behaviour:**
- Width < 800 px: auto-collapse file browser
- Width < 600 px: hide right panel; compact header
- Min window size: 560 × 400 px (enforced in Tauri config)

**Panel drag handle:** double-click resets to default 280 px width.

**Auto-update:** `tauri-plugin-updater` with Ed25519 signature verification.

---

### M10 — Public Beta (Week 22)

**Deliverables:**
- Signed macOS universal binary (arm64 + x86_64 via `lipo`); notarised
- Windows installer with bundled WebView2; code-signed
- Linux `.deb` + `.AppImage` with `gtk3-webkit2` dependency
- Opt-in crash reporter (Sentry); telemetry disabled by default
- Settings → Diagnostics: process uptime, restart count, memory usage
- Performance validation:
  - Cold launch < 2 s
  - 10,000-node file tree renders < 100 ms
  - FS event → UI update < 250 ms
  - Idle memory < 150 MB

---

## RPC Protocol Quick Reference (Corrected)

### Commands (Shell → pi stdin)

```typescript
// Correct abort command (C1):
{ type: "abort" }                                    // NOT "interrupt"

// Model switch — no restart needed (C5):
{ type: "set_model", provider: "anthropic", modelId: "claude-sonnet-4-20250514" }

// OAuth: send /login as prompt, handle extension_ui_request events (C6):
{ type: "prompt", message: "/login" }

// New session in-process (C8):
{ type: "new_session" }

// Manual compact (C8):
{ type: "compact", customInstructions?: "..." }

// Cancel retry (C8):
{ type: "abort_retry" }

// Steer mid-stream (C8):
{ type: "steer", message: "Stop and do X instead" }

// Follow-up after agent finishes (C8):
{ type: "follow_up", message: "Then also do Y" }

// Poll session stats — NOT a subscribed event (C3):
{ type: "get_session_stats" }  // poll every 10 s
```

### Key Events (pi stdout → Shell)

```typescript
// Tool call phases — corrected (C4):
// Phase 1: streaming call construction (inside message_update.assistantMessageEvent)
{ type: "message_update", assistantMessageEvent: { type: "toolcall_start", ... } }
{ type: "message_update", assistantMessageEvent: { type: "toolcall_delta", ... } }
{ type: "message_update", assistantMessageEvent: { type: "toolcall_end", toolCall: {...} } }

// Phase 2: execution (separate top-level events, correlated by toolCallId)
{ type: "tool_execution_start", toolCallId: "...", toolName: "bash", args: {...} }
{ type: "tool_execution_update", toolCallId: "...", partialResult: {...} }
{ type: "tool_execution_end", toolCallId: "...", result: {...}, isError: false }

// Additional events to handle (C9):
{ type: "queue_update", steering: [...], followUp: [...] }  // show pending badge
{ type: "compaction_start", reason: "threshold" }           // show "Compacting..." indicator
{ type: "compaction_end", result: {...}, aborted: false }    // hide indicator
{ type: "auto_retry_start", attempt: 1, maxAttempts: 3, delayMs: 2000 }  // show retry pill
{ type: "auto_retry_end", success: true, attempt: 2 }       // hide retry pill

// NOT a stdout event — DO NOT handle (C2):
// session_shutdown  ← internal extension hook only
```

### Extension UI Flow (C6)

```
Shell sends:  {"type": "prompt", "message": "/login"}
pi emits:     {"type": "extension_ui_request", "id": "uuid-1", "method": "select", "title": "...", "options": [...]}
Shell shows:  select dialog
Shell sends:  {"type": "extension_ui_response", "id": "uuid-1", "value": "Allow"}

pi emits:     {"type": "extension_ui_request", "id": "uuid-2", "method": "input", "title": "Enter code", ...}
Shell shows:  text input; if URL in title → also open system browser
Shell sends:  {"type": "extension_ui_response", "id": "uuid-2", "value": "XXXX-YYYY"}
```

### Extension File Locations (C7)

```
~/.pi/agent/extensions/         ← global extensions (NOT hooks/)
  shell-audit.ts
  shell-permissions.ts
  shell-git-checkpoint.ts

<attached-folder>/.pi/extensions/    ← project-local extensions (NOT .pi/hooks/)
  custom-hook.ts
```

---

## Open Questions (Remaining)

| # | Question | Status |
|---|---|---|
| §13 Model picker RPC vs respawn | **RESOLVED (C5)** — use `set_model` command; no restart needed | ✅ |
| File size limits | 500 KB default proposed; confirm whether pi context window ceiling requires lower limit | ⏳ |
| Right Panel content | Design sprint needed to fully define Context Inspector panel content beyond activity log | ⏳ |
| Hook approval gate RPC | Confirm `extension_ui_request` / `extension_ui_response` propagation in `--mode rpc` for blocking approval dialogs | ⏳ |
| Steer/follow-up UI | How does the user trigger `steer` vs `follow_up` vs `abort`? Mid-stream input area redesign needed | ⏳ |
| Session stats polling interval | 10 s proposed; confirm acceptable UX for context-window indicator staleness | ⏳ |

---

## Acceptance Criteria (M7 / Feature Complete)

- [ ] App launches and pi subprocess running within 2 s on reference hardware
- [ ] First-run onboarding appears when no `auth.json` and no API key env vars detected
- [ ] OAuth flow: clicking Login sends `/login` as prompt; `extension_ui_request` events handled correctly; system browser opens for URL-bearing input requests
- [ ] Vertex AI: `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_LOCATION` + credentials file forwarded to pi subprocess; no other env vars leak
- [ ] Attaching a folder with 5,000 files renders the full tree with no dropped frames
- [ ] New file appears in file panel within 250 ms
- [ ] Dragging two files to chat injects them as fenced code block chips; content included in pi stdin on send
- [ ] Killing pi externally triggers automatic restart within 500 ms; UI shows "Restarting…" status pill
- [ ] Closing and reopening the app restores previous session history and re-attaches last folder
- [ ] All keyboard shortcuts in Section 9 function on macOS and Windows; Escape sends `abort` (NOT `interrupt`)
- [ ] Panel divider draggable across [180, 480] px; width persisted
- [ ] Model switch via model picker dropdown does NOT restart subprocess; uses `set_model` RPC command
- [ ] With approval gate enabled: `bash` tool call shows approve/deny card; deny returns error to LLM
- [ ] With activity log enabled: every tool call appears in Right Panel within 500 ms of completion
- [ ] With git checkpoint enabled: `git log` after a session shows one auto-commit per agent turn
- [ ] `compaction_start/end` events show/hide "Compacting…" indicator in toolbar
- [ ] `auto_retry_start` event shows retry pill with attempt number and countdown; `auto_retry_end` hides it
- [ ] `queue_update` event updates pending message badge in toolbar
- [ ] Context-window usage in toolbar refreshes via polling (every 10 s) — NOT via event subscription

---

*— End of Plan —*
