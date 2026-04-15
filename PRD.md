# pi-mono Desktop Shell — Product Requirements Document

| | |
|---|---|
| **Status** | Draft v1.0 |
| **Date** | April 2026 |
| **Audience** | Engineering, Design, Product |
| **Framework** | Tauri (primary) / Electron (fallback) |
| **Upstream CLI** | github.com/badlogic/pi-mono |

---

## 1. Overview

pi-mono Desktop Shell is a cross-platform native application that wraps the pi-mono CLI as a managed subprocess and delivers a polished, claude.ai-inspired chat experience alongside a live file browser. Users open a local folder, attach it to an active pi-mono session as persistent context, and interact with the AI through a conversational UI — all without leaving the desktop.

> **Design Reference:** The UI mirrors claude.ai's two-panel layout: a collapsible left sidebar replaced by a live file browser panel, and a right-hand chat canvas. All interactions are keyboard-navigable and the panel divider is freely resizable.

---

## 2. Problem Statement

pi-mono is a powerful AI coding and reasoning CLI, but consuming it today requires terminal fluency — users must manage subprocess lifecycles, manually pass file context, and interpret raw streamed output. There is no native path to:

- Attach a live workspace folder to a session and keep it in sync with the AI's context
- Drag individual files or selections into an ongoing conversation
- Retain session history across restarts without shell scripting
- Onboard non-engineers or mixed technical / domain teams

The Desktop Shell eliminates all of these friction points while preserving the full power of pi-mono's underlying capabilities.

---

## 3. Goals & Non-Goals

### 3.1 Goals

- Provide a production-quality chat UI (message history, streaming tokens, code blocks, markdown rendering)
- Fully manage pi-mono subprocess lifecycle — start, stop, restart, health monitoring
- Deliver a real-time file browser panel backed by native filesystem watching
- Support folder attachment: user-selected folder is injected into pi-mono context and kept current
- Enable file-to-chat context injection via click selection and drag-and-drop
- Offer a responsive panel layout: collapsible sidebar, resizable divider, keyboard shortcuts
- Target macOS, Windows, and Linux from a single codebase

### 3.2 Non-Goals

- This PRD does not define or change pi-mono CLI behaviour — the shell is a consumer, not a fork
- Cloud sync, remote session sharing, or team collaboration features
- Built-in code editor (VS Code extension is a separate initiative)
- Mobile or web versions
- Plugin / extension marketplace

---

## 4. Target Users

| Persona | Context | Key Need |
|---|---|---|
| Developer / Architect | Daily coding with local repo, running pi-mono for code reviews and design docs | Drag files to chat, see code diffs inline |
| Domain Expert (non-engineer) | Uses AI to analyse configuration files, spreadsheets, or XML exports without shell knowledge | Zero-CLI entry point, folder attachment in one click |
| Team Lead / Manager | Reviews AI session transcripts, exports results to Confluence / Jira | Session history, export, persistent context |
| AI Research / QA | Runs repeated pi-mono experiments against a dataset folder | Scriptable session attach, quick file reloads |

---

## 5. Architecture

### 5.1 Framework Decision: Tauri vs Electron

Tauri is the recommended framework. It uses the OS's native WebView (WebKit on macOS/Linux, WebView2 on Windows), keeping the binary under 10 MB and RAM usage ~50–80 MB at idle. The Rust backend handles subprocess management and filesystem watching with full OS access. Electron remains the fallback path if a bundled WebView is required for corporate environments where WebView2 deployment is restricted.

| Dimension | Tauri (recommended) | Electron (fallback) |
|---|---|---|
| Bundle size | ~8 MB | ~150 MB |
| RAM at idle | ~60 MB | ~200 MB |
| Backend language | Rust | Node.js |
| Subprocess API | `std::process::Command` | `child_process` |
| FS watch library | `notify` (Rust) | `chokidar` (Node.js) |
| Auto-update | `tauri-plugin-updater` | `electron-updater` |

### 5.2 Component Topology

The application has four primary layers:

