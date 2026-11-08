import {describe, expect, it} from 'vitest';

import {createAdapt, type Rule} from '../src/helper';

const outerToNestedRules: Rule[] = [
    {from: '/portal/home', to: '/news'},
    {from: '/portal/error/not_found', to: '/404'},
    {from: '/portal/discussion/:discussion_id', to: '/discussion/:discussion_id'},
    {from: '/portal/user/:user_id', to: '/user/:user_id'},
    {
        from: /^\/portal\/articles\?user_id=(?<user_id>[^&#]*)&category_id=(?<category_id>[^&#]*)&keyword=(?<keyword>[^&#]*)#(?<comments>[^#]*)$/,
        to: '/user/$<user_id>/post?category=$<category_id>&keyword=$<keyword>#$<comments>',
    },
    {from: '/portal/friend{?user_id,group}{#hash}', to: '/user/{user_id}/friend{?group}{#hash}'},
];

const nestedToOuterRules: Rule[] = [
    {from: '/news', to: '/portal/home'},
    {from: '/discussion/:discussion_id', to: '/portal/discussion/:discussion_id'},
    {from: '/user/:user_id', to: '/portal/user/:user_id'},
    {
        from: /^\/user\/(?<user_id>[^/?#]+)\/post\?category=(?<category_id>[^&#]*)&keyword=(?<keyword>[^&#]*)#(?<comments>[^#]*)$/,
        to: '/portal/articles?user_id=$<user_id>&category_id=$<category_id>&keyword=$<keyword>#$<comments>',
    },
    {from: '/user/{user_id}/friend{?group}{#hash}', to: '/portal/friend{?user_id,group}{#hash}'},
];

const outerToNested = createAdapt(outerToNestedRules);
const nestedToOuter = createAdapt(nestedToOuterRules);

describe('createAdapt', () => {
    it('replaces literal paths', () => {
        expect(outerToNested('/portal/home')).toBe('/news');
        expect(outerToNested('/portal/error/not_found')).toBe('/404');
        expect(nestedToOuter('/news')).toBe('/portal/home');
    });

    it('keeps path-to-regexp params', () => {
        expect(outerToNested('/portal/discussion/42')).toBe('/discussion/42');
        expect(outerToNested('/portal/user/alice')).toBe('/user/alice');
        expect(nestedToOuter('/discussion/42')).toBe('/portal/discussion/42');
        expect(nestedToOuter('/user/alice')).toBe('/portal/user/alice');
    });

    it('handles RegExp rules with named groups', () => {
        expect(
            outerToNested(
                '/portal/articles?user_id=alice&category_id=tech&keyword=router#comments',
            ),
        ).toBe('/user/alice/post?category=tech&keyword=router#comments');

        expect(
            nestedToOuter('/user/alice/post?category=tech&keyword=router#comments'),
        ).toBe('/portal/articles?user_id=alice&category_id=tech&keyword=router#comments');
    });

    it('handles RFC 6570 URI templates', () => {
        expect(outerToNested('/portal/friend?user_id=alice&group=dev#top')).toBe(
            '/user/alice/friend?group=dev#top',
        );
        expect(nestedToOuter('/user/alice/friend?group=dev#top')).toBe(
            '/portal/friend?user_id=alice&group=dev#top',
        );
    });

    it('stops propagation when no rule matches', () => {
        expect(outerToNested('/portal/unknown')).toBeUndefined();
        expect(nestedToOuter('/404')).toBeUndefined();
    });

    it('accepts a partial location object', () => {
        expect(outerToNested({pathname: '/portal/discussion/7'})).toBe('/discussion/7');
    });

    it('does not leak RegExp state between calls', () => {
        const adapt = createAdapt([
            {from: /^\/a\/(?<id>\d+)$/g, to: '/b/$<id>'},
        ]);
        expect(adapt('/a/1')).toBe('/b/1');
        expect(adapt('/a/2')).toBe('/b/2');
    });
});
