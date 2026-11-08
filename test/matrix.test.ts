// @vitest-environment jsdom

import {JSDOM} from 'jsdom';
import {describe, expect, it} from 'vitest';

import type {Adapt, HistoryLike} from '../src/index';
import {connect} from '../src/index';
import {parsePath} from './adapters/location';
import {createHashHistory, createWindowHistory} from './adapters/native';
import {createReactHistory} from './adapters/react';
import {createSolidHistory} from './adapters/solid';
import {createVueHistory} from './adapters/vue';

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

type Kind = 'html5' | 'hash' | 'react' | 'solid' | 'vue';

type Side = {
    kind: Kind;
    history: HistoryLike;
    read(): string;
    destroy(): void;
};

const createSide = (kind: Kind): Side => {
    switch (kind) {
        case 'html5': {
            const dom = new JSDOM('', {url: 'http://localhost/'});
            const win = dom.window as unknown as Window;
            const history = createWindowHistory(win);
            return {
                kind,
                history,
                read: () => win.location.pathname,
                destroy: () => win.close(),
            };
        }
        case 'hash': {
            const dom = new JSDOM('', {url: 'http://localhost/'});
            const win = dom.window as unknown as Window;
            const history = createHashHistory(win);
            return {
                kind,
                history,
                read: () => parsePath(win.location.hash.replace(/^#/, '')).pathname,
                destroy: () => win.close(),
            };
        }
        case 'react': {
            const {router, history} = createReactHistory();
            return {
                kind,
                history,
                read: () => router.state.location.pathname,
                destroy: () => router.dispose(),
            };
        }
        case 'solid': {
            const {history, historyLike} = createSolidHistory();
            return {
                kind,
                history: historyLike,
                read: () => parsePath(history.get()).pathname,
                destroy: () => {},
            };
        }
        case 'vue': {
            const {router, history} = createVueHistory();
            return {
                kind,
                history,
                read: () => router.currentRoute.value.path,
                destroy: () => {},
            };
        }
    }
};

const connectSides = (a: Side, b: Side) =>
    connect([
        {key: 'A', history: a.history, adaptors: [{target: 'B', adapt: createAdaptOf('A')}]},
        {key: 'B', history: b.history, adaptors: [{target: 'A', adapt: createAdaptOf('B')}]},
    ]);

// `html5 <-> hash` is intentionally excluded: both are mutually exclusive
// owners of the browser address bar and cannot coexist on one page.
const pairs: [Kind, Kind][] = [
    ['html5', 'react'],
    ['html5', 'solid'],
    ['html5', 'vue'],
    ['hash', 'react'],
    ['hash', 'solid'],
    ['hash', 'vue'],
    ['react', 'solid'],
    ['react', 'vue'],
    ['solid', 'vue'],
];

describe.each(pairs)('%s <-> %s', (aKind, bKind) => {
    it('propagates push in both directions', async () => {
        const a = createSide(aKind);
        const b = createSide(bKind);
        const [ha, hb] = connectSides(a, b);

        try {
            ha.push('/a1');
            await flush();
            expect(a.read()).toBe('/a1');
            expect(b.read()).toBe('/b1');

            hb.push('/b2');
            await flush();
            expect(b.read()).toBe('/b2');
            expect(a.read()).toBe('/a2');
        } finally {
            a.destroy();
            b.destroy();
        }
    });

    it('propagates replace', async () => {
        const a = createSide(aKind);
        const b = createSide(bKind);
        const [ha] = connectSides(a, b);

        try {
            ha.replace('/a1');
            await flush();
            expect(a.read()).toBe('/a1');
            expect(b.read()).toBe('/b1');
        } finally {
            a.destroy();
            b.destroy();
        }
    });

    it('propagates back and forward with a symmetric stack', async () => {
        const a = createSide(aKind);
        const b = createSide(bKind);
        const [ha] = connectSides(a, b);

        try {
            ha.push('/a1');
            await flush();
            ha.push('/a2');
            await flush();
            expect(a.read()).toBe('/a2');
            expect(b.read()).toBe('/b2');

            ha.back();
            await flush();
            expect(a.read()).toBe('/a1');
            expect(b.read()).toBe('/b1');

            ha.forward();
            await flush();
            expect(a.read()).toBe('/a2');
            expect(b.read()).toBe('/b2');
        } finally {
            a.destroy();
            b.destroy();
        }
    });

    it('does not loop forever on circular rules', async () => {
        const a = createSide(aKind);
        const b = createSide(bKind);
        const [ha] = connectSides(a, b);

        try {
            ha.push('/loop-a');
            await flush();
            expect(a.read()).toBe('/loop-a');
            expect(b.read()).toBe('/loop-b');
        } finally {
            a.destroy();
            b.destroy();
        }
    });
});
