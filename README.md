# beli-cli

Personal CLI for Beli restaurant functionality. Gives agents and humans access to core Beli features via the terminal.

## Status

**Phase 0** — Foundation and type contracts only. No commands or API calls yet.

## Prerequisites

- [Bun](https://bun.sh) >= 1.3

## Setup

```sh
bun install
```

## Development

```sh
bun run dev         # Run the CLI
bun test            # Run tests
bun run typecheck   # Type-check without emitting
bun run check       # Lint and format check (Biome)
bun run check:fix   # Auto-fix lint and format issues
```

## Architecture

Three-layer architecture with strict dependency direction (imports flow inward only):

```
src/cli          Commands, flags, prompts, human/JSON rendering
    |
src/core         Normalized entities, use cases, pagination, errors
    ^
src/adapters     Auth, transport, retries, rate limiting, response mapping
```

- **Core** owns the domain model and business logic. No external dependencies.
- **Adapters** implement the `BeliAdapter` interface to connect core to upstream APIs.
- **CLI** wires everything together and handles user interaction.

See [docs/architecture.md](docs/architecture.md) for details.

## Next Steps

- Phase 1: CLI shell with root command, global flags, formatters
- Phase 2: Authentication and session management
- Phase 3: Read-only core functionality (search, lists, activity, social)
- Phase 4: Write operations (lists, ratings, reviews)
