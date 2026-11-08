import type {
    Action,
    Adapt,
    AngularLocationLike,
    AngularRouterLike,
    HistoryLike,
    HistorySourceConfig,
    Listen,
    Location,
    ReactDataRouterLike,
    ReactNavigatorLike,
    SolidRouterHistoryLike,
    To,
    VueRouterLike,
} from './type';

import {Template} from '@fedify/uri-template';
import {compile, match} from 'path-to-regexp';

// Options for resolving relative or full address strings.
export type AddressOptions = {
    // Base URL passed to `new URL(address, base)`. Provide it when `to` may be a
    // relative path or a full URL. When omitted, addresses are treated as paths.
    base?: string;
};

// ---------------------------------------------------------------------------
// Internal address <-> location helpers (not exported)
// ---------------------------------------------------------------------------

// Parse a path-like address such as `/a?b=1#c` without needing a base URL.
const parsePath = (address: string): Location => {
    const hashIndex = address.indexOf('#');
    const hash = hashIndex >= 0 ? address.slice(hashIndex) : '';
    const withoutHash = hashIndex >= 0 ? address.slice(0, hashIndex) : address;
    const searchIndex = withoutHash.indexOf('?');
    const search = searchIndex >= 0 ? withoutHash.slice(searchIndex) : '';
    const pathname = (searchIndex >= 0 ? withoutHash.slice(0, searchIndex) : withoutHash) || '/';

    return {pathname, search, hash};
};

const isAbsoluteUrl = (address: string): boolean => /^[a-z][a-z\d+.-]*:\/\//i.test(address);

// Parse an address like `/a?b=1#c` into a `Location`.
const getLocationFromAddress = (address: string, base?: string): Location => {
    if (!address) {
        return {pathname: '/', search: '', hash: ''};
    }

    if (base || isAbsoluteUrl(address)) {
        const url = base ? new URL(address, base) : new URL(address);
        return {pathname: url.pathname, search: url.search, hash: url.hash};
    }

    return parsePath(address);
};

const resolveLocation = (to: Location | To, base?: string): Location => {
    if (typeof to === 'string') {
        return getLocationFromAddress(to, base);
    }

    return {
        pathname: to.pathname ?? '/',
        search: to.search ?? '',
        hash: to.hash ?? '',
        state: to.state,
    };
};

// Serialize a `Location`/`To` into an address like `/a?b=1#c`.
const getAddressFromLocation = (to: Location | To, base?: string): string => {
    const location = resolveLocation(to, base);
    return location.pathname + location.search + location.hash;
};

// ---------------------------------------------------------------------------
// query <-> search (the `?` component: object in Vue, string in the browser)
// ---------------------------------------------------------------------------

export const getSearchFromQueryObject = (query: Record<string, unknown>): string => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => {
                if (item != null) {
                    params.append(key, String(item));
                }
            });
        } else if (value != null) {
            params.append(key, String(value));
        }
    });

    const search = params.toString();
    return search ? '?' + search : '';
};

export const getQueryObjectFromSearch = (search: string): Record<string, unknown> => {
    const query: Record<string, unknown> = {};
    new URLSearchParams(search).forEach((value, key) => {
        const existing = query[key];
        if (existing === undefined) {
            query[key] = value;
        } else if (Array.isArray(existing)) {
            existing.push(value);
        } else {
            query[key] = [existing, value];
        }
    });
    return query;
};

// ---------------------------------------------------------------------------
// Rule-based adaptor
// ---------------------------------------------------------------------------

// One routing rule: an address pattern on one side and its target on the other.
export type Rule = {
    // `path-to-regexp` pattern, RFC 6570 URI template, or a `RegExp`.
    from: string | RegExp;
    // Target address. `RegExp` rules use `$<name>` groups.
    to: string;
};

const isUriTemplate = (from: string): boolean => from.includes('{');

