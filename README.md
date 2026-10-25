# Thya

Thya is an AI business assistant that small Indonesian food and beverage owners talk to on WhatsApp. An owner asks "untung minggu ini berapa?" in everyday Indonesian and gets the answer with their own numbers, plus a one-line explanation of what the number means.

Built for [.id DeveloperDay 2026](https://developerday.id) (PANDI, Road to APICTA). Landing page: https://thya.veterantech.id

## Status

This is a hackathon prototype. The final round is on 10 November 2026.

| Works today | Planned before the final |
|---|---|
| Agent answers sales questions over sample data from a fictional coffee shop | WhatsApp channel through the WhatsApp Cloud API |
| Tools for revenue, cost of goods sold, gross profit and margin, top and bottom menu items, and daily sales | Recording sales by chat, saved only after the owner confirms |
| Plain-language explanation of business terms, shown once per owner with their own numbers | Scheduled daily recaps and reminders |
| HTTP chat endpoint (`POST /demo/chat`) and a static landing page | Charts and weekly summary cards sent as images, Google Sheets import |

## How it works

- The model picks a metric and a period. TypeScript code computes every number. The agent is not allowed to calculate or invent figures.
- Business terms such as "untung", "modal" and "laku" map to defined metrics in one registry, so the same word always means the same calculation. The answer states which interpretation it used.
- One agent with a small set of tools. Tool inputs are validated with Zod.
- Writes (planned) go through a confirmation step and are idempotent, because WhatsApp can deliver the same webhook more than once.
- The model is DeepSeek V4.1 Flash served by [NetraRuntime](https://netraruntime.com), which has zero data retention by default and primary GPU infrastructure in Indonesia.

## Stack

| Part | Technology |
|---|---|
| Monorepo | Bun workspaces, Turborepo |
| API (`apps/api`) | Bun, Elysia, Vercel AI SDK 7, Zod |
| Web (`apps/web`) | Next.js 16 static export, Tailwind CSS 4, Motion |
| Lint and format | Oxlint with the vendored anti-slop plugin, Oxfmt |
| Deploy | Docker images built by GitHub Actions to GHCR, served by Dokploy on a VPS in Jakarta |
| Planned | Postgres with pgvector and Drizzle, pg-boss for queues and schedules |

## Repository layout

```
apps/
  api/        HTTP API, agent, tools, metric registry, evals
  web/        landing page
docs/         product context, architecture, plans and decisions (Indonesian)
tools/        vendored Oxlint plugin
scripts/      helper scripts
```

## Run locally

Requires [Bun](https://bun.sh) 1.4 or newer and a NetraRuntime API key.

```bash
bun install
cp .env.example .env   # then set NETRA_API_KEY
bun run dev            # API on :3001, web on :3000
```

Useful commands:

```bash
bun run lint           # oxlint, fails on any warning
bun run fmt:check      # oxfmt
bun run typecheck
bun run test
bun run --cwd apps/api verify:netra   # checks tool calling against NetraRuntime
bun run --cwd apps/api eval           # runs the agent eval suite against the real model
```

The eval suite calls the model and uses API credits, so it is not part of CI.

## Documentation

Design notes live in `docs/` and are written in Indonesian. Start with [AGENTS.md](AGENTS.md), which lists every document and what it covers. The main ones:

- [docs/product-context.md](docs/product-context.md): problem, target users, current status
- [docs/architecture.md](docs/architecture.md): repo structure, LLM verification results, hosting
- [docs/agent-harness.md](docs/agent-harness.md): data intake, metric registry, webhook and queue, memory, guardrails, evals
- [docs/decisions.md](docs/decisions.md): dated decision log

## Team

- Indy: team lead and business
- Nawra: product and research
- Rafee: tech lead and engineering
