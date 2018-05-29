import createBrowserHistory from 'history/createBrowserHistory';
import createMemoryHistory from 'history/createMemoryHistory';
import createHashHistory from 'history/createHashHistory';
import {connect} from '../lib';
import rules from './rules';

window.addEventListener('popstate', event => {
    const {pathname, search, hash} = event.target.location;
    console.log('popstate', pathname, search, hash);
});

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
                    target: 'A',
                    adapt: createAdaptOf('B'),
                },
            ],
        },
    ],
);

console.log(historyA, historyB);

console.log('[A].listen1');
historyA.listen((location, action) => {
    console.log(
        '[A] 1-> ',
        location.pathname,
        location.search,
        location.hash,
        action,
        historyA.length,
        historyA.index,
    );
});

console.log('[A].listen2');
historyA.listen((location, action) => {
    console.log(
        '[A] 2-> ',
        location.pathname,
        location.search,
        location.hash,
        action,
        historyA.length,
        historyA.index,
    );
});

console.log('[B].listen1');
historyB.listen((location, action) => {
    console.log(
        '[B] 1-> ',
        location.pathname,
        location.search,
        location.hash,
        action,
        historyB.length,
        historyB.index,
    );
});

console.log('[B].listen2');
historyB.listen((location, action) => {
    console.log(
        '[B] 2-> ',
        location.pathname,
        location.search,
        location.hash,
        action,
        historyB.length,
        historyB.index,
    );
});

window.setTimeout(() => {
    console.log('---');
    console.log('[A].push("/a/1")');
    historyA.push('/a/1');
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('[B].push("/b/1")');
    historyB.push('/b/1');
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('[B].push("/b/100")');
    historyB.push('/b/100');
}, 200);


window.setTimeout(() => {
    console.log('---');
    console.log('[A].replace("/a/2")');
    historyA.replace('/a/2');
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('[A].push("/a/3?x=y#asfadfaa")');
    historyA.push('/a/3?x=y#asfadfaa');
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('[A].push("/a/4")');
    historyA.push('/a/4');
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('try go(-1)');
    historyA.go(-1);
}, 200);


window.setTimeout(() => {
    console.log('---');
    console.log('try goBack()');
    historyA.goBack();
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('try goForward()');
    historyA.goForward();
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('try go(-1)');
    historyA.go(-1);
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('try go(-1)');
    historyA.go(-1);
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('try go(-1)');
    historyA.go(-1);
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('[B].push("/b/1")');
    historyB.push('/b/1');
}, 200);

window.setTimeout(() => {
    console.log('---');
    console.log('[B].push("/b/2")');
    historyB.push('/b/2');
}, 200);