- **UI Layer** (React + TypeScript)
  - Chat canvas, file browser panel, toolbar, settings modal
  - State managed via Zustand; layout persistence via localStorage

- **Bridge Layer**
  - Tauri: `invoke()` commands and `listen()` events via `@tauri-apps/api`
  - Electron: `contextBridge`-exposed `ipcRenderer` / `ipcMain` channels

- **Subprocess Manager** (Rust / Node.js backend)
  - Spawns pi CLI process via `--mode rpc --no-session --cwd <folder>`
  - Parses stdout line-by-line as JSONL; dispatches events to the renderer
  - Health-check loop restarts the process on unexpected exit

- **Filesystem Watcher**
  - Recursive watch on the user-selected folder (`notify` / `chokidar`)
  - Debounced events (200 ms) mapped to file-tree state updates in the UI

### 5.3 IPC Transport: pi RPC Mode

Rather than inventing a custom stdin/stdout protocol, the shell uses pi's native RPC mode, which is purpose-built for exactly this integration pattern. The subprocess is launched as:

```
pi --mode rpc --no-session --cwd <attached-folder>
```

Communication is strictly JSONL over stdin/stdout: one JSON object per line, delimited by LF (`\n`) only. The shell must use a custom line reader — Node's built-in `readline` is non-compliant because it also splits on Unicode line separators U+2028 and U+2029, which are valid inside JSON strings.

> **Why RPC mode changes everything:** pi's default tools — `read`, `write`, `edit`, and `bash` — execute automatically on the pi side. When the user asks "create a config file" or "run the tests", pi writes the file and runs the bash command without any extra wiring in the shell. The desktop app gets tool-call events to display progress, but does not need to implement or gate any tool execution itself.

#### Commands (Shell → pi stdin)

| Command type | Key fields | Purpose |
|---|---|---|
| `prompt` | `message: string` | Send a user message to the agent |
| `interrupt` | (none) | Cancel the current in-progress response |
| `get_session_stats` | (none) | Query context-window usage |

#### Events (pi stdout → Shell)

| Event type | Key fields | Shell action |
|---|---|---|
| `message_update` / `text_delta` | `delta: string` | Append token to the streaming message bubble |
| `message_update` / `tool_use` | `name, input` | Show tool-call chip (e.g. `bash`, `write`, `edit`) |
| `message_update` / `tool_result` | `content, isError` | Show tool output / error inline in chat |
| `agent_end` | `finishReason` | Mark response complete; hide streaming cursor |
| `session_stats` | `contextUsage` | Update context-window usage indicator in toolbar |
| `session_shutdown` | (none) | pi is exiting cleanly; trigger restart policy if unexpected |

#### Filesystem & Context — Shell-side IPC (Tauri invoke / Electron IPC)

The following commands are typed IPC between the React renderer and the Tauri/Electron backend. They are unrelated to pi itself and handle the file browser and folder attachment lifecycle.

| Command / Event | Direction | Purpose |
|---|---|---|
| `fs:watch { path }` | Renderer → Backend | Begin recursive filesystem watch on folder |
| `fs:unwatch` | Renderer → Backend | Stop the current watcher |
| `fs:tree  FileNode[]` | Backend → Renderer | Initial directory snapshot after attach |
| `fs:event { kind, path, isDir }` | Backend → Renderer | Live file-change notification (debounced 200 ms) |
| `pi:status { state }` | Backend → Renderer | Process state: `idle \| starting \| running \| error` |
| `pi:restart` | Renderer → Backend | Manual restart trigger (F5 shortcut) |

#### Tool-Call Display

When the shell receives a `tool_use` event it renders a collapsible chip in the chat stream showing the tool name and sanitised input. When the matching `tool_result` arrives it appends the output (or error) inside the same chip.

- **`bash`** — shows command + exit code + stdout/stderr (truncated to 20 lines, expandable)
- **`write` / `edit`** — shows filename + a diff-style preview of changes
- **`read`** — shows filename; content is not re-displayed (already in context)

---

## 6. UI & Layout Specification

### 6.1 Three-Column Shell

The application window is divided into three horizontal zones:

