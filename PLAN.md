# Beli CLI v1 Plan

## Summary

Build a Bun-first TypeScript CLI for local personal use that gives agents and humans access to core Beli functionality. The CLI should default to readable terminal output and support stable `--json` output for automation. The architecture should separate CLI UX, normalized domain logic, and the private Beli adapter so the tool can expand over time without tying the whole codebase to upstream wire formats.

This plan assumes there is no public Beli API and that any usable integration will come from an authenticated app-equivalent private client. Because Beli's published terms restrict scraping, reverse engineering, and credential sharing, implementation should stay local, single-user, and cautious about write operations.

## Current Status

- Phase 0 is complete.
- Phase 1 is complete and merged to `main`.
- Phase 2 is complete for local stub-backed authentication/session management.
- Phase 3 is complete for fixture-backed read-only commands.
- Phase 4 is complete for fixture-backed write commands.
- Phase 5 is active for verification, hardening, packaging, and the real private mobile adapter.

Completed work now in the repo:

- Bun-first TypeScript project scaffold with `src/cli`, `src/core`, and `src/adapters/private-mobile`.
- Baseline tooling: TypeScript config, Bun scripts, Biome, test harness, and coverage reporting via `bun run test:coverage`.
- Core entity/types foundation and stable exit-code contract.
- Root `beli` CLI, global flags, shared formatter layer, and command execution wrapper.
- Experimental `beli raw <resource>` placeholder command with stable human and JSON output.
- Shared `RunContext` now carries `--input <source>` through command execution.
- Phase 1 test coverage includes unit tests, in-process command tests, and end-to-end subprocess tests for stdout, stderr, flag handling, and exit codes.
- Phase 2 scaffolding includes auth commands, session/config models, keychain/config persistence, and isolated auth/keychain tests.
- Phase 3 read commands are wired against a session-aware fixture adapter with strict pagination/location validation and normalized JSON output.
- Phase 4 write commands cover list, rating, and review mutations against the fixture-backed stub adapter, with JSON input support and readback-friendly normalized output.

## Phase 0: Foundation And Guardrails

- Status: complete.
- Completed: scaffold a Bun-first TypeScript project with `src/cli`, `src/core`, and `src/adapters/private-mobile`.
- Completed: add baseline tooling: TypeScript config, Bun scripts, lint/format setup, test harness, `.gitignore`, and coverage reporting.
- Completed: define the main architectural contract:
  - `src/core` owns normalized entities, use cases, pagination, errors, and output-independent behavior.
  - `src/adapters/private-mobile` owns auth, transport, retries, rate limiting, and upstream response mapping.
  - `src/cli` owns commands, flags, prompts, and human/JSON rendering.
- Completed: define stable normalized entities: `User`, `Restaurant`, `List`, `Rating`, `Review`, `Visit`, and `FeedItem`.
- Completed: standardize cross-cutting behavior:
  - IDs remain opaque strings.
  - Timestamps normalize to ISO 8601 UTC.
  - Paginated results use `{ items, nextCursor }`.
  - Exit codes use `0` success, `2` validation error, `3` auth required/expired, `4` upstream failure, `5` unsupported feature.
- Completed: add clear runtime boundaries:
  - Prefer standard web APIs in core logic.
  - Keep Bun-specific usage limited to packaging and developer workflow.
  - Do not add MCP in v1.

## Phase 1: CLI Shell And Shared UX

- Status: complete.
- Completed: implement the root `beli` command and global flags:
  - `--json`
  - `--fields`
  - `--no-color`
  - `--yes`
  - `--profile`
  - `--input <source>`
- Completed: build a consistent command execution model:
  - Human output goes to formatted stdout by default.
  - JSON mode emits JSON only on stdout.
  - Diagnostics and errors go to stderr.
