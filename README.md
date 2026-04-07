# beli-cli

Personal CLI for Beli restaurant functionality. Gives agents and humans access to core Beli features via the terminal.

## Status

**Phase 1** — CLI shell implemented. Commander.js-based command parsing with global flags, output formatters, and execution wrapper. No API calls yet.

## Prerequisites

- [Bun](https://bun.sh) >= 1.3

## Setup

```sh
bun install
```

## Development

```sh
bun run dev                        # Run the CLI (shows help)
bun run dev -- --version           # Print version
bun run dev -- --json              # Enable JSON output mode
bun run dev -- --experimental raw foo  # Experimental raw resource access
bun run dev -- --json --experimental raw foo  # Raw placeholder output as JSON
bun test                           # Run tests
bun run test:coverage              # Run tests with Bun coverage reporting
bun run typecheck                  # Type-check without emitting
bun run check                      # Lint and format check (Biome)
bun run check:fix                  # Auto-fix lint and format issues
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

## Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Output JSON instead of human-readable text |
| `--fields <a,b,c>` | Comma-separated list of fields to include in output |
| `--no-color` | Disable colored output (also respects `NO_COLOR` env) |
| `--yes` | Skip confirmation prompts |
| `--profile <name>` | Config profile to use (default: `default`) |
| `--experimental` | Enable experimental features |
| `--input <source>` | Carry an input source through command context (use `-` for stdin) |

## Next Steps

- Phase 2: Authentication and session management (`beli auth bootstrap|status|logout`)
- Phase 3: Read-only core functionality (search, lists, activity, social)
- Phase 4: Write operations (lists, ratings, reviews)
