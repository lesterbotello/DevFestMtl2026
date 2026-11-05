# DevFest MTL '26 — WebMCP Conference Companion

A React conference-companion app for the fictional DevFest MTL 2026: a
session scheduler that is fully functional by hand **and** actuated by an
agent through WebMCP — the Imperative API (JS tools registered on
`document.modelContext`) and the Declarative API (HTML forms annotated
with `toolname`/`tooldescription`/`toolparamdescription`).

UI and agent share one store and the same tools, so an agent action
visibly updates the app you can also drive yourself.

## Setup

1. **Chrome Canary.** WebMCP and tool use in the Prompt API are
   experimental and ship behind flags — enable both:
   - `chrome://flags/#enable-webmcp-testing` — exposes `document.modelContext`.
   - `chrome://flags/#prompt-api-tool-use` — unlocks tool use in the
     Prompt API (the on-device agent).
2. **Node** (recent LTS; the optional cloud server needs 20.6+ for
   `--env-file`).
3. Start the app:
   ```sh
   npm --prefix app install
   npm --prefix app run dev     # http://localhost:5173
   ```
4. Open the app, click the **Agent** button (bottom-right). The first
   time on a machine, the panel offers **Download on-device model** — a
   one-time download that lets the agent run fully offline (no key, no
   network).
5. Reset all app state any time with the **Reset demo data** link in the
   footer — it wipes the `dfm26:v1:*` localStorage state (role, agenda,
   registrations, feedback, questions, rooms) and keeps the panel
   settings.

> Canary auto-updates frequently, and an update can silently drop a flag.
> If the agent panel suddenly reports no tools, re-check both flags.

## Things to try

- **Ask the agent** (bottom-right panel): `Find talks about WebGPU`, then
  `Add it to my agenda` — a tool card runs `search_sessions`, then
  `add_to_agenda`, and **My Agenda** fills in the same UI a human would
  have used.
- **Build a schedule**: `Build me a frontend-heavy Saturday, no conflicts`
  — the agent chains several tool calls to search and add. The on-device
  model is small and may stop to ask; the cloud backend runs it end to
  end.
- **Declarative forms**: ask the agent to rate a talk on the **Feedback**
  tab — the form fills and autosubmits. Ask it to sign you up on the
  **Workshops** tab — the form fills but waits for your click, because
  that form has no `toolautosubmit`.
- **Safety annotations**: `Cancel my workshop registration` blocks on a
  confirmation dialog (`consequentialHint`). `What is the room asking?`
  summarizes the Q&A wall and shrugs off the prompt-injection question
  seeded in the data (`untrustedContentHint`).
- **Role gating**: flip the header role to **Organizer** — the panel
  badge goes from 8 to 10 tools (`toolchange` fires), a Stage Manager
  tab appears, and `run_av_check` repairs the seeded Grand Hall mic
  fault.
- **Interop**: any WebMCP-capable agent — e.g. the Model Context Tool
  Inspector extension with its own key — discovers and executes the same
  tools. The app changes nothing.

## Cloud backend (optional, needs wifi + key)

The agent panel has an **On-device / Cloud** toggle. Cloud routes the same
tools through a local zero-dependency server to Gemini; the API key never
reaches the browser.

```sh
cd server
cp .env.example .env        # put your GEMINI_API_KEY in .env (gitignored)
node --env-file=.env index.mjs   # http://localhost:8787 (PORT, GEMINI_MODEL overridable)
```

Then in the panel: toggle **Cloud**, leave the Server URL at
`http://localhost:8787`.

Smoke-testing without any model: append `?mockBackend=1` to the app URL —
the panel runs a scripted backend that exercises tool discovery and
execution (`search_sessions` → result card).

## Capability matrix

| Scenario | Config | What works |
|---|---|---|
| On-device (default) | Both flags on, model downloaded, wifi off | Everything the app offers — no key, no network |
| Cloud backend | Same + wifi + local Node server + key | Everything |
| Flags off | The vendored polyfill auto-loads; imperative tools register, discover, execute | Panel, chaining, confirm gate, Q&A, role switch. The declarative forms need native Chrome — if the polyfill happens to support the declarative surface, that's a bonus, never a dependency. Do not patch or extend the vendored polyfill |
| Other WebMCP agents | e.g. the Inspector extension, with its own key | The same tools driven by a different agent; the app is unchanged |

## Repo layout

```
app/     React app (Vite). Tools in src/webmcp/tools/, agent panel in
         src/components/Panel/ (backends: onDevice, cloud, mock).
server/  Zero-dep Gemini proxy for the cloud toggle (key stays here).
docs/    Design spec + implementation plan.
```