const matchRule = (rule: Rule, address: string): string | undefined => {
    if (rule.from instanceof RegExp) {
        // Drop `g`/`y` so `.test()` does not keep state between calls.
        const flags = rule.from.flags.replace(/[gy]/g, '');
        const pattern = new RegExp(rule.from.source, flags);

        if (!pattern.test(address)) {
            return undefined;
        }

        return address.replace(pattern, rule.to);
    }

    if (isUriTemplate(rule.from)) {
        const variables = new Template(rule.from).match(address);
        if (variables === null) {
            return undefined;
        }

        return new Template(rule.to).expand(variables);
    }

    const {pathname, search, hash} = getLocationFromAddress(address);
    const matched = match(rule.from)(pathname);

    if (matched === false) {
        return undefined;
    }

    return `${compile(rule.to)(matched.params)}${search}${hash}`;
};

// Build an `Adapt` from an ordered list of rules. The first matching rule wins;
// when no rule matches, the adaptor returns `undefined`, which tells
// `history-adaptor` to stop propagating to that side.
//
// - `from` as a string uses `path-to-regexp` syntax (`/user/:id`).
// - `from` as a string containing `{...}` is an RFC 6570 URI template. Any `{`
//   counts, so path-to-regexp optional groups such as `/user{/:id}` are NOT
//   supported here; use `:param` or a `RegExp` instead.
// - `from` as a `RegExp` uses `String.prototype.replace` with `$<name>` groups.
export const createAdapt = (rules: readonly Rule[]): Adapt => {
    return (to: Location | To): To | undefined => {
        const address = getAddressFromLocation(to);

        for (const rule of rules) {
            const result = matchRule(rule, address);
            if (result !== undefined) {
                return result;
            }
        }

        return undefined;
    };
};

// ---------------------------------------------------------------------------
// adaptHistory
// ---------------------------------------------------------------------------

// Turn any router-like source into a `HistoryLike`.
//
// The action reported to listeners is synthesized: navigation that goes through
// this object's `push`/`replace`/`go` is tagged accordingly, while any change the
// source reports on its own (e.g. a `<Link>` click, or the browser Back button) is
// treated as `POP`.
export const adaptHistory = (config: HistorySourceConfig): HistoryLike => {
    const listeners = new Set<Listen>();
    let subscribed = false;
    let unsubscribe: (() => void) | undefined;
    let pendingKind: Action = 'POP';
    let disposed = false;

    const ensureSubscribed = (): void => {
        if (subscribed) {
            return;
        }
        subscribed = true;

        unsubscribe = config.subscribe(() => {
            const kind = pendingKind;
            pendingKind = 'POP';
            const location = config.getLocation();
            listeners.forEach((listener) => listener(location, kind));
        });
    };

    const dispose = (): void => {
        disposed = true;
        listeners.clear();
        unsubscribe?.();
        unsubscribe = undefined;
        subscribed = false;
    };

    // Reset the synthesized action once the navigation settles, even if the
    // source never emitted (a guard cancelled it, or it was a no-op). Without
    // this a later external POP would be mislabelled as PUSH/REPLACE.
    const settle = (result: void | Promise<unknown>): void => {
        Promise.resolve(result).then(
            () => {
                pendingKind = 'POP';
            },
            () => {
                pendingKind = 'POP';
            },
        );
    };

    const go = (delta: number): void => {
        if (disposed) {
            return;
        }
        pendingKind = 'POP';
        config.go(delta);
    };

    return {
        get location() {
            return config.getLocation();
        },
        listen(listener: Listen) {
            if (disposed) {
                return () => {};
            }
            listeners.add(listener);
            ensureSubscribed();
            return () => listeners.delete(listener);
        },
        push(to: To, state?: unknown) {
            if (disposed) {
                return;
            }
            pendingKind = 'PUSH';
            settle(config.navigate(to, {replace: false, state}));
        },
        replace(to: To, state?: unknown) {
            if (disposed) {
                return;
            }
            pendingKind = 'REPLACE';
            settle(config.navigate(to, {replace: true, state}));
        },
        go,
        back() {
            go(-1);
        },
        forward() {
            go(1);
        },
        dispose,
    };
};