- **Left Panel** — File Browser (default: 280 px, min 180 px, max 480 px, collapsible)
- **Center Panel** — Chat Canvas (flex-grow, min 400 px)
- **Right Panel** — Context Inspector (default hidden, toggled via ⌘K / Ctrl+K, 320 px)

Panel widths are persisted in `localStorage` and restored on next launch. A drag handle between Left and Center panels emits a resize cursor and supports pointer-capture dragging. Double-clicking the drag handle resets the Left Panel to its default width.

### 6.2 Left Panel — File Browser

- Header shows the attached folder name (truncated with ellipsis) and a folder-picker icon button
- Tree renders with virtualised rows (`react-virtual`) to handle repos with 10,000+ files without jank
- File nodes display: indent per depth, type icon (file extension map → SVG icon), name, last-modified badge on hover
- Live state indicators alongside each node:
  - 🟢 Green dot pulse — file created in the last 5 s
  - 🟡 Yellow dot — file modified in the last 5 s
  - ~~Red strikethrough~~ — file deleted (fades out after 3 s)
- Multi-select: Cmd/Ctrl+click, Shift+click (standard OS conventions)
- Drag: selected files can be dragged to the chat input area — triggers inline context injection
- Right-click context menu: Open in System, Copy Path, Inject into Context
- Collapse/expand button in the panel header; collapsed state shows a 24 px icon-only strip

### 6.3 Center Panel — Chat Canvas

- Top bar: app logo, model/session indicator, status pill (Idle / Thinking / Error), settings gear icon
- Message list: scrollable, anchored to bottom when new tokens arrive (auto-scroll unless user has scrolled up)
- Message bubbles: user messages right-aligned (accent-tinted background); assistant messages left-aligned (neutral)
- Streaming: tokens appended in real time; blinking cursor at insertion point during generation
- Markdown rendering: headings, bold/italic, inline code, fenced code blocks (language label + copy button), tables, blockquotes
- Attached-file chips: injected files appear as dismissible chips above the input field, showing filename + size
- Input area: multi-line textarea (auto-grows up to 200 px), Send button, Attach button, voice-input placeholder (future)
- Session history: bottom of left panel lists past sessions (persisted to `~/.pi-mono-shell/sessions/`) — click restores conversation

### 6.4 Responsive Behaviour

- Window width < 800 px: File Browser collapses automatically; toggled by ⌘B / Ctrl+B
- Window width < 600 px: Right Panel hidden, header collapses to icon bar only
- Minimum window size enforced: 560 × 400 px

---

## 7. Core Feature Specifications

### 7.1 pi-mono Subprocess Management

The Subprocess Manager is responsible for the full lifecycle of the pi process. It must:

- Resolve the pi binary path: (1) user-configured override in settings, (2) bundled binary (default), (3) PATH lookup as last resort
- Spawn the process with `--mode rpc --no-session` and the attached folder as `--cwd`; pipe stdin/stdout as JSONL
- Parse stdout line-by-line as JSONL; dispatch `message_update`, `agent_end`, `session_stats`, and `session_shutdown` events to the renderer
- Implement a restart policy: exponential back-off (500 ms, 1 s, 2 s, 4 s, max 30 s), max 5 retries before surfacing an error to the user
- Expose process status to the UI (Idle, Starting, Running, Stopping, Error) via the `pi:status` event
- Gracefully terminate on app quit: SIGTERM then SIGKILL after 3 s timeout
- Log all raw subprocess output to a rotating log file at `~/.pi-mono-shell/logs/`

### 7.2 Folder Attachment & Context Injection

When the user attaches a folder (via the folder picker or drag-and-drop onto the file panel), the shell:

- Restarts pi with `--cwd <folder>` so all tool calls (read, write, edit, bash) are scoped to that directory
- Backend immediately scans the folder (depth-first, respecting `.gitignore` via `ignore` crate / glob) and emits `fs:tree` with the initial snapshot
- Starts the filesystem watcher on that path (recursive)
- Persists the last-attached folder path in app settings for auto-reattach on next launch

Individual file injection (via selection or drag-to-chat):

