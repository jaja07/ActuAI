# ActuAI - Frontend (Human-in-the-Loop Dashboard)

> ⚠️ **Work in progress / UI prototype.** This is a React mock-up of the Human-in-the-Loop (HITL) operations dashboard described in the ActuAI project report. All data shown (inbox items, SAP diffs, AOG alerts, RAG synthesis) is currently **hardcoded mock state** — there is no live connection to `actuai_backend` yet.

## 🎯 Purpose

In the target ActuAI architecture, no AI agent has autonomous write-access to the production ERP. Whenever the LangGraph orchestrator (in `actuai_backend`) drafts an action — an SAP update payload, a Non-Conformance Report, a RAG-based document synthesis — execution pauses and the draft is surfaced here for a human expert (a Quality/Actuation engineer) to review and explicitly validate or reject before anything is written back to SAP.

This module renders that review experience: a validation inbox plus three dedicated detail views:

* **SAP Date Update** — an interactive split-diff view comparing the current SAP value against the agent-proposed value (e.g. a delivery date shift).
* **AOG Risk Alert** — an urgent panel for component delays that threaten to block the Airbus assembly line (Aircraft On Ground risk).
* **RAG Synthesis** — a simulated AI co-pilot view presenting a synthesized answer (e.g. an 8D report root-cause summary) drawn from technical documents.

## 📂 Project Structure

```text
actuai_frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── metadata.json              # AI Studio project metadata (this app was scaffolded with Google AI Studio)
├── .env.example
└── src/
    ├── main.tsx                 # React entrypoint
    ├── App.tsx                   # Renders Dashboard
    ├── index.css
    ├── types.ts                   # Shared types (InboxItem, ViewType)
    └── components/
        ├── Layout.tsx               # Top bar, side navigation, toasts
        ├── Dashboard.tsx             # Page state: inbox items, active view, "new inspection" modal
        ├── InboxList.tsx              # Left panel: list of pending validation items
        ├── TaskDetailsPane.tsx         # Right panel: routes to the active detail view
        ├── SapUpdateView.tsx            # SAP date update split-diff view
        ├── AogAlertView.tsx               # AOG risk alert view
        └── RagSynthesisView.tsx            # RAG synthesis / AI co-pilot view
```

## 🧰 Tech stack

| Domain | Library |
|---|---|
| Build tool | Vite 6 |
| UI framework | React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Icons | `lucide-react` |
| Animation | `motion` (Framer Motion) |

This project was originally scaffolded with **Google AI Studio**, which is why `metadata.json` and some boilerplate remain. The Gemini API integration that AI Studio adds by default (`@google/genai` dependency, `GEMINI_API_KEY` env var) has been removed since this app does not call any LLM directly — all AI orchestration happens server-side in `actuai_backend`.

## ⚙️ Prerequisites and Installation

**Prerequisites:** Node.js

```bash
cd actuai_frontend
npm install
```

Copy the environment template if needed:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `APP_URL` | The URL where this app is hosted (used for self-referential links / OAuth callbacks once authentication is wired up). |

## 🚀 Usage

```bash
npm run dev      # Start the dev server on http://localhost:3000
npm run build    # Production build (output to dist/)
npm run preview  # Preview the production build locally
npm run lint     # Type-check with tsc (no emit)
```

## 📊 Implementation status

| Feature | Status |
|---|---|
| Layout, navigation, validation inbox UI | ✅ Implemented (static mock data) |
| SAP Date Update / AOG Alert / RAG Synthesis detail views | ✅ Implemented (static mock data) |
| "New inspection" creation modal | ✅ Implemented (local state only) |
| Connection to `actuai_backend` REST API (`/api/hitl/...`) | ❌ Not implemented |
| Real-time updates (new agent drafts appearing in the inbox) | ❌ Not implemented |
| Authentication / user session | ❌ Not implemented |

## 🔗 Integration with the rest of ActuAI

Once `actuai_backend`'s HITL router (`src/api/routers/hitl.py`) is implemented, this dashboard is meant to:

* Fetch pending agent-drafted actions from the backend instead of the hardcoded `inboxItems` array in `Dashboard.tsx`.
* Submit explicit human validation/rejection decisions back to the backend via REST, which then triggers (or blocks) the actual SAP write-back.
