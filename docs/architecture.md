# Architecture

## Layers

```
┌─────────────────────────────────┐
│           src/cli               │  Commands, flags, prompts, rendering
│ (depends on core + infra +      │
│  adapter validation shims)      │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│           src/core              │  Entities, use cases, errors, pagination
│      (no external imports)      │
└──────────────▲──────────────────┘
          ┌────┴────┐
┌─────────┴───┐  ┌──┴──────────────────┐
│  src/infra  │  │  src/adapters/...   │
│  Keychain,  │  │  BeliAdapter impl,  │
│  config     │  │  transport, mapping │
└─────────────┘  └─────────────────────┘
```

**Dependency rule:** imports flow inward only. CLI can import core, infra, and temporary adapter validation shims. Infra and adapters import core types only. Core imports nothing outside itself.

## Path Aliases

| Alias | Maps to |
|---|---|
| `@core/*` | `src/core/*` |
| `@adapters/*` | `src/adapters/*` |
| `@cli/*` | `src/cli/*` |
| `@infra/*` | `src/infra/*` |

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

## CLI Layer (Phase 1)

The CLI layer uses **Commander.js** for argument parsing and subcommand registration.

### Key modules

| File | Purpose |
|---|---|
| `src/cli/index.ts` | `createProgram()`, root command wiring, and CLI entrypoint |
| `src/cli/context.ts` | `RunContext` type — resolved global flags passed to all commands |
| `src/cli/flags.ts` | Global flag definitions, `resolveContext()` parser |
| `src/cli/output.ts` | Formatters: `printTable`, `printPaginatedTable`, `printDetail`, `printJson`, `printError` |
| `src/cli/run.ts` | `runCommand()` — error→exit-code wrapper for command handlers |
| `src/cli/stdin.ts` | `readStdinJson()` — stdin JSON ingestion for `--input -` |
| `src/cli/pagination.ts` | `addPaginationOptions()`, `extractPagination()` — `--cursor`/`--limit` |
| `src/cli/columns.ts` | Table column definitions per entity type |
| `src/cli/presenters.ts` | Entity → flat record flatteners + `mapPaginated()` |
| `src/cli/session.ts` | `requireSession()` — load session or throw `AuthRequiredError` |
| `src/cli/commands/auth.ts` | `beli auth bootstrap\|status\|logout` — session management |
| `src/cli/commands/me.ts` | `beli me profile\|stats` |
| `src/cli/commands/restaurants.ts` | `beli restaurants search\|get` |
| `src/cli/commands/lists.ts` | `beli lists ls\|get\|create\|update\|delete\|add-entry\|remove-entry` |
| `src/cli/commands/ratings.ts` | `beli ratings create\|update\|delete` |
| `src/cli/commands/reviews.ts` | `beli reviews create\|update\|delete` |
| `src/cli/commands/activity.ts` | `beli activity list` |
| `src/cli/commands/social.ts` | `beli social feed\|followers\|following` |
| `src/cli/commands/raw.ts` | `beli raw <resource>` — experimental low-level access |

### Execution model

1. Commander parses arguments and dispatches to a command handler.
2. The handler calls `resolveContext()` to build a `RunContext` from global flags, including `input` propagation.
3. The handler calls `runCommand(ctx, fn)` which:
   - Runs `fn(ctx)` — the command logic.
   - On success, exits with `0`.
   - On `BeliError`, prints to stderr and exits with the error's exit code.
   - On unknown error, prints to stderr and exits with `1`.
4. Output functions (`printTable`, `printDetail`) respect `--json` and `--fields` to support both human and agent consumers.
   Human output uses flattened presenter rows; JSON output for read commands uses normalized domain objects so arrays, objects, numbers, and `null` remain typed.
5. Placeholder commands still emit structured payloads through the shared output layer so stdout shape stays stable for agents.

### Output routing

- **stdout**: data output (human-readable or JSON, never both).
- **stderr**: errors and diagnostics (always, in both modes).

## Infrastructure Layer (Phase 2)

The `src/infra/` layer handles platform-specific I/O for session persistence.

| File | Purpose |
|---|---|
| `src/infra/keychain.ts` | macOS Keychain read/write via `security` CLI (`Bun.spawn`) |
| `src/infra/config.ts` | `~/.config/beli-cli/config.json` management (atomic writes) |
| `src/infra/session-store.ts` | Composite `SessionStore` combining keychain (secrets) + config (metadata) |

### Session model

