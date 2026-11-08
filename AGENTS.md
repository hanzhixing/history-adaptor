# AGENTS.md

`history-adaptor` — a framework-agnostic adaptor that connects two routing systems
(HTML5 History, hash, React Router, Vue Router, Angular, Solid, or a custom router) via
user-defined mapping rules. The core imports no framework; both sides are peers
(symmetric, no master/slave).

## Commands

Use `pnpm` (lockfile `pnpm-lock.yaml`). Node >= 22 is required; `mise.toml` pins node 26.

- `pnpm test` — full Vitest suite (node environment; each test creates its own JSDOM window)
- `pnpm test test/core.test.ts` — run one file. Do **not** insert `--`: `pnpm test -- <file>`
  is swallowed and runs the whole suite.
- `pnpm test -t "name"` — filter by test name (same caveat: no `--`)
- `pnpm test:watch` — watch mode
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` / `pnpm lint:fix` — oxlint
- `pnpm format` / `pnpm format:check` — oxfmt (manual only; see below)
- `pnpm build` — tsdown → ESM + CJS + d.ts in `dist/` (gitignored); runs publint + attw

`pnpm check` runs `oxlint && tsc --noEmit && vitest run` and **intentionally excludes** a
format check (oxfmt's output does not match the hand-written style). Use oxfmt only to give
pasted third-party code an initial pass.

## Style

- 4-space indent, single quotes, no bracket spacing, sorted imports (oxfmt defaults, applied
  by hand).
- Comments are line comments (`//`). Do **not** use JSDoc `/** ... */` anywhere (src or tests).

## Layout

- `src/core.ts` — `connect()`, the peer-to-peer propagation logic.
- `src/helper.ts` — framework adapters (`fromBrowserNative`, `fromReactRouter`,
  `fromVueRouter`, `fromAngularRouter`, `fromSolidRouter`, `adaptHistory`,
  `createReactRouterNavigator`, `initialVueLocation`), the rule adaptor
  (`createAdapt`/`Rule`), and query↔search helpers (`getSearchFromQueryObject`,
  `getQueryObjectFromSearch`).
- `src/type.ts` — public types and the `HistoryLike` contract.
- `src/index.ts` — re-exports the types and `connect`.
- `test/adapters/*.ts` — thin builders wrapping real routers with the public helpers.
- `test/*.test.ts` — `core`, `helpers`, `matrix`, `create-adapt`, `angular`.

Public entrypoints are `history-adaptor` (`.`) and `history-adaptor/helper` (`./helper`);
nothing else is exported.

## Connect semantics

`connect(connections)` returns one `HistoryLike` per input, in the same order. Each side's
`push`/`replace` propagates through that side's `adaptors` to the matching `target` keys.
Every adaptor `target` must be one of the group's `key`s — enforced by a `const` generic at
compile time and validated at runtime.

Propagation calls the **raw** peer history (not the proxy), so a mapped push does not re-enter
the proxy and circular rules terminate. The POP listener only handles `POP`; `PUSH`/`REPLACE`
are propagated directly.

`go`/`back`/`forward` move every side in lockstep and mark them suppressed so the resulting
POPs do not echo back. Stale markers are cleared on the next `push`/`replace` or navigation, so
a no-op back at a stack boundary cannot swallow a later external POP.

Initial locations are snapshotted before any propagation. A side starting at a non-root
location seeds only the sides still at root; when both sides start non-root, neither is pushed
to (that would duplicate history entries).

## `HistoryLike` / `adaptHistory`

- `location` is a getter; `listen(listener)` returns an unsubscribe function; `dispose` is
  optional.
- `adaptHistory` synthesizes the action: its own `push`/`replace`/`go` are tagged accordingly,
  while any change the source reports on its own (a `<Link>` click, the browser Back button) is
  `POP`. It subscribes to the source on the first `listen()` call.
