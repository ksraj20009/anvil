# ANVIL — Architecture

## Overview

ANVIL is a single-page React app with an optional serverless proxy. Everything a coding
agent needs — a project, an editor, a runner, a chat — lives in the browser.

```
┌─────────────────────────── Browser (React SPA) ───────────────────────────┐
│  ChatPanel ──► agent loop ──► llm.ts ──► fetch ─┐                          │
│  EditorPanel (Monaco) ◄── VFS (localStorage) ◄── tools.ts ◄─┘              │
│  TerminalPanel ──► sandbox.ts (Web Worker)                                 │
│  DiffReview (Monaco DiffEditor) ◄── approval gate                          │
└───────────────────────────────────────────────────────────────────────────┘
                                   │
              BYOK ────────────────┤──────────────── /api/chat (Edge Function)
              (key in browser)     │                 (key in env)
                                   ▼
                    OpenAI · Anthropic · xAI Grok
```

## The two wire formats

Providers speak one of two protocols. `src/lib/llm.ts` converts a single internal
`ChatMessage[]` into either shape and parses either response:

| | OpenAI family (`kind: "openai"`) | Anthropic (`kind: "anthropic"`) |
| --- | --- | --- |
| Endpoint | `/chat/completions` | `/messages` |
| System prompt | a `system` message | top-level `system` field |
| Tool call (assistant) | `tool_calls[]` | `tool_use` content block |
| Tool result | `role: "tool"` message | `tool_result` block in a user message |
| Stream chunk | `choices[0].delta.content` | `content_block_delta.text_delta` |
| Browser auth | `Authorization: Bearer` | `x-api-key` + `anthropic-dangerous-direct-browser-access` |

xAI Grok is OpenAI-compatible, so it reuses the `openai` adapter with a different
`baseUrl`. Anthropic requires consecutive tool results to be merged into one user
message — `toAnthropicMessages` does this.

## The agent loop

`src/lib/agent.ts`:

1. Send the conversation plus the tool schema to the model (non-streaming, so tool calls
   come back complete).
2. Append the assistant turn. If it carried tool calls, run each against the VFS.
3. Feed each result back as a tool message and repeat, up to `maxSteps` (default 8).

Plain chat (Agent toggle off) skips tools and streams tokens instead.

## The approval gate

`write_file` does not write immediately. It calls `approveWrite(path, before, after)`,
which returns a promise. In the UI this opens `DiffReview`; the promise resolves on
Apply/Reject, and only then does the VFS change. This keeps the agent honest — it cannot
silently rewrite your project. Auto-apply short-circuits the promise to `true`.

## The virtual file system

`src/lib/vfs.ts` is a flat `path → content` map persisted to `localStorage`, with a
tiny subscribe/notify bus. The explorer, editor tabs and tools all read and write it.
There is no real filesystem in the browser; this is the project.

## The sandbox

`src/lib/sandbox.ts` builds a Web Worker from a Blob, overrides `console.*` to post
messages back, `eval`s the snippet, and terminates the worker on completion or timeout.
It has no DOM access. Python is handled separately by Pyodide (see below).

## Multi-language execution

JavaScript runs in a Web Worker (`sandbox.ts`). Python runs in **Pyodide** — CPython
compiled to WebAssembly — loaded lazily from a CDN on first use (`python.ts`), with
stdout/stderr captured. `exec.ts` dispatches by file extension or an explicit language.
The `run_code` tool and the terminal both go through it.

## Sessions, mentions, and the palette

`src/lib/sessions.ts` holds multiple conversations; the active one's history/transcript
live in the UI and are flushed back to the store on every change (`anvil.sessions.v1`).
`src/lib/mentions.ts` parses `@path` references and appends the referenced files to the
prompt as `<file>` blocks. The command palette (`components/CommandPalette.tsx`) exposes
every top-level action under ⌘K / Ctrl K.

## Persistence & portability

Everything lives in the browser's `localStorage`: the project tree (`anvil.vfs.v1`),
settings (`anvil.settings.v1`), and the conversation (`anvil.chat.v1`, via
`src/lib/project.ts`). The explorer's toolbar exports the tree to `anvil-project.json`
and imports it back; both round-trip through the pure `serializeProject` / `parseProject`
functions, which are unit-tested.

## Model discovery

`listModels` (`src/lib/llm.ts`) queries the provider's `/models` endpoint — directly with
BYOK, or via the Edge Function's `GET /api/chat` branch. `parseModelList` normalises the
OpenAI and Anthropic response shapes; `filterChatModels` removes non-conversational ids.
`detectProviderFromKey` (`src/lib/providers.ts`) maps a key's prefix to a provider so
pasting a key selects the right one.

## Extending

- **New provider:** append to `PROVIDERS` in `src/lib/providers.ts`. If it is
  OpenAI-compatible, set `kind: "openai"`; otherwise implement the Anthropic branch.
- **New tool:** add a `ToolDef` to `AGENT_TOOLS` and a case in `executeTool`
  (`src/lib/tools.ts`).
- **Proxy a new provider:** add it to the `PROVIDERS` map in `api/chat.ts` and set the
  matching env var.
