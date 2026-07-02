# Glass Box

*An approach to building AI reasoning interfaces that are inspectable, steerable, and bounded.*

---

## What this is

Glass Box is a working hypothesis about how AI should be built into high-stakes software — and, eventually, a framework that makes that hypothesis cheap to apply.

The hypothesis is simple: **AI should not replace expert systems. It should operate inside them.** Deterministic logic, domain rules, and structured knowledge form the substrate. Models act as a reasoning and interface layer on top of that substrate. Every step a model takes is something a user can see, interrupt, and redirect.

This repository is the public home for that work. Today it contains a concept document, a roadmap, and an early implementation of the core substrate — a typed reasoning DAG, an append-only event log, deterministic replay, and a redaction layer — plus a first React renderer on top. It does not yet contain a shipping framework. Treat what's here as the architectural skeleton and the principles that govern it — the code will catch up to the thesis over time, not the other way around.

## The thesis

The default pattern for AI in production right now is to let a model decide, then build trust around it after the fact: evals, red-teaming, observability dashboards, post-hoc explanations. That works for low-stakes consumer surfaces. It does not work for regulated industries, professional services, clinical decision support, financial advisory, or any domain where a wrong answer has a name and a cost attached to it.

In those domains, opaque reasoning is not a feature you tune. It is a liability you carry. Every unconstrained call to a model in a serious workflow is debt — debt the auditor, the regulator, the clinician, or the user eventually has to repay.

The inversion is this: the expert system is the source of truth. Rules, ontologies, policies, calculators, and validated procedures stay deterministic. The model's job is to navigate that substrate on behalf of the user — interpreting input, choosing paths, summarising results, flagging conflicts — never to override it. Unconstrained AI produces debt. AI bounded by an expert system produces leverage.

Glass Box is what the surface of that pattern looks like when you take it seriously: a substrate where reasoning is decomposed into discrete, inspectable steps; where confidence is grounded in citations rather than asserted; where state-changing actions stop and ask; and where the user can fork, steer, and resolve conflicts without leaving the flow.

A clarification on scope. Glass Box does not tell you *when* to reach for a model versus when to stay in deterministic code — that decision is upstream of the framework and belongs to whoever is designing the system. Glass Box's job begins the moment you have decided you need probabilistic reasoning. From there, it is a tool for making that reasoning legible and correctable, not for minimising it.

## Principles

**Expert systems as substrate, AI as interface.** The domain logic is the load-bearing structure. The model is a thin, expressive layer that helps a human operate that structure. Inverting this relationship — letting the model carry the domain and bolting rules on as guardrails — is how you end up with systems that are simultaneously impressive and unshippable.

**Every reasoning step should be inspectable.** Not as a debugging affordance for engineers, but as a primary UI surface for end users. If a model influenced an output, the user should be able to see which step it influenced, what it was given, and what it produced. Reasoning that exists only in logs does not count.

**Humans steer, models execute.** The model proposes; the human disposes. Forks, branches, overrides, and approvals are not edge cases — they are the main interaction model. A system the user can only accept or reject is a system the user does not control.

**Constraints are features, not limitations.** A narrower action space is a clearer action space. Bounded tools, typed payloads, and explicit gates make AI behaviour legible. The instinct to give a model more capability "just in case" is usually how you produce a system no one can reason about, including the people who built it.

**Auditability is a first-class concern, not a compliance afterthought.** Every meaningful decision — what the model saw, what it chose, what the user did about it — should be reconstructible from an append-only event log. If the audit story is "we'll add logging later," the system is already non-auditable. Designing for replay from day one is what makes everything else honest.

**Always cite sources.** A claim with no provenance is a claim the user cannot evaluate. Citations are not decoration; they are the link between an inference and the substrate it came from. If a step cannot be cited, that itself is information the user needs.

**Always display confidence, and ground it.** Confidence numbers detached from their evidence are theatre. A confidence score should be visibly tied to the citations and prior steps that produced it, so the user can interrogate the number rather than trust it.

**State-changing actions stop and ask.** Anything that mutates the world — writes, calls, sends, files — passes through an explicit gate. Allow once, allow always (scoped), modify, or reject. The cost of one extra click is trivial compared to the cost of a silent wrong action.

**Conflicts surface, they do not get averaged.** When the substrate produces contradictory evidence, the right answer is almost never to silently pick one. The system halts, shows both, and lets the human arbitrate. Smoothing over disagreement is how subtle errors compound.

## The substrate

The core of Glass Box is not a component library. It is a way of modelling an AI-assisted run so that supervision is intrinsic to the data, not bolted on at the view layer.

A run is a **typed directed acyclic graph** of `ThoughtNode`s. Four node types — `citation`, `decision`, `execution`, `conflict` — cover the supervision-relevant moments of a run. Each decision carries an explicit `provenance` array pointing back at the citation nodes that grounded it; each execution carries a typed action payload and a gate status; each conflict carries the contenders it is asking the user to arbitrate. The graph is the explanation. There is no separate "reasoning trace" to reconcile with the output.

The DAG is built from an **append-only event log**. `RunStarted`, `SourceAdded`, `DecisionMade`, `ActionRequested`, `ActionResolved`, `ConflictDetected`, `ConflictResolved`, `BranchForked`, `BranchSwitched`, `RunCompleted` — a versioned, replayable record of everything the system and the user did. State is a fold over events. Any run can be rebuilt, replayed, or audited from its event stream alone, which is what makes "auditability is a first-class concern" a property of the data model rather than an aspiration.

IDs are **deterministic** — structural, not random. Node IDs encode sequence, node type, and branch; branch IDs encode their fork point; event IDs are sequence counters scoped to the run. The same event stream rebuilds to the same graph in any environment, which is what makes replay honest and diffs meaningful.