- Reads file content (UTF-8; binary files send only metadata)
- Content is embedded in the chat message as a fenced code block labelled with the filename and language
- Files > 500 KB prompt the user: inject full content, inject summary only, or cancel

### 7.3 Real-Time File Panel

- The filesystem watcher emits events of type: `created`, `modified`, `deleted`, `renamed`
- Events are debounced at 200 ms on the backend before forwarding to the UI
- The React file tree reconciles incoming events against its current state (add / update / remove node with fade animation)
- Modified files trigger a subtle pulse animation on their node for 2 s
- The panel header shows a live count badge of changed files since last session interaction
- Gitignore-aware: `.gitignore` files in the watched tree are parsed dynamically; ignored paths are hidden (toggleable in settings)

### 7.4 Session Persistence

- Every chat session is serialised as JSON to `~/.pi-mono-shell/sessions/<uuid>.json` on every message
- Schema: `{ id, createdAt, updatedAt, attachedFolder, messages: [ { role, content, timestamp, attachedFiles } ] }`
- The Left Panel's session list renders the 20 most recent sessions with title (first user message, truncated) and relative timestamp
- Clicking a session restores the chat history and re-attaches the folder if it still exists
- Session export: right-click a session → Export as Markdown or Export as JSON

### 7.5 Provider & Model Configuration

**Key principle: the shell never touches API keys directly.** All provider authentication and model selection is owned by pi. The shell's responsibilities are: (1) detect when pi has no valid credentials and surface a setup flow, (2) forward environment variables to the pi subprocess on spawn, (3) handle OAuth callback events that pi emits over RPC, and (4) expose a model/provider picker in the toolbar.

#### 7.5.1 How pi handles auth

pi supports two authentication paths:

| Path | Mechanism | Credential storage |
|---|---|---|
| **Subscription / OAuth** | Browser redirect or device-code flow via `/login` | `~/.pi/agent/auth.json` (auto-refreshed) |
| **API key** | Environment variable or entry in `~/.pi/agent/auth.json` | Env var or auth file |

Subscription providers (no API key needed): Anthropic Claude Pro/Max, OpenAI ChatGPT Plus/Pro, GitHub Copilot, Google Gemini CLI, Google Antigravity.

API key providers: Anthropic, OpenAI, Azure OpenAI, Google Gemini, Google Vertex AI, Amazon Bedrock, Mistral, Groq, Cerebras, xAI, OpenRouter, and more.

For **Vertex AI** (the enterprise / Trimble path): set `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_LOCATION` + `GOOGLE_APPLICATION_CREDENTIALS` env vars, or use `gcloud auth application-default login`. The shell forwards these from Settings to the pi subprocess on every spawn — no OAuth dance required.

#### 7.5.2 First-run onboarding

On first launch (no `~/.pi/agent/auth.json` and no recognised API key env vars detected), the shell shows a **Provider Setup screen** before opening the main window:

1. A list of supported providers with logos, grouped as "Subscription (free / existing plan)" and "API Key"
2. User selects a provider → shell guides them through the appropriate flow (see §7.5.3)
3. Once at least one provider is configured, the main window opens and pi is spawned
4. A "Skip for now" option is available; pi will surface an error on first message if still unconfigured

#### 7.5.3 OAuth flow handling in RPC mode

When pi needs to authenticate via OAuth in `--mode rpc`, it emits `extension_ui_request` events on stdout. The shell must handle three callback types:

| RPC event payload | Shell action |
|---|---|
| `onAuth { url }` | Open the URL in the system browser via `shell::open()` (Tauri) or `shell.openExternal()` (Electron) |
| `onDeviceCode { userCode, verificationUri }` | Show a modal with the device code and a "Copy code & open browser" button |
| `onPrompt { message }` | Show an inline text input in the chat canvas; send the entered value back as `extension_ui_response` on stdin |

After the flow completes, pi writes credentials to `~/.pi/agent/auth.json` and resumes normally. The shell does not read, write, or parse `auth.json` itself.

#### 7.5.4 Model & provider picker

