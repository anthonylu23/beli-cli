# beli-cli

Personal CLI for Beli restaurant functionality. Gives agents and humans access to core Beli features via the terminal.

## Status

**Phase 2 In Progress** — Authentication and session management is scaffolded. `beli auth bootstrap|status|logout`, keychain-backed session storage, and config file management are implemented. Live token validation is still stubbed until API endpoints are mapped.

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

Four-layer architecture with strict dependency direction (imports flow inward only):

```
src/cli          Commands, flags, prompts, human/JSON rendering
    |
src/core         Normalized entities, use cases, pagination, errors
 ^      ^
 |      |
src/infra        Keychain and config persistence
src/adapters     Auth validation, transport, response mapping
```

- **Core** owns the domain model and business logic. No external dependencies.
- **Infra** owns platform-specific persistence concerns such as keychain and config file access.
- **Adapters** implement the `BeliAdapter` interface and Phase 2 token validation stubs.
- **CLI** wires everything together and handles user interaction.

See [docs/architecture.md](docs/architecture.md) for details.

## Authentication

```sh
beli auth bootstrap          # Import session tokens from Beli mobile app
beli auth status             # Show current session status
beli auth status --json      # Session status as JSON
beli auth logout             # Remove stored session
beli auth logout --yes       # Skip confirmation prompt
```

Session secrets are stored in macOS Keychain. Non-secret config lives in `~/.config/beli-cli/config.json`.
When bootstrapping without a known Beli user ID, the session is stored with an unknown identity until live validation or a later command can resolve it.

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

- Phase 3: Read-only core functionality (search, lists, activity, social)
- Phase 4: Write operations (lists, ratings, reviews)
