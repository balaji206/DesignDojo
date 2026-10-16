# Architecture & Domain Design — DesignDojo

## 1. Modular Monolith Architecture
```
[React + @xyflow/react Client]
       | REST JSON (x-learner-id)
       v
[Express API + Zod Request Validation]
       |
       v
[EvaluationService (Application Layer)]
   +---> [PracticeAttempt Aggregate (State Machine)]
   +---> [HybridEvaluator (RuleBasedEvaluator + AIEvaluator)]
   +---> [MongoProblemRepository & MongoAttemptRepository]
```

## 2. Attempt State Transitions
- Legal transitions enforced inside `PracticeAttempt`:
  - `SUBMITTED -> EVALUATING -> COMPLETED`
  - `SUBMITTED -> FAILED`
  - `EVALUATING -> FAILED`
- `COMPLETED` and `FAILED` are terminal immutable states. Retrying creates a new `PracticeAttempt` (`attemptNumber = N + 1`) referencing `basedOnAttemptId`.

## 3. 100-Point Evaluation Rubric
- Requirement Coverage: 25 pts
- Responsibilities & Cohesion: 20 pts
- Relationships & Coupling: 20 pts
- Extensibility & Abstractions: 20 pts
- Behaviour & Rationale: 15 pts

## 4. AI Failure Handling & Anti-Double-Penalization
- Submissions are persisted to MongoDB before evaluation begins.
- `HybridEvaluator` passes deterministic findings to Gemini with instructions not to duplicate penalties, filters out any hallucinated element IDs, and falls back to `RuleBasedEvaluator` on timeout, rate-limit, or malformed JSON.