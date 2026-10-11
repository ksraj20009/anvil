# ANVIL

**ANVIL** is a web-based, provider-agnostic AI coding agent — an open alternative to
Cursor, Claude Code and Codex that runs entirely in the browser. Chat with a model,
let it read and write a real project, review every change as a diff, and run code in a
sandboxed terminal.

> Bring your own key (OpenAI, Anthropic Claude, or xAI Grok) **or** route through a
> hosted serverless proxy that keeps the key server-side.

---

## Features

- **Provider-agnostic** — OpenAI, Anthropic Claude and xAI Grok out of the box. Adding a
  provider is one entry in `src/lib/providers.ts`.
- **Auto-detected provider + live model list** — paste an API key and ANVIL recognises the
  provider from the key's shape (`sk-ant-…` → Claude, `sk-…` → OpenAI, `xai-…` → Grok),
  then calls that provider's `/models` endpoint to load the models your key can actually
  use. Pick one from the dropdown or type any id.
- **Agentic file editing** — the model gets real tools (`list_files`, `read_file`,
  `write_file`, `delete_file`, `rename_file`, `search_files`, `run_code`) and operates on
  a virtual project tree.
- **Multi-language execution** — JavaScript runs in a Web Worker sandbox and **Python runs
  via Pyodide** (CPython compiled to WebAssembly), loaded on first use. The agent can test
  code in either language.
- **Diff review** — every write the agent proposes is shown as a side-by-side Monaco
  diff you approve or reject before it lands. (Auto-apply can be enabled in Settings.)
- **Portable projects** — export the workspace to a `.json` file and import it back, or
  reset to the starter project. Everything lives in the browser, so nothing is uploaded.
- **Persistent sessions** — your conversation and its context survive a page reload.
- **Monaco workspace** — multi-file tabs, syntax highlighting for ~20 languages.
- **Sandboxed terminal** — run JavaScript or Python with output capture and a timeout;
  plus `ls`, `cat`, `run`, `python`, `rm`, `echo`, `clear`.
- **Multiple chats** — a sidebar of conversations, each with its own history, persisted
  locally.
- **Command palette** — press ⌘K / Ctrl K to run any action (new file, run, export, switch
  theme, …).
- **@-mentions** — type `@` in the prompt to attach a file's contents as context.
- **Vision input** — attach screenshots or images to a prompt (for vision-capable models).
- **Voice input** — dictate prompts with the mic button (Web Speech API).
- **GitHub sync** — connect a personal access token, pull a repo into the workspace, and
  push your changes back as a commit.
- **Light & dark themes** — toggled from Settings or the palette.
- **Streaming chat** — token-by-token responses for plain Q&A.
- **Any OpenAI-compatible endpoint** — set a custom base URL to point ANVIL at Ollama, LM
  Studio, OpenRouter, or a local proxy.
- **Two key modes** — BYOK (key stays in the browser) or a hosted proxy (key stays on
  the server). See [Key handling](#key-handling).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Open **Settings**, pick a provider (or just paste an API key — the provider is detected
from the key), choose a model from the live list, and start chatting. Turn on **Agent** in
the chat panel to let the model edit files.

```bash
npm run build      # production build → dist/
npm run preview    # serve the build locally
npm run typecheck  # tsc --noEmit
npm test           # unit tests (vitest)
```

## Deploying to Vercel

The repo is Vercel-ready (`vercel.json` uses the Vite preset; `dist/` is the output).

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. **For the hosted proxy**, add environment variables under
   *Project → Settings → Environment Variables*:

   | Variable | Provider |
   | --- | --- |
   | `OPENAI_API_KEY` | OpenAI |
   | `ANTHROPIC_API_KEY` | Anthropic Claude |
   | `XAI_API_KEY` | xAI Grok |

   You only need the ones you intend to offer. Without them, users can still use BYOK.

Pushes to `main` auto-deploy.

## Key handling

ANVIL supports both models, chosen per-user in Settings:

