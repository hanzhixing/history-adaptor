import createBrowserHistory from 'history/createBrowserHistory';
import createMemoryHistory from 'history/createMemoryHistory';
import createHashHistory from 'history/createHashHistory';
import {connect} from './dist';

const sleep = ms => (new Promise(resolve => setTimeout(resolve, ms)));

const rules = [
    // to same path of target
    {from: {key: 'A', pattern: '/123/456'}, to: {key: 'B', pattern: '/abc/def'}},
    {from: {key: 'A', pattern: '/345/678'}, to: {key: 'B', pattern: '/abc/def'}},
    // opposite
    {from: {key: 'B', pattern: '/ijk/lmn'}, to: {key: 'A', pattern: '/456/789'}},
    // maybe infinte
    {from: {key: 'A', pattern: '/777/888'}, to: {key: 'B', pattern: '/xxx/yyy'}},
    {from: {key: 'B', pattern: '/xxx/yyy'}, to: {key: 'A', pattern: '/777/888'}},
];

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

historyA.listen((location, action) => {
    console.log([
        'listenA1',
        location.pathname,
        location.search,
        location.hash,
        action,
        historyA.length,
        historyA.index,
    ].join('    '));
});

historyA.listen((location, action) => {
    console.log([
        'listenA2',
        location.pathname,
        location.search,
        location.hash,
        action,
        historyA.length,
        historyA.index,
    ].join('    '));
});

historyB.listen((location, action) => {
    console.log([
        'listenB1',
        location.pathname,
        location.search,
        location.hash,
        action,
        historyA.length,
        historyA.index,
    ].join('    '));
});

historyB.listen((location, action) => {
    console.log([
        'listenB2',
        location.pathname,
        location.search,
        location.hash,
        action,
        historyA.length,
        historyA.index,
    ].join('    '));
});

const demo = async () => {
    await sleep(200);
    console.log('---');
    console.log("historyA.push('/123/456') expect historyB.push('/abc/def')");
    historyA.push('/123/456');

    await sleep(200);
    console.log('---');
    console.log("historyB.push('/ijk/lmn') expect historyA.push('/456/789')");
    historyB.push('/ijk/lmn');

    await sleep(200);
    console.log('---');
    console.log("historyA.push('/fed/cba') expect no historyB.push");
    historyA.push('/fed/cba');

    await sleep(200);
    console.log('---');
    console.log("historyA.push('/fed/cba?arg1=val1&arg2=val2#the-hash-part') expect 'search' and 'hash'");
    historyA.push('/fed/cba?arg1=val1&arg2=val2#the-hash-part');

    await sleep(200);
    console.log('---');
    console.log("historyA.replace('/345/678') expect historyB.replace('/abc/def')");
    historyA.replace('/345/678');

    await sleep(200);
    console.log('---');
    console.log("historyA.go(-1) expect historyB.go(-1)");
    historyA.go(-1);

    await sleep(200);
    console.log('---');
    console.log("historyA.goForward() expect historyB.goForward()");
    historyA.goForward();

    await sleep(200);
    console.log('---');
    console.log("historyA.goBack() expect historyB.goBack()");
    historyA.goBack();

    await sleep(200);
    console.log('---');
    console.log("historyB.goBack() expect historyA.goBack()");
    historyB.goBack();

    await sleep(200);
    console.log('---');
    console.log("historyB.push('/xxx/yyy') expect historyA.push('/777/888')");
    historyB.push('/xxx/yyy');

    await sleep(200);
    console.log('---');
    console.log("historyB.go(-1) expect historyA.go(-1)");
    historyB.go(-1);
};

demo();
