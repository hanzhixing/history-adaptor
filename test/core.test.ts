import {JSDOM} from 'jsdom';
import {describe, expect, it, vi} from 'vitest';

import type {Adapt, HistoryLike} from '../src/index';
import {connect} from '../src/index';
import {createHashHistory, createWindowHistory} from './adapters/native';
import {createReactHistory} from './adapters/react';

const flush = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const rules: Record<string, Record<string, string>> = {
    A: {'/a1': '/b1', '/a2': '/b2', '/loop-a': '/loop-b'},
    B: {'/b1': '/a1', '/b2': '/a2', '/loop-b': '/loop-a'},
};

const createAdaptOf =
    (sourceKey: string): Adapt =>
    (location) => {
        const pathname = typeof location === 'string' ? location : (location.pathname ?? '');
        return rules[sourceKey]?.[pathname];
    };

// An adapt that maps the pathname but deliberately keeps search/hash, to prove the
// library hands the full location to adapt and propagates the full result.
const preserveAdapt: Adapt = (location) => {
    const pathname = typeof location === 'string' ? location : (location.pathname ?? '');
    const mapped = rules.A[pathname];
    if (!mapped) {
        return undefined;
    }
    if (typeof location === 'string') {
        return mapped;
    }
    return {pathname: mapped, search: location.search ?? '', hash: location.hash ?? ''};
};

const pathOf = (history: ReturnType<typeof createReactHistory>) =>
    history.router.state.location.pathname;

const setup = (options: {initialA?: string[]} = {}) => {
    const a = createReactHistory(options.initialA ?? ['/']);
    const b = createReactHistory();

    const [ha, hb] = connect([
        {key: 'A', history: a.history, adaptors: [{target: 'B', adapt: createAdaptOf('A')}]},
        {key: 'B', history: b.history, adaptors: [{target: 'A', adapt: createAdaptOf('B')}]},
    ]);

    return {a, b, ha, hb};
};