The toolbar's model/session indicator (§6.3) is a clickable dropdown. Changing the provider/model respawns pi with updated `--provider <name> --model <id>` flags. The current model is tracked by listening to `session_stats` events from pi, which include the active model id.

#### 7.5.5 Settings → Providers tab

| Control | Description |
|---|---|
| Active provider / model | Dropdown; value passed as `--provider` + `--model` flags on spawn |
| API key (per provider) | Masked text input; stored in OS keychain (Tauri `stronghold`) and forwarded as the appropriate env var to pi |
| OAuth login / logout | Button that triggers the RPC `/login` or `/logout` flow |
| Google Cloud Project | `GOOGLE_CLOUD_PROJECT` forwarded as env var |
| Google Cloud Location | `GOOGLE_CLOUD_LOCATION` forwarded as env var |
| Google credentials file | File picker for service account JSON; sets `GOOGLE_APPLICATION_CREDENTIALS` |
| Additional env vars | Freeform key-value pairs forwarded to pi subprocess on every spawn |

> **Security:** API keys are stored in the OS keychain (macOS Keychain / Windows Credential Manager / libsecret via Tauri `stronghold`), never in plaintext on disk, never logged, and never included in session exports.

#### 7.5.6 Env var forwarding policy

When spawning pi, the backend constructs the subprocess environment from an explicit allow-list:

1. Minimal clean environment (not the full parent shell env) to prevent accidental credential leakage
2. Provider env vars configured in Settings → Providers
3. `PATH` — so pi can find `git`, `node`, and other tools
4. `HOME` — so pi can locate `~/.pi/`

Secrets present in the user's login shell (e.g. `AWS_SECRET_ACCESS_KEY` in `.zshrc`) are **not** forwarded unless the user has explicitly entered them in the Settings UI.

### 7.6 Hooks & Extension Integration

pi has a first-class hooks system that the desktop shell can leverage without writing any pi internals. There are two layers:

**Extension hooks (`pi.on()`)** — registered inside TypeScript extension files placed at `~/.pi/agent/hooks/*.ts` (global) or `.pi/hooks/*.ts` (project-local inside the attached folder). pi loads them automatically on startup.

**The full event catalogue available to hooks:**

| Category | Events | Can cancel / modify? |
|---|---|---|
| Session | `session_start`, `session_before_switch`, `session_switch`, `session_shutdown` | `before_*` variants can return `{ cancel: true }` |
| Agent loop | `before_agent_start` | Yes — can inject extra messages + rewrite system prompt |
| Agent loop | `agent_start`, `agent_end` | No |
| Turns | `turn_start`, `turn_end` | No |
| Messages | `message_start`, `message_update`, `message_end` | No |
| Tool execution | `tool_execution_start`, `tool_execution_update`, `tool_execution_end` | `tool_execution_start` can block / modify args |
| Input | `input` | Yes — can transform text, fully handle (skip LLM), or continue |
| Context | `context` | Yes — can rewrite the entire message array before each LLM call |

#### 7.6.1 Shell-managed hooks

The desktop shell ships three built-in hook files that it writes to `.pi/hooks/` inside the attached folder on session start (only if the user has the relevant feature enabled in Settings):

**`shell-permissions.ts` — Tool approval gate (default: off)**

Intercepts `tool_execution_start` for `bash` and `write`/`edit` tool calls. Emits a `hook:approval_request` RPC event to the shell, which renders an **Approve / Deny / Always Allow** dialog in the chat canvas. The hook blocks until the shell responds via `extension_ui_response`. Approved actions proceed; denied actions return an error result to the LLM.

```
pi stdout → hook:approval_request { toolName, args, sessionId }
shell UI → user sees "pi wants to run: rm -rf dist/" [Approve] [Deny] [Always Allow]
shell → extension_ui_response { id, value: "approve" | "deny" }
```

**`shell-audit.ts` — Activity log (default: on)**

Subscribes to `tool_execution_start` and `tool_execution_end`. Emits a `hook:audit_event` RPC event for each tool call with the tool name, args, exit code, and duration. The shell appends these to an in-memory activity log shown in the Right Panel (Context Inspector, §6.1).