- `HistorySourceConfig.navigate` may return `void | Promise<unknown>`. `adaptHistory` resets the
  pending action when the navigation settles, even if the source never emitted (guard-cancelled
  or no-op), so a later external POP is not mislabelled. Return the promise from async
  navigations (`fromVueRouter`/`fromAngularRouter` do).
- Known limitation: concurrent navigations share a single pending action, so a queue of rapid
  pushes can briefly mislabel actions. Propagation is direct and unaffected.
- After `dispose()`, the returned history is a no-op for `push`/`replace`/`go`/`back`/`forward`/
  `listen`; helpers also remove their DOM/framework listeners.

## Rule adaptor

`createAdapt(rules)` (from `history-adaptor/helper`) builds an `Adapt`. Each rule's `from` is a
`path-to-regexp` pattern, an RFC 6570 URI template (contains `{`), or a `RegExp`.

- `RegExp` uses `String.prototype.replace` with `$<name>` groups (`g`/`y` flags are stripped).
- `path-to-regexp` matches the pathname and carries search/hash to the target.
- URI templates match the full address (path + query + fragment).
- Rules are evaluated in order; no match returns `undefined` (stop propagation).
- Caveat: any `{` is treated as a URI template, so path-to-regexp optional groups such as
  `/user{/:id}` do not work there — write `:param` or use a `RegExp`.

Tests: `test/create-adapt.test.ts`. Dependencies: `path-to-regexp` and `@fedify/uri-template`
(runtime deps); native `URL`/`URLSearchParams` handle query and address parsing.

## Framework helpers

- `fromBrowserNative({hash?, window?, base?})` — HTML5 by default, hash routing with
  `{hash: true}`. `pushState`/`replaceState` notify synchronously; traversals rely on
  `popstate` (HTML5) or `hashchange` (hash). Hash mode listens to **only** `hashchange`: a
  traversal fires both events, and listening to both double-notified and echoed an extra push.
- `fromReactRouter(router)` — React Router data router (`createMemoryRouter`); `go(n)` uses
  `router.navigate(number)`.
- `fromVueRouter(router, {base?})` — Vue Router; it starts at `/`, so seed it with
  `initialVueLocation()` after `connect`.
- `fromAngularRouter(router, location, {base?})` — `go(n)` supports only `-1` / `1` (throws
  otherwise).
- `fromSolidRouter(history, {base?})` — Solid Router memory history; it does not store `state`.
- `createReactRouterNavigator(history, {base?})` — navigator for React Router's low-level
  `<Router>` (Declarative Mode).

## Constraints / gotchas

- Keep `src/core.ts` and `src/type.ts` framework-free. `src/helper.ts` may import
  `path-to-regexp`/`@fedify/uri-template` (runtime deps) but no React/Vue/router packages.
- A POP originating outside the adaptor (e.g. the browser's native Back button) is propagated
  to the other sides as a `push`, so peer stacks can drift; only `back()`/`forward()`/`go()`
  through the adaptor stay symmetric.
- Address strings are parsed as paths; there is no hardcoded base. Pass `options.base` to
  helpers when a `to` may be relative or a full URL.
- Tests import `src/` directly (no build needed), construct real routers, and assert against
  real router state. Navigation is async, so use the per-file `flush(ms)` helper and keep tests
  async.
- Each test creates its own JSDOM window and must close it (and dispose routers) in `finally`.
  `test/matrix.test.ts` and `test/angular.test.ts` run under jsdom (`@vitest-environment jsdom`);
  the rest use the node environment. `test/matrix.test.ts` deliberately excludes `html5 <-> hash`
  because both own the address bar.
- `test/angular.test.ts` uses the real Angular `TestBed` (heavier than the other suites).
  `vitest.config.ts` forces the `browser` condition and inlines Solid for `test/matrix.test.ts`.
- `fromBrowserNative()` throws without a browser; tests pass an injected JSDOM `window`.
- Interactive examples are a **separate repository** at `../history-adaptor-example` (depends on
  this library via `file:../history-adaptor`). They are not part of this repo; build the library
  first so its `dist/` exists.
