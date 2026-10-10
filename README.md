# ANVIL

**ANVIL** is a web-based, provider-agnostic AI coding agent — an open alternative to
Cursor, Claude Code and Codex that runs entirely in the browser. Chat with a model,
let it read and write a real project, review every change as a diff, and run code in a
sandboxed terminal.

> Bring your own key (OpenAI, Anthropic Claude, or xAI Grok) **or** route through a
> hosted serverless proxy that keeps the key server-side.

---

## Features

- **Provider-agnostic** — OpenAI, Anthropic Claude and xAI Grok out of the box, with a
  free-text model field so new models work without a code change. Adding a provider is
  one entry in `src/lib/providers.ts`.
- **Agentic file editing** — the model gets real tools (`list_files`, `read_file`,
  `write_file`, `delete_file`, `run_code`) and operates on a virtual project tree.
- **Diff review** — every write the agent proposes is shown as a side-by-side Monaco
  diff you approve or reject before it lands. (Auto-apply can be enabled in Settings.)
- **Monaco workspace** — multi-file tabs, syntax highlighting for ~20 languages.
- **Sandboxed terminal** — run JavaScript in a Web Worker with `console` capture and a
  timeout; plus `ls`, `cat`, `run`, `rm`, `echo`, `clear`.
- **Streaming chat** — token-by-token responses for plain Q&A.
- **Two key modes** — BYOK (key stays in the browser) or a hosted proxy (key stays on
  the server). See [Key handling](#key-handling).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Open **Settings**, pick a provider, paste an API key, and start chatting. Turn on
**Agent** in the chat panel to let the model edit files.

```bash
npm run build      # production build → dist/
npm run preview    # serve the build locally
npm run typecheck  # tsc --noEmit
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

## Architecture

```
src/
  lib/
    providers.ts   Provider registry (OpenAI / Anthropic / xAI)
    llm.ts         Two wire-format adapters: streaming + non-streaming tool calls
    agent.ts       The agentic loop (model → tools → model …)
    tools.ts       Tool definitions + executor over the VFS
    vfs.ts         Virtual file system (localStorage-backed)
    sandbox.ts     Web Worker code runner
    diff.ts        Change statistics for the review card
    markdown.ts    Sanitized markdown for the transcript
    storage.ts     Settings persistence
  components/      FileExplorer · EditorPanel · ChatPanel · TerminalPanel
                   SettingsModal · DiffReview
  App.tsx          Orchestration: state, agent run, approval gate, terminal
api/chat.ts        Vercel Edge Function — the hosted proxy
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

- WebContainer / Pyodide runtime for multi-language execution
- Persistent projects (import/export a zip, sync to a repo)
- MCP tool support and custom tool definitions
- Streaming tool calls
- File diffs applied inline in the editor

## Tech

Vite · React · TypeScript · Monaco Editor · marked + DOMPurify. Zero backend required for
BYOK; one Edge Function for the proxy.

## License

MIT — see [`LICENSE`](LICENSE).