**`shell-git-checkpoint.ts` — Auto git commit (default: off)**

Subscribes to `turn_end`. If the attached folder is a git repo and the turn produced any file mutations, runs `git add -A && git commit -m "pi: <turn summary>"` via the `bash` tool. Gives the user a complete undo trail across the entire session.

#### 7.6.2 Project hooks (user-defined)

The shell surfaces a **Hooks** tab in Settings showing all `.ts` files currently loaded from the attached folder's `.pi/hooks/` directory. Users can:

- View the source of each loaded hook file
- Toggle hooks on/off without deleting them (shell writes a `disabled: true` comment header that pi respects)
- Open the hook file in the system editor
- Add new hook files from a template library (permission gate, git checkpoint, path protection, audit log)

#### 7.6.3 Hook RPC events

Hook-generated events that need shell UI interaction follow the same `extension_ui_request` / `extension_ui_response` pattern as OAuth callbacks (§7.5.3). The shell must handle these additional request types:

| Request type | Shell action |
|---|---|
| `hook:approval_request` | Show inline approve/deny card in chat stream |
| `hook:audit_event` | Append entry to Right Panel activity log |
| `hook:notify` | Show transient toast notification in toolbar area |

---

## 8. Settings

### 8.1 General

| Setting | Default | Description |
|---|---|---|
| pi-mono binary path | (bundled binary) | Absolute path to the pi executable; overrides the bundled default |
| Extra CLI arguments | (empty) | Appended to every pi invocation |
| Auto-reattach folder | `true` | Reattach last folder on app start |
| Show gitignored files | `false` | Display `.gitignore`-excluded paths in tree |
| File inject size limit | 500 KB | Prompt threshold for large file injection |
| Theme | System | Light / Dark / System |
| Font size | 14 px | Chat canvas base font size |
| Session auto-save | `true` | Write session JSON on every message |
| Log level | Info | Backend log verbosity (Debug / Info / Warn) |
| Max restart retries | 5 | Process restart attempts before error state |

### 8.2 Providers

| Setting | Description |
|---|---|
| Active provider | Selected provider name; passed as `--provider` flag on spawn |
| Active model | Selected model id; passed as `--model` flag on spawn |
| API keys (per provider) | Masked text fields; stored in OS keychain, forwarded as env vars to pi |
| OAuth state (per provider) | Login / logout buttons; triggers RPC `/login` and `/logout` flows |
| Google Cloud Project | `GOOGLE_CLOUD_PROJECT` forwarded as env var to pi subprocess |
| Google Cloud Location | `GOOGLE_CLOUD_LOCATION` forwarded as env var |
| Google credentials file | Path to service account JSON; sets `GOOGLE_APPLICATION_CREDENTIALS` |
| Additional env vars | Freeform key-value pairs forwarded to pi subprocess on spawn |

### 8.3 Hooks

| Setting | Default | Description |
|---|---|---|
| Tool approval gate | `off` | Require user approval before `bash` and file-write tool calls |
| Approval scope | All tools | Which tools require approval: all / bash only / write+edit only |
| Activity log | `on` | Log all tool calls to the Right Panel activity log |
| Git checkpoint | `off` | Auto-commit file mutations after each agent turn |
| Git checkpoint message prefix | `pi:` | Prefix for auto-generated commit messages |

---

## 9. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| ⌘Enter / Ctrl+Enter | Send message |
| ⌘B / Ctrl+B | Toggle file browser panel |
| ⌘K / Ctrl+K | Toggle context inspector panel |
| ⌘N / Ctrl+N | New session |
| ⌘, / Ctrl+, | Open settings |
| ⌘O / Ctrl+O | Open folder picker |
| ⌘L / Ctrl+L | Open model / provider picker |
| Escape | Cancel streaming response |
| ⌘/ / Ctrl+/ | Focus chat input |
| F5 | Restart pi subprocess |
| ⌘S / Ctrl+S | Export current session |

---

## 10. Technical Requirements

### 10.1 Performance

