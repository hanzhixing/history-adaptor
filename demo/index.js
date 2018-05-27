import createBrowserHistory from 'history/createBrowserHistory';
import createMemoryHistory from 'history/createMemoryHistory';
import createHashHistory from 'history/createHashHistory';
import {link} from '../lib';
import rules from './rules';

let historyA = createMemoryHistory();
let historyB = createMemoryHistory();

console.log(historyA);
console.log(historyB);

// const [
//     linkedHistoryA,
//     linkedHistoryB,
// ] = link(
//     [
//         {key: 'A', history: historyA},
//         {key: 'B', history: historyB},
//     ]
//     , rules,
// );

const linked = link(
    rules,
    {key: 'A', history: historyA},
    {key: 'B', history: historyB},
);

historyA = linked['A'];
historyB = linked['B'];

console.log(`A (${historyA.index}/${historyA.length})`);
console.log(`B (${historyB.index}/${historyB.length})`);
console.log('---');

console.log('[A].listen: "[A] -> locatin, action"');
historyA.listen((location, action) => console.log('[A] -> ', location, action));

console.log('[B].listen: "[B] -> location, action"');
historyB.listen((location, action) => console.log('[B] -> ', location, action));

console.log('---');

console.log('[A].push("/a/1")');
historyA.push('/a/1');

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