- Completed: add shared formatters for tables, detail views, and structured error output.
- Completed: add `readStdinJson()` for upcoming write commands so agents can pipe structured input directly.
- Completed: add `beli raw <resource>` behind `--experimental` as a low-level debugging escape hatch.
- Completed: refactor CLI construction behind `createProgram()` so command registration is directly testable.
- Completed: make placeholder command output honor `--json` and `--fields`.
- Completed: propagate `--input <source>` through `RunContext` for upcoming write flows.
- Completed: add Phase 1 verification coverage for help output, error routing, exit codes, flag parsing, structured stdout, and JSON behavior.

## Phase 2: Authentication And Session Management

- Status: complete for local stub-backed development.

- Completed: implement `beli auth bootstrap|status|logout`.
- Completed: design `bootstrap` as a guided one-time local mobile-assisted session import flow.
- Completed: stub token validation until live endpoints are configured.
- Completed: store session artifacts securely in macOS Keychain.
- Completed: store non-secret config in `~/.config/beli-cli/config.json`.
- Completed: avoid storing raw passwords by default.
- Completed for read commands: handle auth expiry consistently through adapter session validation:
  - Detect expired or invalid sessions.
  - Return exit code `3`.
  - Print a clear re-auth path for both humans and agents.

## Phase 3: Read-Only Core Functionality

- Status: complete against fixture-backed stub data.
- Completed: implement read flows first to reduce risk while the adapter stabilizes.
- Completed: ship these command groups:
  - `beli me profile|stats`
  - `beli restaurants search|get`
  - `beli lists ls|get`
  - `beli activity list`
  - `beli social feed|followers|following`
- Completed: normalize upstream responses into stable domain objects before rendering.
- Completed: support pagination and filtering in a way that remains stable in JSON mode even if upstream formats drift.
- Completed: emit normalized domain-shaped JSON while preserving flattened human table output.
- Completed: add fixture-backed contract coverage for each supported read surface.

## Phase 4: Write Functionality

- Status: complete against fixture-backed stub data.
- Completed: add core write operations:
  - `beli lists create|update|delete|add-entry|remove-entry`
  - `beli ratings create|update|delete`
  - `beli reviews create|update|delete`
- Completed: validate write inputs from flags and `--input -` JSON before adapter calls.
- Completed: make command flags take precedence over JSON payload fields.
- Completed: return normalized entities after create/update/list-entry writes so agents can verify resulting state.
- Completed: keep write mutations adapter-local and in-memory until the private mobile HTTP adapter is safe to enable.

## Phase 5: Verification, Hardening, And Release

- Status: active.
- Completed for Phases 1-4:
  - command parsing
  - formatter behavior
  - error routing and exit codes
  - subprocess-level CLI behavior
  - write input validation
  - fixture-backed session storage tests
- Active hardening:
  - fail closed on malformed config files instead of overwriting them with defaults
  - avoid split-state session saves by sequencing metadata and keychain writes with rollback
  - align package and CLI versions through a shared version source
- Remaining for the real adapter:
  - mapper correctness
- Add contract tests using sanitized recorded fixtures for:
  - empty states
  - pagination
  - auth expiry
  - upstream schema drift
- Add env-gated integration smoke tests against a dedicated personal test account for:
  - `auth status`
  - one representative read flow
  - one write followed by readback
- Verify acceptance scenarios:
  - a human can authenticate, search for a restaurant, add it to a list, rate it, and read it back
  - an agent can call supported commands with `--json` and get deterministic stdout plus reliable exit codes
  - expired sessions fail cleanly without leaking secrets
- Package the CLI for local installation and document Bun-based development and execution workflows.
- Build the real private mobile HTTP adapter behind the existing `BeliAdapter` contract, starting with read-only endpoints and enabling writes only after mapped request/response behavior is verified.

## Deferred For Later

- MCP server integration
- guides and subscriptions
- notifications
- referrals and growth mechanics
- admin or support-only surfaces
- any HTML scraping-based functionality
- hosted or multi-user workflows

## Assumptions

- v1 is Bun-first, macOS-only, local-only, and single-user.
- The tool is intended for the account owner’s personal use, not as a hosted service or shared team product.
- The implementation should avoid features that require credential sharing or unsupported web scraping.
- If the private mobile API cannot support safe authenticated writes, narrow the implementation to read-only flows until there is a better-approved integration path.
