# DesignDojo — Low-Level Design (LLD) Practice Platform

DesignDojo is a full-stack Low-Level Design (LLD) practice platform built for the CipherSchools Full Stack Development Internship assignment. Learners browse LLD challenges in a LeetCode-inspired dashboard, model UML class diagrams in a custom `@xyflow/react` canvas, edit class/relationship properties in a Figma-inspired right inspector, and submit designs for hybrid deterministic + Gemini AI evaluation.

## Features
- **LeetCode-Inspired Dashboard**: Overview cards (Attempted, Completed, Average Score), search, difficulty filter, topic filter, Continue Practicing banner, and recent attempts feed.
- **Three Seeded Complete Problems**: *Multi-Floor Parking Lot*, *Smart Building Elevator Control System*, and *Automated Vending Machine*.
- **Three-Panel Practice Workspace**:
  - **Left Panel**: Persistent problem description, functional requirements, constraints, acceptance criteria, expandable hints, rationale editor, and attempt history.
  - **Center Panel**: Custom `@xyflow/react` class diagram editor with Class/Interface/Abstract nodes, 5 UML relationship types (`association`, `inheritance`, `composition`, `aggregation`, `dependency`), multiplicity labels, Undo/Redo stack, and reference starter templates.
  - **Right Panel**: Figma-inspired property inspector separating visual geometry (`X`, `Y`, `W`, `H`, `Rotation`) from semantic class attributes, methods, parameters, visibilities, and relationship endpoints.
- **Hybrid Evaluator (`RuleBasedEvaluator` + `AIEvaluator`)**:
  - Deterministic structural checks for duplicate IDs/names, dangling relationship endpoints, cyclic inheritance, missing rubric concepts/methods, missing abstractions, and rationale length.
  - Backend-only Gemini contextual evaluation with Zod output validation, 12s bounded timeout, anti-hallucination element ID filtering, and automatic fallback to deterministic rules.
- **Immutable Attempt History & Retry**: Retrying creates a new immutable snapshot (`attemptNumber = N + 1`) without mutating earlier submissions.

## Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router v6, `@xyflow/react`, Lucide Icons, Zod
- **Backend**: Node.js, Express, TypeScript, MongoDB + Mongoose, `@google/genai`, Zod, Vitest, Supertest

## Prerequisites
- Node.js >= 18.x
- MongoDB running locally (`mongodb://127.0.0.1:27017/designdojo`) or MongoDB Atlas URI
- Optional: `GEMINI_API_KEY` (automatically falls back to deterministic evaluation when omitted)

## Installation & Startup
```bash
npm run install:all
cp server/.env.example server/.env
cp client/.env.example client/.env
npm test
npm run verify:e2e
npm run dev
```

## Known Limitations
- Uses a persistent anonymous learner session ID (`x-learner-id` stored in `localStorage`) rather than full OAuth.
- Uses synchronous evaluation with a bounded 12s timeout rather than a distributed message queue.