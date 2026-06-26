# ActuAI Frontend — Validation Console & UI System

The React dashboard for ActuAI's Human-in-the-Loop workflow, plus the reusable
**UI system** it's built on. An operator signs in, reviews the actions the
agents have drafted, and approves or rejects each one — approval is the only
path that reaches SAP or sends a client reply.

## Quickstart

```bash
npm install
npm run dev        # http://localhost:5173  (proxies /api -> backend on :8000)
npm run build      # production bundle in dist/
npm run preview    # serve the production build locally
```

The component library is browsable on its own:

```
http://localhost:5173/?view=showcase
```

Or run the **entire stack** (DBs + mock SAP + backend + this UI behind nginx)
with one command from the repo root:

```bash
docker compose up --build      # then open http://localhost
```

## Architecture

```
src/
├── main.jsx                # entry: loads design tokens, mounts <App>
├── App.jsx                 # providers + view switch (login / dashboard / showcase)
├── styles/
│   └── tokens.css          # design tokens (color, type, spacing, motion) + reset + dark mode
├── lib/
│   └── api.js              # the only place that calls fetch(); normalized ApiError
├── context/
│   └── AuthContext.jsx     # JWT in memory + useAuth()
├── hooks/
│   └── useTasks.js         # queue fetch + poll + optimistic approve/reject
└── components/
    ├── ui/                 # the reusable design system (primitives)
    │   ├── Button, Card, Badge, StatusLED, Field, Input, Alert,
    │   │   Spinner, Skeleton, EmptyState, CodeBlock, Icon, VisuallyHidden, Toast
    │   └── index.js        # barrel: import { Button, Card } from "../components/ui"
    ├── AppShell.jsx        # header + responsive layout + skip link
    ├── LoginScreen.jsx     # sign-in form (accessible, password-manager friendly)
    ├── TaskStrip.jsx       # one agent draft as a control-tower "flight strip"
    ├── TaskList.jsx        # the queue: loading / error / empty / ready states
    └── ComponentShowcase.jsx  # living style guide + prop reference
```

Feature components compose primitives; primitives never import features. All
cross-cutting state (auth, toasts) lives in providers, so feature components stay
small and unit-testable against a fake API client.

## Design language

A control-tower console: titanium neutrals, an aerospace-blue primary
("writes to SAP"), and unambiguous signal colors (amber = waiting, green = done,
red = stop). Monospace is the "instrument readout" for IDs and payloads. The
signature element is the **status rail + LED** on each task strip, readable at a
glance. Light and dark themes follow the OS preference automatically.

## Component API

All primitives forward unknown props to their root element and use semantic HTML.

### `<Button>`
| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `primary \| secondary \| ghost \| danger \| success` | `primary` | |
| `size` | `sm \| md \| lg` | `md` | |
| `loading` | `boolean` | `false` | shows spinner, sets `aria-busy`, blocks clicks, keeps width |
| `disabled` | `boolean` | `false` | |
| `fullWidth` | `boolean` | `false` | |
| `iconLeft` / `iconRight` | `ReactNode` | — | |

```jsx
<Button variant="primary" loading={saving} iconLeft={<Icon name="check" />}>
  Approve & write to SAP
</Button>
```

### `<Card>`
`rail` (`pending \| ok \| danger \| info`) draws the colored status rail ·
`interactive` adds hover lift · `as` sets the element (`"li"` inside lists).

### `<StatusLED>` — signature element
`status` (`pending \| ok \| danger \| info`) · `pulse` (slow glow) · `label`/children.
Always paired with a text label — meaning never depends on color alone.

### `<Badge>`
`tone` (`neutral \| info \| pending \| ok \| danger`). A compact labelled pill.

### `<Field>` + `<Input>`
`<Field label hint error required>` renders a `<label>` and wires
`id` / `aria-describedby` / `aria-invalid` to the control via a render prop:

```jsx
<Field label="Username" hint="Your operator ID" error={err} required>
  {({ id, describedBy, invalid }) => (
    <Input id={id} describedBy={describedBy} invalid={invalid} value={v} onChange={...} />
  )}
</Field>
```

### `<Alert>`
`tone` (`info \| success \| warning \| danger`) · `title` · optional `onDismiss`.
Uses `role="alert"` for warning/danger, `role="status"` otherwise.

### `<Spinner>` / `<Skeleton>` / `<EmptyState>`
Loading and empty primitives. `Spinner` is `role="status"` with a hidden label.
`Skeleton` is decorative (`aria-hidden`), shimmer disabled under reduced motion.
`EmptyState` takes `icon`, `title`, `description`, `action`.

### `<CodeBlock>`
`value` (object → pretty JSON, or string) · `label` · `maxHeight`. Monospace
readout with a copy button.

### Toasts — `ToastProvider` + `useToast()`
Wrap the app once in `<ToastProvider>`, then:

```jsx
const toast = useToast();
toast.success("Task #12 approved");   // polite aria-live
toast.error("SAP write failed");      // assertive aria-live
toast.info("Queue refreshed");
```

## Accessibility (built-in)

- Real semantic elements (`button`, `form`, `label`, `ul`/`li`, `main`).
- Visible keyboard focus (`:focus-visible`), a skip-to-content link.
- Live regions: toasts (`polite`/`assertive`), inline errors `role="alert"`.
- Loading announced via `role="status"`; skeletons hidden from AT.
- Status never conveyed by color alone (LED + text label, badges with text).
- `prefers-reduced-motion` disables shimmer/animation; `prefers-color-scheme`
  drives the theme; targets meet WCAG AA contrast.

## Data contract

`lib/api.js` talks to the backend over the same origin (`/api/...`), so the build
works behind the reverse proxy in production and the Vite proxy in dev:

- `POST /api/auth/login` (form `username`,`password`) → `{ access_token }`
- `GET /api/tasks` → `Task[]`
- `POST /api/tasks/:id/approve` · `POST /api/tasks/:id/reject`

`Task = { id, mission, agent, kind: "SAP_UPDATE"|"EMAIL_REPLY", summary, payload, status, created_at }`
