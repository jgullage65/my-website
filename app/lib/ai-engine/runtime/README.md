# AI Engine Runtime

Coordinates the engine.

Responsibilities:
- Orchestrate intake
- Build business memory
- Build retrieval context
- Update thread memory
- Return a deterministic engine result

Never:
- Contain provider-specific SDK logic
- Access the database directly
