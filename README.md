# beli-cli

Personal CLI for Beli restaurant functionality. Gives agents and humans access to core Beli features via the terminal.

## Status

**Phase 5 Live MVP Scaffold** — Read-only commands plus list, rating, and review mutation commands are implemented against a fixture-backed stub adapter by default. An experimental live private-mobile adapter is available behind `BELI_ADAPTER=live` for the first MVP read/list-write flow once sanitized endpoint captures are available.

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
bun run smoke:live                 # Env-gated live adapter smoke flow
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

## Experimental Live Adapter

The CLI still defaults to the fixture-backed stub adapter. To opt in to network calls, set:

```sh
BELI_ADAPTER=live
BELI_API_BASE_URL=https://captured-api-host.example
```

`BELI_API_BASE_URL` is required until sanitized production endpoint notes are checked in. Live mode currently implements only the MVP surfaces: session validation, `me`, restaurant search, list listing/get/create/delete, and list entry add/remove. Other live methods fail with the existing unsupported-feature exit path.

The live smoke flow is explicitly gated:

```sh
BELI_ADAPTER=live \
BELI_API_BASE_URL=https://captured-api-host.example \
BELI_LIVE_SMOKE=1 \
BELI_SMOKE_RESTAURANT_QUERY="known safe restaurant query" \
bun run smoke:live
```

The smoke script creates a private test list, adds the first matching restaurant, verifies readback, removes the entry, and deletes the list it created.

## Read Commands

All read commands require authentication (`beli auth bootstrap` first). All support `--json` and `--fields` flags. Paginated commands support `--cursor` and `--limit`.

Human output is flattened for terminal readability. JSON output preserves normalized domain objects, including arrays, nested objects, numbers, and `null`, so agent and script consumers can rely on typed data.

```sh
# Profile
beli me profile                  # Show your profile
beli me stats                    # Show your stats
beli me stats --json             # Stats as JSON

# Restaurants
beli restaurants search pizza    # Search by name or cuisine
beli restaurants search pizza --limit 5  # Limit results
beli restaurants get rest_001    # Get restaurant details

# Lists
beli lists ls                    # List your restaurant lists
beli lists ls --limit 1          # Paginated with cursor hint
beli lists get list_001          # Get list details

# Activity
beli activity list               # Your recent activity
beli activity list --user user_002  # Another user's activity

# Social
beli social feed                 # Your social feed
beli social followers            # List your followers
beli social following            # List who you follow
```

## Write Commands

Write commands require authentication. Create/update commands accept flags or JSON via `--input -`; when both are provided, flags take precedence. The stub adapter stores mutations in memory for the current process only.

```sh
# Lists
beli lists create --name "Weekend Ideas"
beli lists create --name "Shared Spots" --description "For friends" --visibility public
beli --json --input - lists create < payload.json

beli lists update list_001 --name "NYC Pizza"
beli --input - lists update list_001 < payload.json

beli lists add-entry list_001 --restaurant rest_002 --notes "Try brunch"
beli --input - lists add-entry list_001 < entry.json
beli lists remove-entry list_001 --restaurant rest_002

beli lists delete list_001 --yes
beli --json lists delete list_001 --yes

# Ratings
beli ratings create --restaurant rest_001 --score 8.7
beli ratings create --restaurant rest_002 --score 8.9 --favorite-dishes "Morning bun" --tags brunch
beli --input - ratings create < rating.json
beli ratings update rate_001 --score 7.5 --tags "classic,reliable"
beli ratings delete rate_001 --yes

# Reviews
beli reviews create --restaurant rest_001 --body "Great slice" --rating rate_001
beli reviews create --restaurant rest_002 --body "Worth the wait" --image-urls "https://example.com/one.jpg"
beli --input - reviews create < review.json
beli reviews update rev_001 --body "Updated review"
beli reviews delete rev_001 --yes
```

Example JSON payloads:

```json
{ "name": "Weekend Ideas", "description": "Try soon", "visibility": "private" }
```

```json
{ "restaurantId": "rest_002", "notes": "Morning buns" }
```

```json
{ "restaurantId": "rest_001", "score": 8.7, "favoriteDishes": ["Pepperoni slice"], "tags": ["classic"] }
```

```json
{ "restaurantId": "rest_001", "ratingId": "rate_001", "body": "Great slice", "imageUrls": [] }
```

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

- Add sanitized captured endpoint notes for the real Beli private mobile host and path mapping
- Expand the live adapter beyond the MVP list flow after mapper fixtures are verified
- Run env-gated live smoke against a dedicated personal test account
