# Vitreous Playground

The reference demo for the Vitreous supervision substrate: a chat surface on the left, the explainability rail on the right. Ask a question, watch sources land as citation nodes, arbitrate the conflict when the studies disagree, and resolve the execution gate before anything is saved. The chat transcript itself is rebuilt from the run's event log on every reload.

Hosted at [vitreous-playground.vercel.app](https://vitreous-playground.vercel.app).

## Running locally

```bash
pnpm install
pnpm dev --filter=@vitreous/playground
```

Two modes, chosen by environment:

- **Live** — set `GEMINI_API_KEY` and the demo runs against a real model, grounded in the seed studies under `src/data/`.
- **Scripted replay** — with no key (or `VITREOUS_DEMO_MODE=1`), the model responses are canned but the supervision flow — arbitration, gating, forking — stays fully interactive. This is what the hosted demo runs.

See the repository root [README](../../README.md) for the thesis this demo exists to demonstrate.
