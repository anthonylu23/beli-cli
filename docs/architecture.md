# Architecture

## Layers

```
┌─────────────────────────────────┐
│           src/cli               │  Commands, flags, prompts, rendering
│    (depends on core only)       │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│           src/core              │  Entities, use cases, errors, pagination
│      (no external imports)      │
└──────────────▲──────────────────┘
               │
┌──────────────┴──────────────────┐
│  src/adapters/private-mobile    │  Auth, transport, retries, response mapping
│  (implements BeliAdapter)       │
└─────────────────────────────────┘
```

**Dependency rule:** imports flow inward only. CLI can import core. Adapters import core types and implement the `BeliAdapter` contract. Core imports nothing outside itself.

## Path Aliases

| Alias | Maps to |
|---|---|
| `@core/*` | `src/core/*` |
| `@adapters/*` | `src/adapters/*` |
| `@cli/*` | `src/cli/*` |

## Entity Model

Domain entities are the **normalized** representation, not the upstream wire format. The adapter is responsible for mapping API responses into these types.

All entity properties are `readonly`. Nullable fields use `| null` rather than optional `?:`.

### Entities

- **User** — profile, stats, social counts
- **Restaurant** — name, location, cuisines, price level, tags
- **Rating** — user's score for a restaurant (Elo-derived), sentiment, rank
- **Review** — text review with optional images, linked to a rating
- **Visit** — timestamped visit record with companions
- **List** — named collection of restaurants with visibility control
- **FeedItem** — social activity event (rating, review, visit, list change)

## ID Strategy

All IDs are **branded opaque strings** using `EntityId<T>`. Each entity has its own ID flavor (e.g., `UserId = EntityId<"User">`), preventing accidental cross-entity ID assignment at the type level with zero runtime cost.

## Conventions

| Concern | Convention |
|---|---|
| Timestamps | ISO 8601 UTC, branded as `Timestamp` |
| Pagination | `{ items: T[], nextCursor: string \| null }` |
| Errors | Class hierarchy extending `BeliError`, each with an `ExitCode` |
| Exit codes | `0` success, `2` validation, `3` auth required, `4` upstream failure, `5` unsupported |

## Runtime Boundaries

- Core logic uses standard web APIs only (no Bun-specific imports).
- Bun-specific usage is limited to packaging, dev tooling, and the CLI entrypoint shebang.
- No MCP server in v1.

## Tooling

- **TypeScript** with strict mode + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`
- **Biome** for linting and formatting (tabs, 100-char line width)
- **Bun** test runner for tests (collocated `*.test.ts` files)
