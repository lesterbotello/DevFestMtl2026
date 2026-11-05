# DevFest MTL '26 — Conference Companion (app)

React + TypeScript + Vite. The talk demo — see the repo-root `README.md` for
the full demo kit (Canary flags, the 6-beat prompt ladder, rehearsal
checklist).

## Setup

```sh
npm install
npm run dev        # http://localhost:5173
```

Chrome Canary with `chrome://flags/#enable-webmcp-testing` and
`chrome://flags/#prompt-api-tool-use` is the demo machine; see the root
README for details. On other browsers the vendored WebMCP polyfill
auto-loads imperative tools (declarative forms are native-Chrome-only).

## Commands

```sh
npm test               # vitest, one-shot
npm run test:watch     # vitest, watch mode
npm run build          # tsc -b && vite build
npm run lint           # oxlint
```

`?mockBackend=1` on the dev URL runs the agent panel with a scripted
backend (no model needed) — useful for smoke-testing tool discovery and
execution.

## Where things live

- `src/webmcp/` — WebMCP surface: types, polyfill loader, the
  `useWebMCPTool` registration hook, and the tool factories in
  `src/webmcp/tools/` (composed per role by `useTools`).
- `src/components/Panel/` — the agent panel and its pluggable
  `ModelBackend`s: `backends/onDevice.ts` (Chrome Prompt API),
  `backends/cloud.ts` (local server → Gemini), `backends/mockBackend.ts`
  (scripted smoke path). Tool discovery/mapping + the consequential
  confirmation gate live in the panel.
- `src/components/screens/` — the six screens. Feedback and Workshop forms
  carry the WebMCP declarative attributes (`toolname`,
  `toolparamdescription`, `toolautosubmit`).
- `src/store/` — the localStorage-only store (`dfm26:v1:*` keys); the
  footer Reset link wipes it (preserving panel settings).
- `src/data/seed.ts` — the pinned bilingual conference seed data.

The vendored polyfill at `src/webmcp/polyfill/webmcp-polyfill.js` is
pinned from GoogleChromeLabs/webmcp-tools (commit recorded in the file
header). **Do not edit it.**