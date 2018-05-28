import createBrowserHistory from 'history/createBrowserHistory';
import createMemoryHistory from 'history/createMemoryHistory';
import createHashHistory from 'history/createHashHistory';
import {connect} from '../lib';
import rules from './rules';

const createAdaptOf = sourceKey => location => {
    const matched = rules
        .filter(rule => {
            if (rule.from.key === sourceKey) {
                if (typeof location === 'string') {
                    return rule.from.pattern === location;
                }
                return location.pathname && (rule.from.pattern === location.pathname);
            }
            return false;
        })
        .map(rule => rule.to.pattern);

    if (matched.length > 0) {
        return matched[0];
    }

    return undefined;
};

window.addEventListener('popstate', event => {
    console.log('popstate', event.target);
});

const [historyA, historyB] = connect(
    [
        {
            key: 'A',
            history: [createMemoryHistory, {}],
            adaptors: [
                {
                    target: 'B',
                    adapt: createAdaptOf('A'),
                },
            ],
        },
        {
            key: 'B',
            history: [createMemoryHistory, {}],
            adaptors: [
                {
                    target: 'B',
                    adapt: createAdaptOf('A'),
                },
            ],
        },
    ],
);

console.log(historyA, historyB);

console.log('---');

console.log('[A].listen: "[A] 1-> locatin.pathname, action"');
historyA.listen((location, action) => {
    console.log(
        '[A] 1-> ',
        location.pathname,
        action,
        historyA.length,
        historyA.index,
    );
});

console.log('[A].listen: "[A] 2-> locatin.pathname, action"');
historyA.listen((location, action) => {
    console.log(
        '[A] 2-> ',
        location.pathname,
        action,
        historyA.length,
        historyA.index,
    );
});

console.log('[B].listen: "[B] 1-> location.pathname, action"');
historyB.listen((location, action) => {
    console.log(
        '[B] 1-> ',
        location.pathname,
        action,
        historyB.length,
        historyB.index,
    );
});

console.log('[B].listen: "[B] 2-> location.pathname, action"');
historyB.listen((location, action) => {
    console.log(
        '[B] 2-> ',
        location.pathname,
        action,
        historyB.length,
        historyB.index,
    );
});

console.log('---');

console.log('[A].push("/a/1")');
historyA.push('/a/1');

console.log('---');

console.log('[B].push("/b/100")');
historyB.push('/b/100');

console.log('---');

console.log('[A].replace("/a/2")');
historyA.replace('/a/2');

console.log('---');

console.log('[A].push("/a/3")');
historyA.push('/a/3');

console.log('---');

console.log('[A].push("/a/4")');
historyA.push('/a/4');

console.log('---');

console.log('try go(-1)');
historyA.go(-1);

console.log('---');

console.log('try goBack()');
historyA.goBack();

console.log('---');

console.log('try goForward()');
historyA.goForward();

console.log('---');

console.log('try go(-1)');
historyA.go(-1);

console.log('---');

console.log('try go(-1)');
historyA.go(-1);

console.log('---');

console.log('try go(-1)');
historyA.go(-1);

console.log('---');

console.log('[B].push("/b/1")');
historyB.push('/b/1');

console.log('---');

console.log('[B].push("/b/2")');
historyB.push('/b/2');

console.log('---');
