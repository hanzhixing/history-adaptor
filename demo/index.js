import createBrowserHistory from 'history/createBrowserHistory';
import createMemoryHistory from 'history/createMemoryHistory';
import createHashHistory from 'history/createHashHistory';
import {connect} from '../lib';
import rules from './rules';

const createAdapt = (rules = rules) => sourceKey => path => {
    const matched = rules
        .filter(rule => ((rule.from.key === sourceKey) && (rule.from.pattern === path)))
        .map(rule => rule.to.pattern);

    if (matched.length > 0) {
        return matched[0];
    }

    return undefined;
};

window.addEventListener('popstate', event => {
    console.log(event);
});

const [historyA, historyB] = connect(
    [
        {
            key: 'A',
            history: [createMemoryHistory, {}],
            adapt: [
                createAdapt(rules)('A'),
            ],
        },
    ],
    [
        {
            key: 'B',
            history: [createMemoryHistory, {}],
            adapt: [
                createAdapt(rules)('B'),
            ],
        },
    ],
);

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('[A].listen: "[A] 1-> locatin.pathname, action"');
historyA.listen((location, action) => console.log('[A] 1-> ', location.pathname, action, historyA.length));

console.log('[A].listen: "[A] 2-> locatin.pathname, action"');
historyA.listen((location, action) => console.log('[A] 2-> ', location.pathname, action, historyA.length));

console.log('[B].listen: "[B] 1-> location.pathname, action"');
historyB.listen((location, action) => console.log('[B] 1-> ', location.pathname, action, historyB.length));

console.log('[B].listen: "[B] 2-> location.pathname, action"');
historyB.listen((location, action) => console.log('[B] 2-> ', location.pathname, action, historyB.length));

console.log('---');

console.log('[A].push("/a/1")');
historyA.push('/a/1');

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('[B].push("/b/100")');
historyB.push('/b/100');

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('[A].replace("/a/2")');
historyA.replace('/a/2');

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('[A].push("/a/3")');
historyA.push('/a/3');

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('[A].push("/a/4")');
historyA.push('/a/4');

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('try go(-1)');
historyA.go(-1);

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('try goBack()');
historyA.goBack();

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('try goForward()');
historyA.goForward();

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('try go(-1)');
historyA.go(-1);

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('try go(-1)');
historyA.go(-1);

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('try go(-1)');
historyA.go(-1);

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('[B].push("/b/1")');
historyB.push('/b/1');

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('[B].push("/b/2")');
historyB.push('/b/2');

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');