// ---------------------------------------------------------------------------
// Browser (window.history)
// ---------------------------------------------------------------------------

export type BrowserNativeOptions = AddressOptions & {
    // Use hash-based routing (`#/path`) instead of the HTML5 History API.
    hash?: boolean;
    // Advanced/testing: bind to a specific window. Defaults to the global one.
    window?: Window;
};

// The real browser address bar as a `HistoryLike`.
//
// `pushState`/`replaceState` do not fire a navigation event, so push/replace
// notify listeners synchronously; back/forward rely on the navigation event
// (`popstate`, or `hashchange` in hash mode).
export const fromBrowserNative = (options: BrowserNativeOptions = {}): HistoryLike => {
    const useHash = options.hash ?? false;
    const win = options.window ?? (typeof window === 'undefined' ? undefined : window);

    if (!win) {
        throw new Error('[history-adaptor] fromBrowserNative requires a browser environment');
    }

    const listeners = new Set<() => void>();
    const notify = (): void => listeners.forEach((listener) => listener());

    const onPopState = (): void => notify();
    // In hash mode a traversal fires both `popstate` and `hashchange`, so
    // listening to only `hashchange` keeps one notification per navigation while
    // still catching direct `location.hash` assignments. `pushState`/`replaceState`
    // fire neither, so navigate() notifies manually.
    if (useHash) {
        win.addEventListener('hashchange', onPopState);
    } else {
        win.addEventListener('popstate', onPopState);
    }

    const getLocation = (): Location => {
        if (useHash) {
            const resolved = getLocationFromAddress(
                win.location.hash.replace(/^#/, '') || '/',
                options.base,
            );
            return {...resolved, state: win.history.state};
        }
        return {
            pathname: win.location.pathname,
            search: win.location.search,
            hash: win.location.hash,
            state: win.history.state,
        };
    };

    const adapted = adaptHistory({
        getLocation,
        navigate: (to, opts) => {
            const address = getAddressFromLocation(to, options.base);
            const url = useHash ? '#' + address : address;
            const state = opts?.state;
            if (opts?.replace) {
                win.history.replaceState(state, '', url);
            } else {
                win.history.pushState(state, '', url);
            }
            notify();
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        go: (delta) => win.history.go(delta),
    });

    // `adaptHistory` only tears down its own subscription; the raw window
    // listeners registered here must be removed as well.
    const innerDispose = adapted.dispose;
    adapted.dispose = () => {
        innerDispose?.();
        if (useHash) {
            win.removeEventListener('hashchange', onPopState);
        } else {
            win.removeEventListener('popstate', onPopState);
        }
        listeners.clear();
    };

    return adapted;
};

// ---------------------------------------------------------------------------
// React Router (data router)
// ---------------------------------------------------------------------------

// Adapt a React Router data router (`createMemoryRouter` result) to a `HistoryLike`.
export const fromReactRouter = (router: ReactDataRouterLike): HistoryLike =>
    adaptHistory({
        getLocation: () => router.state.location,
        navigate: (to, opts) => router.navigate(to, opts),
        subscribe: (listener) => router.subscribe(() => listener()),
        go: (delta) => {
            void router.navigate(delta);
        },
    });

// Build the `navigator` prop for React Router's low-level `<Router>` from a
// `HistoryLike` (Declarative Mode).
export const createReactRouterNavigator = (
    history: HistoryLike,
    options: AddressOptions = {},
): ReactNavigatorLike => ({
    createHref: (to) => getAddressFromLocation(to, options.base),
    encodeLocation: (to) => {
        const {pathname, search, hash} = resolveLocation(to, options.base);
        return {pathname, search, hash};
    },
    go: (delta) => history.go(delta),
    push: (to, state) => history.push(to, state),
    replace: (to, state) => history.replace(to, state),
});

// ---------------------------------------------------------------------------
// Vue Router
// ---------------------------------------------------------------------------

// Adapt a Vue Router router to a `HistoryLike`.
export const fromVueRouter = (
    router: VueRouterLike,
    options: AddressOptions = {},
): HistoryLike =>
    adaptHistory({
        getLocation: () => {
            const route = router.currentRoute.value;
            return {
                pathname: route.path,
                search: getSearchFromQueryObject(route.query),
                hash: route.hash || '',
                state: route.state,
            };
        },
        navigate: (to, opts) => {
            const location = resolveLocation(to, options.base);
            const target = {
                path: location.pathname,
                query: getQueryObjectFromSearch(location.search),
                hash: location.hash,
                state: opts?.state,
            };
            return opts?.replace ? router.replace(target) : router.push(target);
        },
        subscribe: (listener) => router.afterEach(() => listener()),
        go: (delta) => router.go(delta),
    });

// The address to seed a Vue Router with after `connect` (Vue Router starts at `/`).
export const initialVueLocation = (
    location: Location | To,
    options: AddressOptions = {},
): string => getAddressFromLocation(location, options.base);

// ---------------------------------------------------------------------------
// Angular (@angular/router)
// ---------------------------------------------------------------------------

// Angular's public `EventType.NavigationEnd` value (see `@angular/router`).
const ANGULAR_NAVIGATION_END = 1;

const isNavigationEnd = (event: unknown): boolean => {
    if (typeof event !== 'object' || event === null) {
        return false;
    }
    const candidate = event as {type?: unknown; constructor?: {name?: string}};
    return (
        candidate.type === ANGULAR_NAVIGATION_END ||
        candidate.constructor?.name === 'NavigationEnd'
    );
};

// Adapt an Angular router (`@angular/router`'s `Router` + `@angular/common`'s
// `Location`) to a `HistoryLike`.
//
// `go(n)` is limited to `-1` / `1` (Angular's `Location.back()` / `forward()`)
// and throws for any other delta.
export const fromAngularRouter = (
    router: AngularRouterLike,
    location: AngularLocationLike,
    options: AddressOptions = {},
): HistoryLike =>
    adaptHistory({
        getLocation: () => {
            const resolved = getLocationFromAddress(location.path(true), options.base);
            const state = location.getState?.();
            return state === undefined || state === null ? resolved : {...resolved, state};
        },
        navigate: (to, opts) => {
            const address = getAddressFromLocation(to, options.base);
            return router.navigateByUrl(address, {
                replaceUrl: opts?.replace,
                state: opts?.state,
            });
        },
        subscribe: (listener) => {
            const subscription = router.events.subscribe((event) => {
                if (isNavigationEnd(event)) {
                    listener();
                }
            });
            return () => subscription.unsubscribe();
        },
        go: (delta) => {
            if (delta === -1) {
                location.back();
                return;
            }
            if (delta === 1) {
                location.forward();
                return;
            }
            throw new Error(
                '[history-adaptor] go(n) is not supported for Angular (only -1 / 1)',
            );
        },
    });

// ---------------------------------------------------------------------------
// Solid Router (@solidjs/router)
// ---------------------------------------------------------------------------

// Adapt a Solid Router memory history (`createMemoryHistory()`) to a
// `HistoryLike`. Pair it with `<MemoryRouter history={...}>`.
//
// Solid's memory history does not store `state`, so state is not preserved on
// the Solid side.
export const fromSolidRouter = (
    history: SolidRouterHistoryLike,
    options: AddressOptions = {},
): HistoryLike =>
    adaptHistory({
        getLocation: () => getLocationFromAddress(history.get(), options.base),
        navigate: (to, opts) => {
            const value = getAddressFromLocation(to, options.base);
            history.set({value, replace: opts?.replace, state: opts?.state});
        },
        subscribe: (listener) => history.listen(() => listener()),
        go: (delta) => history.go(delta),
    });