A **privacy layer** sits between the raw log and any consumer. Redaction hooks, exposure predicates, and user-facing summarisation are part of the core API, not the UI, so the distinction between *what was reasoned* and *what is safe to show* — to a user, to an auditor, to a downstream system — is a decision the integrating application makes explicitly rather than one it discovers it needed after shipping. The default hooks are permissive pass-throughs today; the contribution at this stage is that the seam exists in the core, not that the core ships a redaction policy. Glass Box is not a raw chain-of-thought viewer, and this seam is where that boundary gets enforced.

Forking, branch switching, gate decisions, and conflict resolutions are all just events on the same log. The user's actions and the model's actions live in the same history, in the same order they happened. The DAG never silently rewrites itself.

The React layer is one renderer over this substrate — a spatial rail, decision tooltips with provenance highlighting, execution gates, and a conflict resolver. It is the first reference implementation, not the framework. The framework is the model.

None of these primitives is novel in isolation. The contribution Glass Box is trying to make is treating them as a *single coherent substrate* — a shared vocabulary of nodes, events, and redactions — so the same model works whether you are building clinical decision support, a financial advisor's workbench, a legal drafting tool, or a compliance review interface. The domain logic changes. The supervision substrate does not.

## Where this sits among its neighbours

The ideas above have neighbours, and it is worth being precise about where the overlap ends. Most of these tools are complements to Glass Box, not competitors — the difference is almost always *who the reasoning surface is for*.

**Agent observability platforms** — [Langfuse](https://langfuse.com), [Arize Phoenix](https://phoenix.arize.com), [Laminar](https://laminar.sh), and trace-rendering component libraries like [AgentPrism](https://evilmartians.com/chronicles/debug-ai-fast-agent-prism-open-source-library-visualize-agent-traces) — share Glass Box's instinct that everything should be recorded and replayable. But they are built for engineers, after the fact: dashboards you consult when something went wrong. Glass Box takes the same record-everything discipline and points it at the *end user, live, inside the product*. The trace is not a debugging artifact; it is the interface.

**Agent-frontend stacks and protocols** — [CopilotKit](https://github.com/copilotkit/copilotkit) and the [AG-UI protocol](https://docs.ag-ui.com) solve the transport problem: streaming agent state into a frontend, generative UI, and human-in-the-loop hooks you can wire up however you like. They are deliberately unopinionated about supervision semantics. Glass Box is the opinionated layer that transport leaves open: a fixed node vocabulary, confidence that must trace to citations, conflicts that halt rather than average, gates on every mutation. Nothing prevents a Glass Box surface from being fed over AG-UI.

**Backend interrupt mechanisms** — LangGraph's interrupts and tools like HumanLayer give you pause-and-approve as a backend primitive. They answer "how does the run stop?" but not "what does the user see, and what vocabulary do they reason in while deciding?" Glass Box is mostly about the second question.

**Event-sourced agent architectures** — recent research ([ESAA](https://arxiv.org/html/2602.23193), [event-sourced reactive agent graphs](https://arxiv.org/pdf/2605.21997)) and practitioner writing have converged on the append-only log as the right substrate for agent auditability. Glass Box agrees, and treats that finding as settled infrastructure: the interesting work is what you build *on top of* the log for the person who has to trust the output.

If you are choosing between Glass Box and any of these, you are probably not choosing — you are stacking.

## Who this is for

This is for engineers and designers building AI into systems where being wrong has consequences. Regulated industries. Professional tools used by people with licences and liability. Internal systems where an error becomes someone's afternoon. Products where the user is an expert and the model is the junior collaborator, not the other way around.

It is less interesting if you are building open-ended consumer chat, creative tooling, or anywhere the cost of a hallucination is low and the cost of friction is high. Glass Box deliberately adds friction in exchange for legibility. That trade is right for some surfaces and wrong for others. Pick accordingly.

## Current state

- **Concept and principles** — this document, plus the original design note in [`docs/concept.md`](./docs/concept.md) and the build roadmap in [`docs/mvp-plan.md`](./docs/mvp-plan.md).
- **Core substrate** — `@glassbox/core` implements the typed DAG, the append-only event log with replay, deterministic ID generation, and the privacy/redaction layer described above. This is the part of the project the rest of the framework will be built around.
- **First renderer** — `@glassbox/react` is an early React layer over the core: spatial rail, decision provenance, execution gates, conflict resolver. It is one reference implementation, not the framework. Names and shapes at this layer will change.
- **Working playground** — `apps/playground` wires the full loop against a live model: a chat surface backed by a real LLM call, grounded in local source documents, emitting Glass Box events as it reasons. The seeded scenario is deliberately adversarial — two endurance-training studies that flatly contradict each other — so a single question ("how should I train for a marathon?") walks the whole pattern: citations added, conflict detected, stream halted, human arbitrates, decision made with provenance, execution gated. A hosted version is coming; until then it runs locally with an API key.
- **Reference implementations** — to follow. The intent is to publish at least one full domain example demonstrating the substrate-and-interface pattern end-to-end before recommending the framework for production use.

There is no stable release, no version number worth quoting, and no migration story yet. If you build on this today, build on the ideas.

## How to engage

If the thesis resonates — or if you think it's wrong in a specific, useful way — open an issue. Pull requests are welcome, especially around the core event model and the node typology, where the design decisions made now will be expensive to change later.

Longer-form writing on the thinking behind Glass Box is forthcoming on Substack. A link will land here when it does.

## License

Apache License 2.0. See [LICENSE](./LICENSE).
