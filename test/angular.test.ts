// @vitest-environment jsdom

import {describe, expect, it} from 'vitest';

import type {Adapt} from '../src/index';
import {connect} from '../src/index';
import {createAngularHistory} from './adapters/angular';
import {createReactHistory} from './adapters/react';

const flush = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

const rules: Record<string, Record<string, string>> = {
    A: {'/a1': '/b1', '/a2': '/b2'},
    B: {'/b1': '/a1', '/b2': '/a2'},
};

const createAdaptOf =
    (sourceKey: string): Adapt =>
    (location) => {
        const pathname = typeof location === 'string' ? location : (location.pathname ?? '');
        return rules[sourceKey]?.[pathname];
    };

const setup = async (initialA: string[] = ['/']) => {
    const angular = await createAngularHistory(initialA);
    const react = createReactHistory();
    const [ha, hb] = connect([
        {
            key: 'A',
            history: angular.history,
            adaptors: [{target: 'B', adapt: createAdaptOf('A')}],
        },
        {
            key: 'B',
            history: react.history,
            adaptors: [{target: 'A', adapt: createAdaptOf('B')}],
        },
    ]);

    return {
        angular,
        react,
        ha,
        hb,
        destroy: () => {
            angular.destroy();
            react.router.dispose();
        },
    };
};

describe('fromAngularRouter (real TestBed)', () => {
    it('propagates push from Angular to the other side', async () => {
        const {angular, react, ha, destroy} = await setup();
        try {
            ha.push('/a1');
            await flush();

            expect(angular.location.path()).toBe('/a1');
            expect(react.router.state.location.pathname).toBe('/b1');
        } finally {
            destroy();
        }
    });

    it('propagates push from the other side to Angular', async () => {
        const {angular, react, hb, destroy} = await setup();
        try {
            hb.push('/b2');
            await flush();

            expect(react.router.state.location.pathname).toBe('/b2');
            expect(angular.location.path()).toBe('/a2');
        } finally {
            destroy();
        }
    });

    it('propagates replace', async () => {
        const {angular, react, ha, destroy} = await setup();
        try {
            ha.replace('/a1');
            await flush();

            expect(angular.location.path()).toBe('/a1');
            expect(react.router.state.location.pathname).toBe('/b1');
        } finally {
            destroy();
        }
    });

    it('syncs a non-root initial location to the other side', async () => {
        const {angular, react, destroy} = await setup(['/a1']);
        try {
            await flush();

            expect(angular.location.path()).toBe('/a1');
            expect(react.router.state.location.pathname).toBe('/b1');
        } finally {
            destroy();
        }
    });

    it('propagates back and forward', async () => {
        const {angular, react, ha, destroy} = await setup();
        try {
            ha.push('/a1');
            await flush();
            ha.push('/a2');
            await flush();

            ha.back();
            await flush();
            expect(angular.location.path()).toBe('/a1');
            expect(react.router.state.location.pathname).toBe('/b1');

            ha.forward();
            await flush();
            expect(angular.location.path()).toBe('/a2');
            expect(react.router.state.location.pathname).toBe('/b2');
        } finally {
            destroy();
        }
    });

    it('passes state through to the other side', async () => {
        const {react, ha, destroy} = await setup();
        try {
            ha.push('/a1', {token: 'abc'});
            await flush();

            expect(react.router.state.location.state).toEqual({token: 'abc'});
        } finally {
            destroy();
        }
    });

    it('throws on go(n) other than -1 / 1', async () => {
        const angular = await createAngularHistory();
        try {
            expect(() => angular.history.go(2)).toThrow(
                '[history-adaptor] go(n) is not supported for Angular (only -1 / 1)',
            );
        } finally {
            angular.destroy();
        }
    });
});
