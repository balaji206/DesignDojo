# Product & Engineering Research — DesignDojo

## 1. Learner Problem
Learners preparing for Low-Level Design (LLD) interviews lack a dedicated practice tool. Generic whiteboards (Excalidraw, Draw.io) treat class boxes and arrows as untyped shapes with zero semantic validation, while coding platforms (LeetCode) test algorithmic input/output without evaluating object-oriented domain modeling, SOLID principles, or class relationships.

## 2. Sources Reviewed
- **LeetCode**: Reviewed dashboard filtering, difficulty progression, and persistent left-hand problem context.
- **Figma**: Reviewed the right-hand Property Inspector pattern that separates visual coordinates (`X, Y, W, H, Rotation`) from semantic component properties.
- **React Flow (`@xyflow/react` v12)**: Reviewed custom node handles, edge markers, and controlled graph synchronization.
- **UML 2.5 Specification**: Reviewed standard visibility notation (`+`, `-`, `#`), stereotypes (`<<interface>>`, `<<abstract>>`), and relationship types.

## 3. Identified Gaps & MVP Rationale
By binding custom React Flow nodes and edges directly to a validated TypeScript domain AST (`Submission`), DesignDojo runs instant deterministic rubric checks first and augments them with structured Gemini architectural critique.