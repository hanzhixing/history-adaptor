export type HistoryKey = string;

export type Action = 'PUSH' | 'REPLACE' | 'POP';

export type Location = {
    pathname: string;
    search: string;
    hash: string;
    state?: unknown;
};

// A location descriptor accepted by navigation methods.
// Either a path string or a partial location.
export type To = string | Partial<Location>;

export type Listen = (location: Location, action: Action) => void;

// The minimal, framework-agnostic contract this library needs.
//
// Any router/history implementation can be adapted to it. The library never
// imports a framework, so it stays agnostic to what sits on either side.
export type HistoryLike = {
    readonly location: Location;
    listen(listener: Listen): () => void;
    push(to: To, state?: unknown): void;
    replace(to: To, state?: unknown): void;
    go(delta: number): void;
    back(): void;
    forward(): void;
    // Optional teardown. Helpers created by this library implement it to remove
    // their DOM listeners and framework subscriptions. Custom implementations may
    // omit it.
    dispose?: () => void;
};

// Pure mapping function. Receives the source location (or location descriptor)
// and returns the target location descriptor, or `undefined` when nothing matches.
export type Adapt = (location: Location | To) => To | undefined;

export type Adaptor = {
    target: HistoryKey;
    adapt: Adapt;
};

// One routing system taking part in a `connect` group.
//
// `key` identifies the connection. Each adaptor's `target` must refer to one of
// the keys in the same group (checked at runtime by `connect`).
export type Connection = {
    key: HistoryKey;
    history: HistoryLike;
    adaptors: readonly Adaptor[];
};

// ---------------------------------------------------------------------------
// Helper-facing structural types. These describe the minimal shape the helpers
// need; nothing here imports React, Vue or any router package.
// ---------------------------------------------------------------------------

// The minimal shape `adaptHistory` consumes.
export type HistorySourceConfig = {
    getLocation(): Location;
    // Return a promise when the navigation settles asynchronously (Vue Router,
    // Angular). `adaptHistory` resets the synthesized action once it settles,
    // even when the source never emitted.
    navigate(
        to: To,
        options?: {replace?: boolean; state?: unknown},
    ): void | Promise<unknown>;
    subscribe(listener: () => void): () => void;
    go(delta: number): void;
};

// The shape of a React Router data router (`createMemoryRouter` result).
export type ReactDataRouterLike = {
    state: {location: Location};
    navigate(
        to: To | number,
        options?: {replace?: boolean; state?: unknown},
    ): Promise<unknown>;
    subscribe(listener: () => void): () => void;
};

// The shape of an Angular `Router` (`@angular/router`).
export type AngularRouterLike = {
    events: {
        // `unknown` keeps this assignable from RxJS's `Observable<Event>`.
        subscribe(next: (event: unknown) => void): {unsubscribe(): void};
    };
    navigateByUrl(
        url: string,
        options?: {replaceUrl?: boolean; state?: unknown},
    ): Promise<unknown>;
};

// The shape of Angular's `Location` service (`@angular/common`).
export type AngularLocationLike = {
    path(includeHash?: boolean): string;
    getState?(): unknown;
    back(): void;
    forward(): void;
};

// The shape of a Solid Router memory history (`createMemoryHistory()`).
export type SolidRouterHistoryLike = {
    get(): string;
    set(change: {value: string; replace?: boolean; state?: unknown}): void;
    go(delta: number): void;
    listen(listener: (value: string) => void): () => void;
};

// The shape of a Vue Router router.
export type VueRouterLike = {
    currentRoute: {
        value: {path: string; query: Record<string, unknown>; hash: string; state?: unknown};
    };
    // `any` is the deliberate escape hatch at the framework boundary: Vue Router's
    // real `push`/`replace` accept a much more specific union than we can express
    // without importing `vue-router`.
    push(to: any): Promise<unknown>;
    replace(to: any): Promise<unknown>;
    go(delta: number): void;
    afterEach(hook: () => void): () => void;
};

// The shape of the `navigator` prop accepted by React Router's low-level `<Router>`.
export type ReactNavigatorLike = {
    createHref(to: To): string;
    encodeLocation(to: To): {pathname: string; search: string; hash: string};
    go(delta: number): void;
    push(to: To, state?: unknown): void;
    replace(to: To, state?: unknown): void;
};
