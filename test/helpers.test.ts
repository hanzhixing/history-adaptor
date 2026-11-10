import {JSDOM} from 'jsdom';
import {describe, expect, it, vi} from 'vitest';

import {
    adaptHistory,
    createReactRouterNavigator,
    fromAngularRouter,
    fromBrowserNative,
    getQueryObjectFromSearch,
    getSearchFromQueryObject,
    initialVueLocation,
} from '../src/helper';
import type {HistoryLike, Location} from '../src/index';

const flush = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const noopHistory: HistoryLike = {
    location: {pathname: '/', search: '', hash: ''},
    listen: () => () => {},
    push: () => {},
    replace: () => {},
    go: () => {},
    back: () => {},
    forward: () => {},
};

describe('helper utilities', () => {
    it('converts between a query object and a search string', () => {
        expect(getSearchFromQueryObject({a: '1', b: ['2', '3']})).toBe('?a=1&b=2&b=3');
        expect(getQueryObjectFromSearch('?a=1&b=2&b=3')).toEqual({a: '1', b: ['2', '3']});
        expect(getSearchFromQueryObject({})).toBe('');
        expect(getQueryObjectFromSearch('')).toEqual({});

        // Nullish values are skipped, and repeated keys accumulate.
        expect(getSearchFromQueryObject({a: null, b: ['1', null, undefined]})).toBe('?b=1');
        expect(getQueryObjectFromSearch('?a=1&a=2&a=3')).toEqual({a: ['1', '2', '3']});
    });

    it('createReactRouterNavigator builds href and encodeLocation', () => {
        const navigator = createReactRouterNavigator(noopHistory);
        expect(navigator.createHref('/a?b=1#c')).toBe('/a?b=1#c');
        expect(navigator.encodeLocation('/a?b=1#c')).toEqual({
            pathname: '/a',
            search: '?b=1',
            hash: '#c',
        });
        // Absolute URLs are parsed without a base.
        expect(createReactRouterNavigator(noopHistory).createHref('https://other.test/a?b=1#c')).toBe(
            '/a?b=1#c',
        );
    });

    it('normalizes empty paths and partial locations', () => {
        const navigator = createReactRouterNavigator(noopHistory);
        expect(navigator.createHref('?a=1')).toBe('/?a=1');
        expect(navigator.createHref({})).toBe('/');
        expect(navigator.encodeLocation({pathname: '/x'})).toEqual({
            pathname: '/x',
            search: '',
            hash: '',
        });
    });

    it('createReactRouterNavigator delegates navigation to the history', () => {
        const history: HistoryLike = {
            ...noopHistory,
            push: vi.fn(),
            replace: vi.fn(),
            go: vi.fn(),
        };
        const navigator = createReactRouterNavigator(history);

        navigator.push('/a', {token: 'abc'});
        navigator.replace('/b');
        navigator.go(-1);

        expect(history.push).toHaveBeenCalledWith('/a', {token: 'abc'});
        expect(history.replace).toHaveBeenCalledWith('/b', undefined);
        expect(history.go).toHaveBeenCalledWith(-1);
    });

    it('resolves relative addresses against a user-provided base', () => {
        const navigator = createReactRouterNavigator(noopHistory, {
            base: 'https://example.com/app/',
        });
        expect(navigator.createHref('news?x=1')).toBe('/app/news?x=1');
        expect(navigator.encodeLocation('news?x=1')).toEqual({
            pathname: '/app/news',
            search: '?x=1',
            hash: '',
        });
        // Absolute URLs are parsed without the base.
        expect(navigator.createHref('https://other.test/a?b=1#c')).toBe('/a?b=1#c');
    });

    it('initialVueLocation returns an address string', () => {
        expect(initialVueLocation('/vue/news?x=1#y')).toBe('/vue/news?x=1#y');
        expect(initialVueLocation({pathname: '/vue/main', search: '?a=1'})).toBe('/vue/main?a=1');
    });

    it('adaptHistory dispose unsubscribes from the source', () => {
        let emit: (() => void) | undefined;
        let unsubscribed = false;
        const navigate = vi.fn();
        const go = vi.fn();

        const history = adaptHistory({
            getLocation: () => ({pathname: '/', search: '', hash: ''}),
            navigate,
            subscribe: (listener) => {
                emit = listener;
                return () => {
                    unsubscribed = true;
                };
            },
            go,
        });

        const spy = vi.fn();
        history.listen(spy);

        emit?.();
        expect(spy).toHaveBeenCalledTimes(1);

        history.dispose?.();
        expect(unsubscribed).toBe(true);

        spy.mockClear();
        emit?.();
        expect(spy).not.toHaveBeenCalled();

        // A disposed history is a no-op for every navigation method.
        history.push('/x');
        history.replace('/y');
        history.go(1);
        history.back();
        history.forward();
        expect(navigate).not.toHaveBeenCalled();
        expect(go).not.toHaveBeenCalled();
    });

    it('resets the synthesized action when a navigation never emits', async () => {
        let emit: (() => void) | undefined;

        const history = adaptHistory({
            getLocation: () => ({pathname: '/', search: '', hash: ''}),
            // Resolves without the source ever notifying (cancelled / no-op).
            navigate: () => Promise.resolve(),
            subscribe: (listener) => {
                emit = listener;
                return () => {};
            },
            go: () => {},
        });

        const actions: string[] = [];
        history.listen((_location, action) => actions.push(action));

        history.push('/nowhere');
        await flush();

        // The stale PUSH must not leak into the next (external) emission.
        emit?.();
        expect(actions).toEqual(['POP']);
    });

    it('resets the synthesized action when a navigation rejects', async () => {
        let emit: (() => void) | undefined;

        const history = adaptHistory({
            getLocation: () => ({pathname: '/', search: '', hash: ''}),
            navigate: () => Promise.reject(new Error('cancelled')),
            subscribe: (listener) => {
                emit = listener;
                return () => {};
            },
            go: () => {},
        });

        const actions: string[] = [];
        history.listen((_location, action) => actions.push(action));

        history.push('/nowhere');
        await flush();

        // A rejected navigation must also clear the pending PUSH.
        emit?.();
        expect(actions).toEqual(['POP']);
    });

    it('fromAngularRouter only reacts to NavigationEnd events', () => {
        let emit: ((event: unknown) => void) | undefined;
        const unsubscribe = vi.fn();

        const history = fromAngularRouter(
            {
                events: {
                    subscribe: (listener: (event: unknown) => void) => {
                        emit = listener;
                        return {unsubscribe};
                    },
                },
                navigateByUrl: () => Promise.resolve(),
            },
            {path: () => '/', back: () => {}, forward: () => {}},
        );

        const spy = vi.fn();
        history.listen(spy);

        emit?.(null);
        emit?.('not-an-event');
        emit?.({type: 9});
        expect(spy).not.toHaveBeenCalled();

        emit?.({type: 1});
        expect(spy).toHaveBeenCalledTimes(1);

        history.dispose?.();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});

describe('fromBrowserNative', () => {
    it('reports PUSH for its own navigation and POP for history.back()', async () => {
        const dom = new JSDOM('', {url: 'http://localhost/'});
        const win = dom.window as unknown as Window;
        const history = fromBrowserNative({window: win});
        const events: {path: string; action: string}[] = [];
        history.listen((location: Location, action) =>
            events.push({path: location.pathname, action}),
        );

        try {
            history.push('/a');
            history.push('/b');
            expect(events.map((event) => event.action)).toEqual(['PUSH', 'PUSH']);

            win.history.back();
            await flush();
            expect(events.at(-1)).toEqual({path: '/a', action: 'POP'});
        } finally {
            win.close();
        }
    });

    it('supports hash mode', () => {
        const dom = new JSDOM('', {url: 'http://localhost/'});
        const win = dom.window as unknown as Window;
        const history = fromBrowserNative({window: win, hash: true});

        try {
            history.push('/x');
            expect(win.location.hash).toBe('#/x');
            expect(history.location.pathname).toBe('/x');

            history.push('/y', {token: 'abc'});
            expect(history.location.state).toEqual({token: 'abc'});
        } finally {
            win.close();
        }
    });

    it('preserves search and hash in HTML5 mode', async () => {
        const dom = new JSDOM('', {url: 'http://localhost/'});
        const win = dom.window as unknown as Window;
        const history = fromBrowserNative({window: win});

        try {
            history.push('/a?x=1#f');
            expect(win.location.pathname).toBe('/a');
            expect(win.location.search).toBe('?x=1');
            expect(win.location.hash).toBe('#f');
            expect(history.location.pathname).toBe('/a');
            expect(history.location.search).toBe('?x=1');
            expect(history.location.hash).toBe('#f');

            history.push('/b?y=2#g');
            expect(history.location.pathname).toBe('/b');
            expect(history.location.search).toBe('?y=2');
            expect(history.location.hash).toBe('#g');

            history.replace('/c?z=3#h');
            expect(win.location.pathname).toBe('/c');
            expect(win.location.search).toBe('?z=3');
            expect(win.location.hash).toBe('#h');

            // The replace overwrote the second push, so back() returns to the first push.
            win.history.back();
            await flush();
            expect(history.location.pathname).toBe('/a');
            expect(history.location.search).toBe('?x=1');
            expect(history.location.hash).toBe('#f');
        } finally {
            win.close();
        }
    });

    it('preserves search and hash in hash mode', () => {
        const dom = new JSDOM('', {url: 'http://localhost/'});
        const win = dom.window as unknown as Window;
        const history = fromBrowserNative({window: win, hash: true});

        try {
            history.push('/a?x=1#f');
            expect(win.location.hash).toBe('#/a?x=1#f');
            expect(history.location.pathname).toBe('/a');
            expect(history.location.search).toBe('?x=1');
            expect(history.location.hash).toBe('#f');

            history.replace('/b?y=2#g');
            expect(win.location.hash).toBe('#/b?y=2#g');
            expect(history.location.pathname).toBe('/b');
            expect(history.location.search).toBe('?y=2');
            expect(history.location.hash).toBe('#g');
        } finally {
            win.close();
        }
    });

    it('dispose stops notifications and removes window listeners', async () => {
        const dom = new JSDOM('', {url: 'http://localhost/'});
        const win = dom.window as unknown as Window;
        const history = fromBrowserNative({window: win});
        const spy = vi.fn();
        history.listen(spy);

        try {
            history.push('/a');
            expect(spy).toHaveBeenCalled();

            history.dispose?.();
            spy.mockClear();

            // The adaptor no longer forwards its own navigation ...
            history.push('/b');
            expect(spy).not.toHaveBeenCalled();
            // ... and a disposed history is a no-op: the URL is left untouched.
            expect(win.location.pathname).toBe('/a');

            // Listening again after dispose is also a no-op.
            const unlisten = history.listen(spy);
            unlisten();
            expect(spy).not.toHaveBeenCalled();

            // ... nor the window's popstate events.
            win.history.back();
            await flush();
            expect(spy).not.toHaveBeenCalled();
        } finally {
            win.close();
        }
    });

    it('throws when there is no browser environment', () => {
        expect(() => fromBrowserNative()).toThrow(
            '[history-adaptor] fromBrowserNative requires a browser environment',
        );
    });

    it('falls back to the global window', () => {
        const dom = new JSDOM('', {url: 'http://localhost/'});
        const win = dom.window as unknown as Window;
        vi.stubGlobal('window', win);

        try {
            const history = fromBrowserNative();
            history.push('/global');
            expect(win.location.pathname).toBe('/global');
            history.dispose?.();
        } finally {
            vi.unstubAllGlobals();
            win.close();
        }
    });

    it('dispose removes the hashchange listener in hash mode', () => {
        const dom = new JSDOM('', {url: 'http://localhost/'});
        const win = dom.window as unknown as Window;
        const history = fromBrowserNative({window: win, hash: true});
        const remove = vi.spyOn(win, 'removeEventListener');

        try {
            history.dispose?.();
            expect(remove).toHaveBeenCalledWith('hashchange', expect.any(Function));
        } finally {
            remove.mockRestore();
            win.close();
        }
    });
});
