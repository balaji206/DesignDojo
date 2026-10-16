# AI Usage & Engineering Decisions

## 1. Separating Visual Geometry from Semantic UML Data
- **Suggestion**: Store raw React Flow `Node` and `Edge` payloads directly in MongoDB.
- **Decision**: **Rejected**. Stored clean `ClassDefinition` and `Relationship` models with an optional `layout: { x, y, width, height, rotation }` sub-object.
- **Why**: Keeps backend domain validation and AI prompts decoupled from UI rendering libraries.
- **Verification**: Verified via unit tests in `server/tests/evaluation.test.ts`.

## 2. Delta-Based Hybrid Scoring to Avoid Double Penalties
- **Suggestion**: Average the deterministic score and AI score 50/50.
- **Decision**: **Modified**. Used `RuleBasedEvaluator` as the deterministic baseline and constrained `AIEvaluator` to bounded `criterionAdjustments` while deduplicating findings by `(criterion, affectedElementIds)`.
- **Why**: Prevents penalizing a learner twice when both rule checks and Gemini notice the same missing interface.
- **Verification**: Verified via Test #6 and Test #9 in `evaluation.test.ts`.

## 3. Anti-Hallucination Sanitization on AI Findings
- **Suggestion**: Pass AI `affectedElementIds` directly to the frontend canvas highlighter.
- **Decision**: **Accepted with post-filtering** against the actual `Set<string>` of submitted class and relationship IDs.
- **Why**: Prevents broken canvas highlights if the LLM invents a class name instead of using an existing ID.
- **Verification**: Verified via Test #9 in `evaluation.test.ts`.