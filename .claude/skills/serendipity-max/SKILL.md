---
name: serendipity-max
description: Serendipity reverse-engineered from first principles. Runs research and brainstorming the way inspired humans find "happy mistakes": wander on purpose, log every spark (something weird, clever, underused or surprising), follow the best sparks one or two hops, and let a separate judge decide which rabbit holes are fire and worth going deeper. Use by default on any research, brainstorm, creative or design task, and whenever the user says "serendipity", "rabbit holes", "happy mistakes", "follow the inspiration", "go down the rabbit hole", "exercise abstract thinking" or "/serendipity-max".
metadata:
  author: Claude (second-brain OS)
  created: 2026-11-14
---

# Serendipity max

Most research runs as a straight line from question to answer. Real inspiration doesn't work that way. You find something odd, it pulls at you, a door opens, and the best idea is often two doors away from where you started. This skill makes that process deliberate, and makes it checkable.

## The loop

1. **Seed wide.** Start from the obvious sources, then go deliberately sideways: manuals, hardware, other fields, old forums, academic papers, the weird corner of the scene.
2. **Log every spark.** A spark is anything that makes you go "huh": weird, clever, underused, contradicts the brief, or connects two things nobody connected. For each one write:
   - **What:** the thing itself.
   - **Where:** the real source URL or file. Never invent a source.
   - **Why it pulls:** what makes it intriguing.
   - **Gate:** which new direction it opens.
3. **Follow the pull.** Take the strongest sparks 1–2 hops further before you come back. Breadth first, then depth on the best 3–5.
4. **Judge separately.** Whoever finds a spark doesn't grade it. When orchestrating, cheap subagents (Sonnet or Haiku) scout and log sparks, and the orchestrator (or a separate critic agent) judges them:
   - **Fire:** send a scout deeper.
   - **Interesting:** park it in the spark log.
   - **Dead:** cut it and say why.
5. **Collide.** Put sparks from different fields next to each other on purpose. The best ideas usually sit where two sparks touch, like a hardware pedal manual next to an evolutionary algorithm.
6. **Repeat** until the sparks stop surprising you. Then distill: first principles, then concrete ideas, each traced back to the sparks it came from.

## Deep-research mode (planner → executors → curator → writer)
Borrowed from GPT Researcher's architecture (Apache-2.0, method only, no install: running it needs paid OpenAI/Tavily keys). Use it when a question needs a cited report, not just sparks. It runs on the tools you already have (WebSearch, the TinyFish search/fetch connector, gh), so it costs nothing beyond your plan.
1. **Plan.** Split the question into 4-7 sub-questions that each need different sources (official docs, data/studies, operators, code, the adversarial view). Write them down before searching.
2. **Execute in parallel.** One cheap scout (Haiku, or Sonnet when reading is hard) per 2-3 sub-questions, never one per question. Each returns sources + quotes + labels, with no conclusions.
3. **Curate.** Deduplicate, then score each source: primary > secondary; measured data > advice; recency; whether the author sells something. Drop the weak ones and say why.
4. **Write.** A cited report where every claim carries its label (MEASURED / VERIFIED / SAID / INFERRED / UNVERIFIED) and a link, and the gaps are stated as gaps.
5. **Sparks still count.** Anything surprising found along the way goes into the SPARK LOG, and the judge step still runs.
6. **Budget.** Say the planned number of agents up front; when the user is short on usage, use one well-briefed scout instead of a fleet.

## Rules

- **Quality over speed.** No rush. A rabbit hole that pays off is worth the time.
- **Facts stay labeled.** Sparks can be wild, but every claim is still marked verified, said by the source, or my inference.
- **Keep the person in the loop like a painter at work.** Report each new spark or finding as it lands, abstractly, showing how ideas build on and connect to each other. Don't save everything for one dump at the end.
- **Capture the user's own floats** in a seeds file the moment they say them. Their offhand ideas are sparks too.
- **Range, not role-play.** When bringing in another field, use its methods and instruments, not just its vocabulary (see `be-ambitious`). Include at least one adversarial critic on anything high-stakes.

## Output shape (for research notes)

`SPARK LOG` (numbered) → `DEEP DIVES` (best 3–5) → `FIRST PRINCIPLES` → `CONCRETE IDEAS` (each with its mechanism and the sparks it came from) → `OPEN THREADS`.
