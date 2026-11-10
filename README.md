# history-adaptor

[![MIT License](https://img.shields.io/npm/l/history-adaptor.svg)](https://github.com/hanzhixing/history-adaptor/blob/master/LICENSE)
[![npm version](https://img.shields.io/npm/v/history-adaptor.svg)](https://www.npmjs.com/package/history-adaptor)
[![npm download](https://img.shields.io/npm/dt/history-adaptor.svg)](https://www.npmjs.com/package/history-adaptor)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/history-adaptor.svg)](https://www.npmjs.com/package/history-adaptor)
[![codecov](https://codecov.io/gh/hanzhixing/history-adaptor/branch/master/graph/badge.svg)](https://codecov.io/gh/hanzhixing/history-adaptor)

A framework-agnostic adaptor that connects two routing systems with custom mapping rules.

Any two of HTML5 History, hash history, React Router, Vue Router, Angular, Solid, or your own
router can be the two sides of the adaptor. The core imports no framework: both sides are
equal (peer to peer, no master/slave). Optional helpers turn the common routers into the
library's minimal `HistoryLike` protocol for you.

To use this library you should know

1. What a frontend router is.
2. How navigation / routing works in the framework(s) you use.
   (No longer tied to the `history` package.)

## Why

1. There are multiple sets of URIs in the real world.
2. You may not able to decide what your URIs in a set should look like.
3. URIs are shared resources among clients. (Considering browser Bookmarks or programs ships your URIs in their code)
4. URIs are references to different app views.
5. The structure of an application could more or less decide what your URIs look like.
6. URIs those reflect app structure are not always able to affect your browser address bar.
7. The structure of an application may change frequently, which may cause routes change as well.
8. We may integrate with multiple sub applications, and the routes of them may have already been hardcoded.
9. Do you want to keep the paths in the routes always clean?

## Solution

Separate different sets of URIs and connect them with others loosely, by following the desired rules.

## Features

- **Framework-agnostic core.** The core imports no framework; both sides are equal peers.
- **Optional helpers** in `history-adaptor/helper` for React Router, Vue Router, Angular,
  Solid and the browser (HTML5 + hash).
- **Rule adaptor** (`createAdapt`) for declarative `from -> to` mapping with literal,
  `:param`, `RegExp`, and RFC 6570 URI-template rules.
- **`state` is passed through.** `push(path, state)` carries `state` to the target unchanged.
- **`listen()` returns an unsubscribe function.**

## Installation

```bash
npm install --save history-adaptor
```

The helpers are structural and import no framework themselves, so install only the router
packages you actually use (e.g. `react-router`, `vue-router`).

## How to use

### 1. define the mapping (adaptors)

An adaptor maps one side's address to the other's. An `Adapt` is a function
`(location) => To | undefined`; returning `undefined` stops propagation to that side.
There are two ways to write one:

```javascript
import {createAdapt} from 'history-adaptor/helper';

// (a) declarative rule table (covers most cases)
const portalToBlog = createAdapt([
    {from: '/webapp/main/blog', to: '/main'},
    {from: '/webapp/main/blog/post/:id', to: '/post/:id'},
]);

// (b) custom function for logic the rule table cannot express
const blogToPortal = (location) => {
    const pathname = typeof location === 'string' ? location : location.pathname;
    if (pathname === '/main') return '/webapp/main/blog';
    return undefined;
};
```

### 2. connect the histories with your adaptors

```javascript
// Both sides are equal. The order remains the same.
// I believe you don't want to connect two histories that manipulate the same thing
// (two browser histories, or a browser history and a hash history). You can, but you should not.
// `reactRouter` below is a React Router data router, e.g. the result of `createMemoryRouter(routes)`.
import {connect} from 'history-adaptor';
import {fromBrowserNative, fromReactRouter} from 'history-adaptor/helper';

const [portalHistory, blogHistory] = connect([
    {
        key: 'Portal',
        history: fromBrowserNative(),          // the real address bar (HTML5)
        adaptors: [{target: 'Blog', adapt: portalToBlog}],
    },
    {
        key: 'Blog',
        history: fromReactRouter(reactRouter), // a React Router data router
        adaptors: [{target: 'Portal', adapt: blogToPortal}],
    },
]);
```

### 3. use the histories like you did it before

```javascript
portalHistory.push(...);
portalHistory.replace(...);
portalHistory.go(n);
portalHistory.back();
portalHistory.forward();
portalHistory.listen(...);   // returns an unsubscribe function
```

## Helpers (`history-adaptor/helper`)

| Helper | Description |
|--------|-------------|
| `adaptHistory(config)` | Turn any custom router-like source into a `HistoryLike`. |
| `fromBrowserNative(options?)` | The browser address bar. `{hash: true}` for hash mode. |
| `fromReactRouter(router)` | React Router data router (`createMemoryRouter`). |
| `fromVueRouter(router, options?)` | Vue Router. |
| `fromAngularRouter(router, location, options?)` | Angular's `Router` + `Location`. `go(n)` supports only `-1` / `1`. |
| `fromSolidRouter(history, options?)` | Solid Router memory history (`createMemoryHistory()`), for `<MemoryRouter history={...}>`. |
| `createReactRouterNavigator(history, options?)` | `HistoryLike` → React Router's low-level `<Router>` navigator. |
| `initialVueLocation(location, options?)` | Address string to seed a Vue Router with. |
| `createAdapt(rules)` | Build an `Adapt` from literal, `:param`, `RegExp`, or RFC 6570 URI-template rules. |

Address strings are treated as **paths** by default. Pass `options.base` when a `to` value may
be a relative path or a full URL; it is handed to `new URL(address, base)`.

### Rule adaptor

`createAdapt(rules)` turns a declarative rule table into an `Adapt`. Rules are evaluated
in order and the first match wins; when nothing matches, the adaptor returns `undefined`, which
stops propagation for that side. `from` accepts four shapes:

Note: any `{` makes `from` an RFC 6570 URI template, so a path-to-regexp optional group such
as `/user{/:id}` is not supported here — write it as `:param` or use a `RegExp` instead.

```javascript
import {connect} from 'history-adaptor';
import {createAdapt, fromBrowserNative, fromReactRouter} from 'history-adaptor/helper';

// Outer portal address -> nested address
const rulesFromOuterToNested = [
    // literal replacement
    {from: '/portal/home', to: '/news'},
    {from: '/portal/error/not_found', to: '/404'},

    // path-to-regexp (>= 8.4.0): pass :param through
    {from: '/portal/discussion/:discussion_id', to: '/discussion/:discussion_id'},
    {from: '/portal/user/:user_id', to: '/user/:user_id'},

    // native RegExp + String.prototype.replace: query becomes path, $<name> groups
    {
        from: /^\/portal\/articles\?user_id=(?<user_id>[^&#]*)&category_id=(?<category_id>[^&#]*)&keyword=(?<keyword>[^&#]*)#(?<comments>[^#]*)$/,
        to: '/user/$<user_id>/post?category=$<category_id>&keyword=$<keyword>#$<comments>',
    },

    // RFC 6570 URI template: pathname + query + fragment
    {from: '/portal/friend{?user_id,group}{#hash}', to: '/user/{user_id}/friend{?group}{#hash}'},
];

// Nested address -> outer portal address
const rulesFromNestedToOuter = [
    {from: '/news', to: '/portal/home'},
    {from: '/discussion/:discussion_id', to: '/portal/discussion/:discussion_id'},
    {from: '/user/:user_id', to: '/portal/user/:user_id'},
    {
        from: /^\/user\/(?<user_id>[^/?#]+)\/post\?category=(?<category_id>[^&#]*)&keyword=(?<keyword>[^&#]*)#(?<comments>[^#]*)$/,
        to: '/portal/articles?user_id=$<user_id>&category_id=$<category_id>&keyword=$<keyword>#$<comments>',
    },
    {from: '/user/{user_id}/friend{?group}{#hash}', to: '/portal/friend{?user_id,group}{#hash}'},
];

const [portalHistory, nestedHistory] = connect([
    {
        key: 'Portal',
        history: fromBrowserNative(),          // the real address bar (HTML5)
        adaptors: [{target: 'Nested', adapt: createAdapt(rulesFromOuterToNested)}],
    },
    {
        key: 'Nested',
        history: fromReactRouter(nestedRouter), // e.g. createMemoryRouter(routes)
        adaptors: [{target: 'Portal', adapt: createAdapt(rulesFromNestedToOuter)}],
    },
]);
```

Dependency choice (weekly npm downloads, 2026-11-03..09): `path-to-regexp` ~315M (Express's
matcher); `url-template` ~24M but expansion only; `@fedify/uri-template` ~14k but it is the
focused implementation with both `match` and `expand` plus round-trip verification;
`uri-template-router` ~5k. We use `path-to-regexp` for path patterns and
`@fedify/uri-template` for RFC 6570. Query and address parsing use the native
`URL`/`URLSearchParams`.

The `HistoryLike` contract itself:

```typescript
type HistoryLike = {
    readonly location: { pathname: string; search: string; hash: string; state?: unknown };
    listen(listener: (location: Location, action: 'PUSH' | 'REPLACE' | 'POP') => void): () => void;
    push(to, state?): void;
    replace(to, state?): void;
    go(delta: number): void;
    back(): void;
    forward(): void;
    dispose?(): void;
};
```

## Framework examples

Interactive examples live in a separate project: [`history-adaptor-example`](https://github.com/hanzhixing/history-adaptor-example).

### React Router — Data Mode

```tsx
import {createMemoryRouter, RouterProvider} from 'react-router';
import {connect} from 'history-adaptor';
import {createAdapt, fromBrowserNative, fromReactRouter} from 'history-adaptor/helper';

const router = createMemoryRouter([{path: '*', element: <App />}], {initialEntries: ['/main']});

const reactToPortal = createAdapt([{from: '/main', to: '/webapp/main/react'}]);
const portalToReact = createAdapt([{from: '/webapp/main/react', to: '/main'}]);

const [react, portal] = connect([
    {key: 'React', history: fromReactRouter(router), adaptors: [{target: 'Portal', adapt: reactToPortal}]},
    {key: 'Portal', history: fromBrowserNative(), adaptors: [{target: 'React', adapt: portalToReact}]},
]);

root.render(<RouterProvider router={router} />);
```

### React Router — Declarative Mode

```tsx
import {useSyncExternalStore} from 'react';
import {Router, Routes, Route, Link} from 'react-router';
import {connect} from 'history-adaptor';
import {createReactRouterNavigator} from 'history-adaptor/helper';

const [react] = connect([
    {key: 'React', history: /* a HistoryLike */, adaptors: [...]},
    {key: 'Portal', history: fromBrowserNative(), adaptors: [...]},
]);

const Root = () => {
    const location = useSyncExternalStore(
        (cb) => react.listen(() => cb()),
        () => react.location,
    );
    return (
        <Router location={location} navigator={createReactRouterNavigator(react)}>
            <nav><Link to="/news">News</Link></nav>
            <Routes><Route path="/news" element={<News />} /></Routes>
        </Router>
    );
};
```

### Vue Router

```ts
import {createMemoryHistory, createRouter} from 'vue-router';
import {connect} from 'history-adaptor';
import {createAdapt, fromBrowserNative, fromVueRouter, initialVueLocation} from 'history-adaptor/helper';

const router = createRouter({history: createMemoryHistory(), routes});

const vueToPortal = createAdapt([{from: '/main', to: '/webapp/main/vue'}]);
const portalToVue = createAdapt([{from: '/webapp/main/vue', to: '/main'}]);

const [vue, portal] = connect([
    {key: 'Vue', history: fromVueRouter(router), adaptors: [{target: 'Portal', adapt: vueToPortal}]},
    {key: 'Portal', history: fromBrowserNative(), adaptors: [{target: 'Vue', adapt: portalToVue}]},
]);

// Optional: seed Vue Router (it starts at "/") with the current shared address.
await router.replace(initialVueLocation(/* shared location */));
```

### Angular (2+)

```ts
import {inject} from '@angular/core';
import {Location} from '@angular/common';
import {Router} from '@angular/router';
import {connect} from 'history-adaptor';
import {createAdapt, fromAngularRouter, fromBrowserNative} from 'history-adaptor/helper';

// `inject()` must run in an injection context (constructor / field initializer).
const router = inject(Router);
const location = inject(Location);

const angularToPortal = createAdapt([{from: '/main', to: '/webapp/main/angular'}]);
const portalToAngular = createAdapt([{from: '/webapp/main/angular', to: '/main'}]);

const [angular, portal] = connect([
    {key: 'Angular', history: fromAngularRouter(router, location), adaptors: [{target: 'Portal', adapt: angularToPortal}]},
    {key: 'Portal', history: fromBrowserNative(), adaptors: [{target: 'Angular', adapt: portalToAngular}]},
]);
```

`fromAngularRouter` only mirrors `go(-1)` / `go(1)` (Angular's `Location.back()` /
`forward()`); any other delta throws.

### Solid Router

```ts
import {createMemoryHistory, MemoryRouter} from '@solidjs/router';
import {connect} from 'history-adaptor';
import {createAdapt, fromBrowserNative, fromSolidRouter} from 'history-adaptor/helper';

const history = createMemoryHistory();

const solidToPortal = createAdapt([{from: '/main', to: '/webapp/main/solid'}]);
const portalToSolid = createAdapt([{from: '/webapp/main/solid', to: '/main'}]);

const [solid, portal] = connect([
    {key: 'Solid', history: fromSolidRouter(history), adaptors: [{target: 'Portal', adapt: solidToPortal}]},
    {key: 'Portal', history: fromBrowserNative(), adaptors: [{target: 'Solid', adapt: portalToSolid}]},
]);

// Render with the same history: <MemoryRouter history={history}>...</MemoryRouter>
```

Solid's memory history does not store `state`, so state is not preserved on the Solid side.

### Browser — HTML5 History

```ts
history: fromBrowserNative()
```

### Browser — hash

```ts
history: fromBrowserNative({hash: true})
```

### Custom router

```ts
history: adaptHistory({
    getLocation: () => myLocation,
    navigate: (to, {replace, state}) => myNavigate(to, replace, state),
    subscribe: (listener) => mySubscribe(listener),
    go: (delta) => myGo(delta),
})
```

If `navigate` settles asynchronously, return its promise (`return myNavigate(...)`) so
`adaptHistory` can label the resulting change correctly.

## Peer to peer

Both sides are equal and symmetric: there is no "authoritative" side. Each navigation is
propagated one level to the other histories through the mapping rules, so circular rules
(`A -> B -> A`) do not loop forever.

Because a browser history and a hash history both own the same address bar, connecting them
to each other is possible but meaningless in practice — pick at most one real address bar as
a side.

Known limitation: a back/forward that goes through the adaptor (`back()` / `forward()` /
`go()`) is mirrored on every side, keeping the stacks in step. A back/forward that originates
outside the adaptor — notably the browser's own Back/Forward buttons, which fire `popstate` —
is reported as a `POP` and propagated to the other sides as a `push`. The destination stays
correct, but the other sides gain a new history entry instead of moving through their own
stack, so their stacks can drift from the browser's over time.

## Development

```bash
pnpm install
pnpm test        # integration tests against real React Router / Vue Router / Angular / Solid / browser history
pnpm check       # lint + typecheck + tests (formatting is intentionally not part of check)
pnpm format      # oxfmt: initial formatting for pasted third-party code (manual, not in check)
```