- **`SessionCredentials`** (keychain): `authToken`, `refreshToken`, `userId | null`
- **`SessionMetadata`** (config file): `profile`, `userId | null`, `username`, `displayName`, `bootstrappedAt`, `lastValidatedAt`
- **`Session`**: combines both
- **`SessionStore`** interface: `load`, `save`, `delete`, `exists` — core owns the contract, infra implements it
- User identity may be unknown immediately after bootstrap if the mobile token capture does not expose a stable user ID yet.

### Keychain storage

- Service: `"beli-cli"`, Account: profile name (e.g., `"default"`)
- Password field: JSON-serialized `SessionCredentials`
- Uses macOS `security` CLI (no native bindings)
- Writes use `security add-generic-password ... -w` with the secret provided on stdin so credentials are not passed via command-line arguments.

### Config file

Path: `~/.config/beli-cli/config.json`. Created on first write with `0600` permissions. Profiles keyed by name.

## Adapter Layer (Phases 3-4)

| File | Purpose |
|---|---|
| `src/adapters/private-mobile/contract.ts` | `BeliAdapter` interface — read methods plus Phase 4 mutations |
| `src/adapters/private-mobile/stub.ts` | `createStubAdapter()` — fixture-backed in-memory implementation with per-instance mutations |
| `src/adapters/private-mobile/fixtures.ts` | Typed fixture data for all entities |
| `src/adapters/private-mobile/validate.ts` | `validateToken()` — stubbed token validation |

### Stub adapter

`createStubAdapter()` returns a `BeliAdapter` backed by fixture data. All paginated methods use a shared `paginate()` helper that accepts a stringified index cursor and limit. Lookup methods throw `UpstreamError(404)` for unknown IDs.

Mutations copy fixture lists, ratings, and reviews into adapter-local mutable state, so write operations persist only for the current adapter instance. Fixture files are never modified. This enables full command testing and development without a real API endpoint.

### Read command pattern

Each command group follows the same DI pattern:
1. `register*Command(program, defaultAdapter, defaultSessionStore, deps?)` registers subcommands.
2. Each subcommand action calls `resolveContext()` → `runCommand()`.
3. Inside `runCommand`, the handler validates command-local options such as `--limit`, `--lat`, and `--lng` before auth checks.
4. The handler calls `requireSession()` for auth gating, creates the adapter with the loaded session, validates the adapter session, then calls adapter methods and output formatters.
5. `printPaginatedTable()` handles both human (table + cursor hint on stderr) and JSON (`{ items, nextCursor }`) modes.

Pagination cursors in the stub adapter are unsigned integer index strings. Malformed or out-of-range cursors raise `ValidationError` so command behavior matches the future live adapter contract.

### Write command pattern (Phase 4)

Write commands reuse the read-command DI pattern and add two command dependencies for tests: JSON input reading and delete confirmation. Create/update commands accept flags plus `--input -` JSON; command flags override JSON payload fields. Delete supports `--yes` to skip confirmation.

Successful create/update commands print the resulting normalized entity. List entry mutations print the resulting normalized `List`. Delete emits no stdout in human mode and `{ "deleted": true, "id": "..." }` in JSON mode. Validation errors use exit code `2`; auth failures use `3`; missing upstream resources use `4`.

Ratings derive sentiment from score in the stub adapter: `>= 7` positive, `>= 4` neutral, otherwise negative. Reviews may link to an existing rating through `ratingId`, and image URLs are treated as string data without network validation.

### Test strategy

- Auth command tests inject an in-memory `SessionStore` and stubbed validation/bootstrap dependencies so they do not touch the real keychain or user config.
- Read and write command tests use `test-helpers.ts` with shared `runProgram()`, `createMemorySessionStore()`, and `TEST_SESSION` fixtures.
- Stub adapter tests verify the contract: pagination, filtering, malformed cursors, not-found errors, list/rating/review mutations, duplicate list entries, sentiment derivation, and validation failures.
- Keychain tests use an injected security-command runner to verify argument shape and secret-handling behavior without invoking the real macOS keychain.

## Next Steps

- Build the real private mobile HTTP adapter and response mappers.
- Replace stub token validation with live session validation once authenticated endpoints are configured.

## Runtime Boundaries

- Core logic uses standard web APIs only (no Bun-specific imports).
- Bun-specific usage is limited to packaging, dev tooling, and the CLI entrypoint shebang.
- No MCP server in v1.

## Tooling

- **TypeScript** with strict mode + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`
- **Biome** for linting and formatting (tabs, 100-char line width)
- **Bun** test runner for tests (collocated `*.test.ts` files)