- Cold launch to interactive: < 2 s on modern hardware (M-series Mac, Intel Core i5, Ryzen 5)
- File tree render for 10,000 nodes: < 100 ms (virtualised list)
- Filesystem event to UI update latency: < 250 ms end-to-end
- Chat token streaming: no perceptible jank; React render batching via `startTransition`
- Memory ceiling at idle with 10,000-file repo attached: < 150 MB

### 10.2 Platform Support

- macOS 13+ (Ventura), arm64 + x86_64 (universal binary via `lipo`)
- Windows 10 1803+ (WebView2 runtime required; bundled installer option)
- Ubuntu 22.04+ / Fedora 38+ (`gtk3-webkit2` dependency)

### 10.3 Security

- The subprocess is sandboxed: it inherits only the working directory and an explicit allow-list of env vars configured in Settings → Providers
- No remote code execution surface: the app has no HTTP server and no WebSocket listener
- Tauri allowlist (or Electron preload isolation): renderer has no direct Node/Rust API access — all system calls go through typed IPC
- API keys stored in OS keychain (Tauri `stronghold`), never in plaintext on disk or in logs
- File reads are limited to the user-selected folder scope; the backend rejects traverse-outside requests
- Auto-update signatures: updates verified against a controlled public key (Ed25519)

### 10.4 Logging & Observability

- Structured JSON logs (backend) + `console.log` passthrough (renderer), both piped to rotating files
- Crash reporter: opt-in telemetry using Sentry or similar, disabled by default
- Process uptime, restart count, and memory usage exposed in the Settings → Diagnostics panel

---

## 11. Dependency Map

### 11.1 Frontend

| Package | Version | Purpose |
|---|---|---|
| `react` + `react-dom` | ^19 | UI framework |
| `@tauri-apps/api` | ^2 | IPC bridge (Tauri path) |
| `zustand` | ^5 | Global state management |
| `@tanstack/react-virtual` | ^3 | Virtualised file tree |
| `react-markdown` + `remark-gfm` | latest | Markdown + GFM rendering |
| `shiki` | ^1 | Code block syntax highlighting |
| `react-resizable-panels` | ^2 | Drag-resize panel layout |
| `@radix-ui/react-*` | latest | Accessible UI primitives |
| `tailwindcss` | ^4 | Utility-first styling |
| `lucide-react` | ^0.4 | Icon set |

### 11.2 Backend (Rust — Tauri path)

| Crate | Version | Purpose |
|---|---|---|
| `tauri` | ^2 | Application framework |
| `notify` | ^6 | Cross-platform filesystem watching |
| `ignore` | ^0.4 | `.gitignore`-aware directory walk |
| `tokio` | ^1 | Async runtime for subprocess I/O |
| `serde` + `serde_json` | ^1 | IPC payload serialisation |
| `tracing` + `tracing-subscriber` | ^0.3 | Structured logging |

---

## 12. Milestones & Phases

| Phase | Target | Deliverables |
|---|---|---|
| M0 | Week 2 | Repo scaffold: Tauri + React + TypeScript + Tailwind, CI pipeline, code style lint |
| M1 | Week 4 | Subprocess manager: spawn with `--mode rpc`, health-check, restart policy, JSONL event parsing, env var forwarding |
| M2 | Week 6 | Chat UI: message list, streaming tokens, markdown render, code blocks, tool-call chips |
| M3 | Week 8 | Provider onboarding: first-run setup screen, API key entry (keychain), OAuth RPC callback handling, model picker |
| M4 | Week 10 | File browser: folder picker, tree render, virtualisation, expand/collapse, icons |
| M5 | Week 12 | Filesystem watching: live node updates, pulse animations, debounce, gitignore filter |
| M6 | Week 14 | Context injection: folder attachment via `--cwd`, file drag-to-chat, chips, size-limit prompt |
| M7 | Week 16 | Hooks: shell-managed `audit`, `approval-gate`, `git-checkpoint` hooks; Right Panel activity log; Settings → Hooks tab |
| M8 | Week 18 | Session persistence, history panel, export Markdown/JSON, settings modal |
| M9 | Week 20 | Polish: keyboard shortcuts, responsive layout, onboarding, auto-update, notarisation |
| M10 | Week 22 | Public beta: signed installers for macOS/Windows/Linux, telemetry opt-in, crash reporter |

