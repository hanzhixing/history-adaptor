import type {
    Action,
    Adapt,
    Connection,
    HistoryKey,
    HistoryLike,
    Listen,
    Location,
    To,
} from './type';

type PropagateMethod = 'push' | 'replace';

const isRoot = (location: Location): boolean =>
    location.pathname === '/' && !location.search && !location.hash;

const createPropagator = (
    source: Connection,
    others: Connection[],
) => (
    method: PropagateMethod,
    to: Location | To,
    state?: unknown,
): void => {
    others.forEach((other) => {
        source.adaptors.forEach((adaptor) => {
            if (adaptor.target !== other.key) {
                return;
            }

            const targetTo = adaptor.adapt(to);
            if (targetTo === undefined || targetTo === null) {
                return;
            }

            (other.history[method] as (to: To, state?: unknown) => void)(targetTo, state);
        });
    });
};

const createAdaptListener = (
    source: Connection,
    others: Connection[],
    suppressed: Set<HistoryKey>,
) => (
    location: Location,
    action: Action,
): void => {
    if (action !== 'POP') {
        return;
    }

    // A POP we triggered ourselves via go/back/forward must not echo back
    // into the other histories; drop our own suppression marker and stop.
    if (suppressed.has(source.key)) {
        suppressed.delete(source.key);
        return;
    }

    createPropagator(source, others)('push', location, location.state);
};

const createProxyHandlers = (
    source: Connection,
    others: Connection[],
    suppressed: Set<HistoryKey>,
): ProxyHandler<HistoryLike> => ({
    get: (target, property, receiver): unknown => {
        switch (property) {
            case 'listen': {
                // Delegate explicitly so `this` stays bound to the raw history
                // and the returned unlisten function is preserved.
                return (listener: Listen): (() => void) => target.listen(listener);
            }
            case 'push':
            case 'replace': {
                return (to: To, state?: unknown): void => {
                    // A fresh navigation invalidates any stale suppression
                    // markers left behind by a no-op go/back/forward.
                    suppressed.clear();
                    (target[property] as (to: To, state?: unknown) => void)(to, state);
                    createPropagator(source, others)(property, to, state);
                };
            }
            case 'go':
            case 'back':
            case 'forward': {
                return (...args: unknown[]): void => {
                    // Drop markers from a previous navigation that never produced
                    // a POP (e.g. back at the start of the stack), then mark every
                    // side as suppressed for this programmatic navigation. Each
                    // side's adapt listener removes its own marker when its POP fires.
                    suppressed.clear();
                    suppressed.add(source.key);
                    others.forEach((other) => suppressed.add(other.key));

                    (target[property] as (...a: unknown[]) => void)(...args);
                    others.forEach((other) => {
                        (other.history[property] as (...a: unknown[]) => void)(...args);
                    });
                };
            }
            default: {
                return Reflect.get(target, property, receiver);
            }
        }
    },
});

type ConnectionKeys<C extends readonly Connection[]> = C[number]['key'];

// The same tuple as `C`, but every adaptor `target` is narrowed to the union of
// the group's keys. An unknown target becomes `never`, so the original tuple no
// longer satisfies this type and `connect` rejects the call.
type ConnectionGroup<C extends readonly Connection[]> = {
    [Index in keyof C]: C[Index] extends Connection
        ? {
              key: C[Index]['key'];
              history: HistoryLike;
              adaptors: readonly {
                  target: C[Index]['adaptors'][number]['target'] extends ConnectionKeys<C>
                      ? C[Index]['adaptors'][number]['target']
                      : never;
                  adapt: Adapt;
              }[];
          }
        : never;
};

// An invalid group fails to provide this property, so the error names the mistake.
type ConnectionGroupError<C extends readonly Connection[]> = {
    'adaptor target must be one of the connection keys in the same connect() call': ConnectionGroup<C>;
};

export const connect = <const C extends readonly Connection[]>(
    connections: C & (C extends ConnectionGroup<C> ? unknown : ConnectionGroupError<C>),
): HistoryLike[] => {
    const keys = new Set(connections.map((connection) => connection.key));

    // TypeScript cannot express "this nested string must be one of the keys of a
    // sibling element" inside an array literal, so guard it at runtime.
    connections.forEach((connection) => {
        connection.adaptors.forEach((adaptor) => {
            if (!keys.has(adaptor.target)) {
                throw new Error(
                    `[history-adaptor] adaptor target "${adaptor.target}" does not match any connection key`,
                );
            }
        });
    });

    // Shared only within this `connect` call, so different connect groups never
    // interfere with each other.
    const suppressed = new Set<HistoryKey>();

    const resolved = connections.map((current, index) => {
        const others = connections.filter((_, idx) => idx !== index);
        const proxy = new Proxy(current.history, createProxyHandlers(current, others, suppressed));

        // Register the POP adaptor listener once, directly on the raw history.
        current.history.listen(createAdaptListener(current, others, suppressed));

        return {current, others, proxy};
    });

    // Snapshot every starting location BEFORE propagating anything. Otherwise a
    // push from one side can change another side's location and make it look like
    // a "non-root initial location", which then bounces back and duplicates entries.
    const initialLocations = resolved.map(({current}) => current.history.location);
    const initialByKey = new Map(
        resolved.map(({current}, index) => [current.key, initialLocations[index]]),
    );

    // Initial sync: seed only sides that are still at the root. A side that already
    // starts at a non-root location owns its own entry; pushing to it would duplicate
    // history entries when both sides start non-root.
    resolved.forEach(({current, others}, index) => {
        const location = initialLocations[index];
        if (isRoot(location)) {
            return;
        }

        const rootTargets = others.filter((other) => {
            const initial = initialByKey.get(other.key);
            return initial !== undefined && isRoot(initial);
        });

        createPropagator(current, rootTargets)('push', location, location.state);
    });

    return resolved.map(({proxy}) => proxy);
};
