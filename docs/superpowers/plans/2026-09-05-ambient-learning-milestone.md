# Ambient Learning Event Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** Build a dependency-free local prototype that turns fictional life signals into an auditable learning timeline and reversible plan adjustment.

**Architecture:** A shared ES module defines and validates the event contract. A static web application consumes two fictional scenarios, stores user confirmations locally, and presents source-aware events plus a plan adjustment preview. A built-in Node server and `node:test` suite keep the repository runnable without package downloads.

**Tech Stack:** HTML5, CSS, browser JavaScript modules, Node.js 24 built-ins, `node:test`

---

### Task 1: Create the event protocol

**Files:**
- Create: `package.json`
- Create: `packages/event-schema/src/index.js`
- Create: `packages/event-schema/test/event-schema.test.js`

- [ ] **Step 1: Write tests for valid events, invalid fields, sorting, and decisions**

Use `node:test` and `node:assert/strict`. Cover the five kinds `plan`, `behavior`, `self_report`, `artifact`, and `inference`; require identifiers, timestamps, source, actor, visibility, and consent scope; require an inference to have a pending, confirmed, or rejected status.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test packages/event-schema/test/event-schema.test.js`  
Expected: FAIL because `src/index.js` does not exist.

- [ ] **Step 3: Implement the protocol module**

Export `EVENT_KINDS`, `validateEvent(event)`, `sortEvents(events)`, and `applyInferenceDecision(events, eventId, decision)`. Validation returns `{ valid, errors }`; decisions return a new array and never mutate input.

- [ ] **Step 4: Run the tests**

Run: `node --test packages/event-schema/test/event-schema.test.js`  
Expected: all protocol tests PASS.

### Task 2: Add fictional scenarios and plan state

**Files:**
- Create: `apps/web/data/scenarios.js`
- Create: `apps/web/lib/plan-state.js`
- Create: `apps/web/test/plan-state.test.js`

- [ ] **Step 1: Write plan-state tests**

Test that adopting an adjustment increments the plan version, records the reason and changed actions, and leaves the original object unchanged. Test rejection and reset behavior.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test apps/web/test/plan-state.test.js`  
Expected: FAIL because the plan-state module does not exist.

- [ ] **Step 3: Implement immutable plan transitions and two scenarios**

Export `adoptAdjustment(plan, adjustment)` and `rejectAdjustment(plan, adjustment)`. Add family-English and adult-data scenarios with at least four source types, one pending inference, a learning-map summary, and a time-constraint adjustment.

- [ ] **Step 4: Run both test suites**

Run: `node --test packages/event-schema/test/event-schema.test.js apps/web/test/plan-state.test.js`  
Expected: all tests PASS.

### Task 3: Build the web experience

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/styles.css`
- Create: `apps/web/app.js`

- [ ] **Step 1: Create semantic page structure**

Add a scenario switcher, outcome-led hero, daily timeline, pending confirmation card, learning-map summary, adjustment preview, data-source explanation, privacy level indicator, and reset control. Use buttons for all actions and status text with `aria-live`.

- [ ] **Step 2: Implement rendering and interaction**

Validate events before display; sort the timeline; expand source details; confirm or reject an inference; adopt or dismiss an adjustment; persist decisions in `localStorage`; and reset the selected scenario.

- [ ] **Step 3: Create responsive visual design**

Use a warm paper-like palette, strong information hierarchy, visible source/type badges, restrained motion, `prefers-reduced-motion`, keyboard focus states, and a single-column mobile layout below 760px.

- [ ] **Step 4: Perform browser syntax checks**

Run: `node --check apps/web/app.js`  
Expected: no output and exit code 0.

### Task 4: Add a safe local server

**Files:**
- Create: `scripts/serve.mjs`
- Create: `scripts/test-server.mjs`

- [ ] **Step 1: Write a server smoke test**

Start the server on an ephemeral port, request `/`, `/styles.css`, and an attempted traversal path, and assert HTML/CSS success plus traversal rejection.

- [ ] **Step 2: Implement the static server**

Serve `apps/web`, map `/` to `index.html`, set basic content types, use resolved paths to prevent traversal, and support `PORT` with a default of 4173.

- [ ] **Step 3: Run the smoke test**

Run: `node scripts/test-server.mjs`  
Expected: output `server smoke test passed` and exit code 0.

### Task 5: Document capture integrations

**Files:**
- Create: `examples/events/android-usage.json`
- Create: `examples/events/apple-shortcut-voice.json`
- Create: `examples/events/calendar-plan.json`
- Create: `docs/integrations/event-ingestion.md`
- Create: `README.md`

- [ ] **Step 1: Add protocol-valid example payloads**

Create one plan, one behavior, and one self-report example using fictional data. Include source, consent, visibility, timestamps, and goal hints.

- [ ] **Step 2: Document connector responsibilities**

Explain device-side filtering, idempotent event IDs, offline retry, source labels, and the rule that connectors create signals rather than mastery claims.

- [ ] **Step 3: Add repository quick start and product explanation**

Document `pnpm test` and `pnpm dev`, the two demo scenarios, scope boundaries, directory map, and the Android/web/iOS-personal roadmap.

- [ ] **Step 4: Validate every example against the protocol**

Add a test that loads every JSON file in `examples/events` and expects `validateEvent` to return valid.

### Task 6: Run the milestone verification

**Files:**
- Modify: `docs/superpowers/plans/2026-09-05-ambient-learning-milestone.md`

- [ ] **Step 1: Run all automated checks**

Run: `pnpm test`  
Expected: protocol, plan state, JSON example, and server smoke tests PASS.

- [ ] **Step 2: Start the local experience**

Run: `pnpm dev`  
Expected: server reports `http://localhost:4173` and the two scenarios are usable.

- [ ] **Step 3: Review against the design**

Confirm that invalid information is rejected, every inference requires a decision, source details are traceable, adopting an adjustment increments the version, and no screen implies that usage time proves learning.

- [ ] **Step 4: Mark completed plan items**

Change only completed checklist boxes from `[ ]` to `[x]` and record any verified limitation beneath the relevant task.

## Verification

The milestone is complete when `pnpm test` passes, the site loads through the local server, both scenarios can confirm an inference and adopt an adjustment, and the README lets a new user start the demo without installing dependencies.

## Next skill

`$superpower-executing-plans`