---

## 13. Open Questions

- **stdin protocol** — ✅ RESOLVED. `--mode rpc` uses strict LF-delimited JSONL. Send `{ "type": "prompt", "message": "..." }` to submit a turn; receive `message_update` / `agent_end` events on stdout. A custom line reader is required — Node `readline` is non-compliant (splits on U+2028/U+2029).

- **Context flag** — ✅ RESOLVED. Pass `--cwd <folder>` at process launch. pi treats that directory as the working directory for all tool calls (`read`, `write`, `edit`, `bash`). No synthetic context-priming message is needed.

- **Token streaming** — ✅ RESOLVED. pi emits `text_delta` events inside `message_update` JSONL lines as tokens arrive. Each delta is a string fragment; the shell appends them to the current message bubble in real time.

- **Binary distribution** — ✅ DECIDED. The installer bundles a pinned version of pi as the default. Users who need a different version can override via Settings → pi binary path. The bundled binary is updated on each app release.

- **Provider auth** — ✅ RESOLVED. The shell owns the first-run onboarding UI and env var forwarding. pi owns all actual auth logic, credential storage (`~/.pi/agent/auth.json`), and OAuth flows. The shell handles the three RPC OAuth callback event types (`onAuth`, `onDeviceCode`, `onPrompt`) by opening the system browser or showing a modal. API keys entered in Settings are stored in the OS keychain via Tauri `stronghold` and forwarded as env vars on subprocess spawn.

- **File size limits** — ⏳ OPEN. 500 KB is the proposed default. Confirm whether pi imposes a context-window ceiling that should drive a lower limit.

- **Right Panel (Context Inspector)** — ⏳ OPEN. Content not fully defined in this revision — a follow-up design sprint is needed.

- **Model picker RPC vs respawn** — ⏳ OPEN. Changing models mid-session: does pi support switching model via an RPC command, or must the subprocess be restarted with new `--model` flags? Needs verification against `docs/rpc.md`.

- **Hook approval gate RPC** — ⏳ OPEN. Confirm that `extension_ui_request` / `extension_ui_response` events are fully propagated in `--mode rpc` for blocking hook interactions (approval dialogs). The docs indicate support but needs an integration test.

---

## 14. Acceptance Criteria (M7 / Feature Complete)

- [ ] App launches and pi subprocess is running within 2 s on reference hardware
- [ ] First-run onboarding screen appears when no `auth.json` and no API key env vars are detected; user can configure Anthropic API key and reach the main window without touching a terminal
- [ ] OAuth flow (Anthropic subscription): clicking Login opens the system browser; completing the flow in the browser resumes the session without any manual token pasting
- [ ] Vertex AI path: entering `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and a credentials file in Settings → Providers results in pi successfully making calls on next spawn; no other env vars leak into the subprocess
- [ ] Attaching a folder with 5,000 files renders the full tree with no dropped frames
- [ ] Creating a new file in the attached folder appears in the file panel within 250 ms
- [ ] Dragging two files to the chat input injects them as fenced code block chips; sending the message includes their content in the pi stdin
- [ ] Killing pi externally triggers an automatic restart within 500 ms; the UI shows a transient "Restarting…" status pill
- [ ] Closing and reopening the app restores the previous session history and re-attaches the last folder
- [ ] All keyboard shortcuts listed in Section 9 function correctly on macOS and Windows
- [ ] The panel divider can be dragged from its default position to any value in [180, 480] px and the new width is persisted
- [ ] With the tool approval gate enabled, a `bash` tool call from pi shows an approve/deny card in the chat canvas; denying returns an error to the LLM and the agent responds accordingly
- [ ] With the activity log enabled, every tool call (name, args, exit code) appears in the Right Panel within 500 ms of completion
- [ ] With git checkpoint enabled, a `git log` after a session that wrote files shows one auto-commit per agent turn containing the mutated files

---

*— End of Document —*