- **Bring your own key (BYOK).** The key is stored in the browser's `localStorage` and
  sent directly from the browser to the provider. It never touches ANVIL's servers.
  (Anthropic calls from the browser use the required
  `anthropic-dangerous-direct-browser-access` header.)
- **Hosted proxy.** The browser posts to ANVIL's own `/api/chat` Edge Function, which
  attaches a server-side key from the environment and streams the provider's response
  back. Users never see the key; the operator pays.

## Choosing a model

ANVIL does not hard-code a model list it can't keep current. When a key is present it
queries the provider's `/models` endpoint (`src/lib/llm.ts → listModels`) and shows what
is actually available, filtering out non-conversational models (embeddings, moderation,
TTS, Whisper, image models). The model field is still free text, so brand-new models work
before any code changes.

In **hosted proxy** mode the same listing is served by the Edge Function
(`GET /api/chat` with the `x-anvil-models: 1` header), using the server-side key.

## Testing

`npm test` runs the unit suite (vitest, 62 tests) covering key detection, model-list
parsing/filtering, the OpenAI/Anthropic message converters (incl. images), @-mention
parsing, session serialization, GitHub helpers, language detection, image handling,
project/chat serialization, and diff statistics. `npm run typecheck` type-checks the app.

Beyond the unit tests, the request/streaming/parsing paths are exercised end-to-end
against a **protocol-faithful mock** of the OpenAI and Anthropic HTTP APIs (JSON + SSE
streaming, tool calls, `/models`) driven through a headless browser — so the real network
code is tested, not stubbed at the function level.

## Architecture

```
src/
  lib/
    providers.ts   Provider registry (OpenAI / Anthropic / xAI)
    llm.ts         Two wire-format adapters: streaming + non-streaming tool calls
    agent.ts       The agentic loop (model → tools → model …)
    tools.ts       Tool definitions + executor over the VFS
    vfs.ts         Virtual file system (localStorage-backed)
    project.ts     Project + chat (de)serialization (export/import, persistence)
    sessions.ts    Multiple conversations + (de)serialization
    mentions.ts    @-mention parsing + context expansion
    sandbox.ts     Web Worker JavaScript runner
    python.ts      Pyodide (CPython/WASM) runner
    exec.ts        Language dispatch: JavaScript vs Python
    github.ts      GitHub client (list repos, pull tree, push commit) + pure helpers
    vision.ts      Image attachments (read, validate, base64)
    diff.ts        Change statistics for the review card
    markdown.ts    Sanitized markdown for the transcript
    storage.ts     Settings persistence
  components/      FileExplorer · EditorPanel · ChatPanel · TerminalPanel
                   SettingsModal · DiffReview · SessionList · CommandPalette · GitHubPanel
  App.tsx          Orchestration: state, agent run, approval gate, terminal
api/chat.ts        Vercel Edge Function — the hosted proxy (chat + model list)
tests/             vitest unit tests (62)
```

The agent runs a bounded loop (`maxSteps`, default 8): ask the model for the next step;
if it returns tool calls, execute them against the VFS and feed the results back;
otherwise stop. `write_file` passes through an **approval gate** — the loop awaits your
Apply/Reject decision (or resolves immediately when auto-apply is on).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper walkthrough.

## Security notes

- The sandbox is a Web Worker — no DOM, no host access, and it is killed on timeout. It
  is **not** a hardened security boundary; don't run untrusted code you wouldn't run
  yourself.
- BYOK keys live in `localStorage` and are sent to the provider you selected. On a
  shared machine, clear them (Settings) when you're done.
- The proxy never logs or stores request bodies.

## Roadmap

- WebContainers for a full Node/npm runtime in the browser
- MCP tool support and custom tool definitions
- Streaming tool calls and inline (non-modal) diffs
- Zip import/export and a diff-aware GitHub push (only changed files)

## Tech

Vite · React · TypeScript · Monaco Editor · marked + DOMPurify. Zero backend required for
BYOK; one Edge Function for the proxy.

## License

MIT — see [`LICENSE`](LICENSE).