describe('connect (peer to peer)', () => {
    it('propagates push from A to B', async () => {
        const {a, b, ha} = setup();

        ha.push('/a1');
        await flush();

        expect(pathOf(a)).toBe('/a1');
        expect(pathOf(b)).toBe('/b1');
    });

    it('propagates push from B to A', async () => {
        const {a, b, hb} = setup();

        hb.push('/b2');
        await flush();

        expect(pathOf(b)).toBe('/b2');
        expect(pathOf(a)).toBe('/a2');
    });

    it('propagates replace from A to B', async () => {
        const {a, b, ha} = setup();

        ha.replace('/a1');
        await flush();

        expect(pathOf(a)).toBe('/a1');
        expect(pathOf(b)).toBe('/b1');
    });

    it('passes state through to the other side', async () => {
        const {a, b, ha} = setup();

        ha.push('/a1', {token: 'abc'});
        await flush();

        expect(a.router.state.location.state).toEqual({token: 'abc'});
        expect(b.router.state.location.state).toEqual({token: 'abc'});
    });

    it('does not loop forever on circular mapping rules', async () => {
        const {a, b, ha} = setup();

        ha.push('/loop-a');
        await flush();

        // A -> B happened exactly once; B did not bounce the push back to A.
        expect(pathOf(a)).toBe('/loop-a');
        expect(pathOf(b)).toBe('/loop-b');
    });

    it('propagates back and forward to the other side', async () => {
        const {a, b, ha} = setup();

        ha.push('/a1');
        await flush();
        ha.push('/a2');
        await flush();

        ha.back();
        await flush();
        expect(pathOf(a)).toBe('/a1');
        expect(pathOf(b)).toBe('/b1');

        ha.forward();
        await flush();
        expect(pathOf(a)).toBe('/a2');
        expect(pathOf(b)).toBe('/b2');
    });

    it('supports go() and exposes the underlying location', async () => {
        const {a, b, ha} = setup();

        ha.push('/a1');
        await flush();
        ha.push('/a2');
        await flush();

        ha.go(-1);
        await flush();
        expect(pathOf(a)).toBe('/a1');
        expect(pathOf(b)).toBe('/b1');

        // Properties outside the navigation methods fall through to the raw history.
        expect(ha.location.pathname).toBe('/a1');
    });

    it('only propagates to the matching target in a group with more than two sides', async () => {
        const a = createReactHistory();
        const b = createReactHistory();
        const c = createReactHistory();

        const [ha] = connect([
            {
                key: 'A',
                history: a.history,
                adaptors: [{target: 'B', adapt: createAdaptOf('A')}],
            },
            {key: 'B', history: b.history, adaptors: []},
            {key: 'C', history: c.history, adaptors: []},
        ]);

        ha.push('/a1');
        await flush();

        expect(pathOf(b)).toBe('/b1');
        // C is not an adaptor target, so it must stay untouched.
        expect(pathOf(c)).toBe('/');
    });

    it('returns a working unlisten function from listen()', async () => {
        const {ha} = setup();
        const spy = vi.fn();

        const unlisten = ha.listen(spy);
        ha.push('/a1');
        await flush();
        expect(spy).toHaveBeenCalled();

        const callsBefore = spy.mock.calls.length;
        unlisten();
        ha.push('/a2');
        await flush();
        expect(spy.mock.calls.length).toBe(callsBefore);
    });

    it('syncs a non-root initial location to the other side', async () => {
        const {a, b} = setup({initialA: ['/a1']});
        await flush();

        // A must keep its own initial location (no duplicate self-push) ...
        expect(pathOf(a)).toBe('/a1');
        // ... while B receives the mapped location.
        expect(pathOf(b)).toBe('/b1');
    });

    it('does not push a duplicate entry onto its own stack during initial sync', async () => {
        const dom = new JSDOM('', {url: 'http://localhost/a1'});
        const win = dom.window as unknown as Window;
        const addressBar = createWindowHistory(win);
        const app = createReactHistory();
        const lengthBefore = win.history.length;

        try {
            connect([
                {
                    key: 'A',
                    history: addressBar,
                    adaptors: [{target: 'B', adapt: createAdaptOf('A')}],
                },
                {
                    key: 'B',
                    history: app.history,
                    adaptors: [{target: 'A', adapt: createAdaptOf('B')}],
                },
            ]);
            await flush();

            // The source stack must NOT grow: the old version pushed a duplicate entry.
            expect(win.history.length).toBe(lengthBefore);
            expect(win.location.pathname).toBe('/a1');
            // The mapped initial location still reaches the other side.
            expect(pathOf(app)).toBe('/b1');
        } finally {
            win.close();
        }
    });

    it('keeps separate connect groups isolated', async () => {
        const g1 = setup();
        const g2 = setup();

        g1.ha.push('/a1');
        await flush();

        expect(pathOf(g1.a)).toBe('/a1');
        expect(pathOf(g1.b)).toBe('/b1');
        // Group 2 must not be touched.
        expect(pathOf(g2.a)).toBe('/');
        expect(pathOf(g2.b)).toBe('/');
    });

    it('throws when an adaptor target has no matching connection key', () => {
        const history: HistoryLike = {
            location: {pathname: '/', search: '', hash: ''},
            listen: () => () => {},
            push: () => {},
            replace: () => {},
            go: () => {},
            back: () => {},
            forward: () => {},
        };

        expect(() =>
            // @ts-expect-error "missing" is not one of the connection keys
            connect([
                {
                    key: 'A',
                    history,
                    adaptors: [{target: 'missing', adapt: () => undefined}],
                },
            ]),
        ).toThrow('[history-adaptor]');
    });

    it('passes a raw string (with search/hash) to adapt unmodified', () => {
        const a = createReactHistory();
        const b = createReactHistory();
        const received: unknown[] = [];

        const [ha] = connect([
            {
                key: 'A',
                history: a.history,
                adaptors: [
                    {
                        target: 'B',
                        adapt: (location) => {
                            received.push(location);
                            return undefined;
                        },
                    },
                ],
            },
            {key: 'B', history: b.history, adaptors: []},
        ]);

        ha.push('/a1?x=1#f');

        // The library must not strip search/hash before handing the value to adapt.
        expect(received).toEqual(['/a1?x=1#f']);
    });

    it('propagates search and hash when adapt preserves them', async () => {
        const a = createReactHistory();
        const b = createReactHistory();

        const [ha] = connect([
            {key: 'A', history: a.history, adaptors: [{target: 'B', adapt: preserveAdapt}]},
            {key: 'B', history: b.history, adaptors: []},
        ]);

        ha.push({pathname: '/a1', search: '?x=1', hash: '#f'});
        await flush();

        // Source keeps the full address.
        expect(a.router.state.location.pathname).toBe('/a1');
        expect(a.router.state.location.search).toBe('?x=1');
        expect(a.router.state.location.hash).toBe('#f');

        // The other side receives the mapped pathname with search/hash intact.
        expect(b.router.state.location.pathname).toBe('/b1');
        expect(b.router.state.location.search).toBe('?x=1');
        expect(b.router.state.location.hash).toBe('#f');
    });

    it('does not duplicate entries when both sides start at non-root locations', async () => {
        const domA = new JSDOM('', {url: 'http://localhost/a1'});
        const domB = new JSDOM('', {url: 'http://localhost/b1'});
        const winA = domA.window as unknown as Window;
        const winB = domB.window as unknown as Window;

        try {
            connect([
                {
                    key: 'A',
                    history: createWindowHistory(winA),
                    adaptors: [{target: 'B', adapt: createAdaptOf('A')}],
                },
                {
                    key: 'B',
                    history: createWindowHistory(winB),
                    adaptors: [{target: 'A', adapt: createAdaptOf('B')}],
                },
            ]);
            await flush();

            // Both sides already own a non-root entry, so neither should be seeded
            // (and no duplicate history entry should be pushed).
            expect(winA.history.length).toBe(1);
            expect(winB.history.length).toBe(1);
            expect(winA.location.pathname).toBe('/a1');
            expect(winB.location.pathname).toBe('/b1');
        } finally {
            winA.close();
            winB.close();
        }
    });

    it('notifies a hash history once per back (no echo push)', async () => {
        const dom = new JSDOM('', {url: 'http://localhost/'});
        const win = dom.window as unknown as Window;
        const calls: string[] = [];
        const peer: HistoryLike = {
            location: {pathname: '/', search: '', hash: ''},
            listen: () => () => {},
            push: (to) => {
                calls.push(`push:${String(to)}`);
            },
            replace: () => {},
            go: () => {},
            back: () => {
                calls.push('back');
            },
            forward: () => {
                calls.push('forward');
            },
        };

        const [ha] = connect([
            {
                key: 'A',
                history: createHashHistory(win),
                adaptors: [{target: 'B', adapt: createAdaptOf('A')}],
            },
            {key: 'B', history: peer, adaptors: []},
        ]);

        try {
            ha.push('/a1');
            await flush();
            ha.push('/a2');
            await flush();

            calls.length = 0;
            ha.back();
            await flush();

            // A single lockstep `back`. Hash mode used to fire popstate AND
            // hashchange, appending an extra echo `push` from the second event.
            expect(calls).toEqual(['back']);
        } finally {
            win.close();
        }
    });

    it('propagates an external POP after a no-op back is cleared by a push', async () => {
        const dom = new JSDOM('', {url: 'http://localhost/'});
        const win = dom.window as unknown as Window;
        const calls: unknown[] = [];
        const peer: HistoryLike = {
            location: {pathname: '/', search: '', hash: ''},
            listen: () => () => {},
            push: (to) => {
                calls.push(to);
            },
            replace: () => {},
            go: () => {},
            back: () => {},
            forward: () => {},
        };

        const [ha] = connect([
            {
                key: 'A',
                history: createWindowHistory(win),
                adaptors: [
                    {
                        target: 'B',
                        adapt: (to) => {
                            const pathname = typeof to === 'string' ? to : to.pathname;
                            if (pathname === '/a1') {
                                return '/b1';
                            }
                            if (pathname === '/') {
                                return '/b0';
                            }
                            return undefined;
                        },
                    },
                ],
            },
            {key: 'B', history: peer, adaptors: []},
        ]);

        try {
            // A no-op back at the root would leave a stale suppression marker ...
            ha.back();
            await flush();

            // ... which a subsequent push must clear.
            ha.push('/a1');
            await flush();
            calls.length = 0;

            // A POP from outside the adaptor must still reach the peer.
            win.history.back();
            await flush();
            expect(calls).toEqual(['/b0']);
        } finally {
            win.close();
        }
    });
});
