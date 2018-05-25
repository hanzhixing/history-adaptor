import createBrowserHistory from 'history/createBrowserHistory';
import createMemoryHistory from 'history/createMemoryHistory';
import createHashHistory from 'history/createHashHistory';
import {link} from '../lib';
import rules from './rules';

let historyA = createMemoryHistory();
let historyB = createMemoryHistory();

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
const listenCallbackStackA = linked.listenCallbackStackA;

console.log('[A].listen: "[A] -> path"');
historyA.listen((location, action) => console.log('[A] -> ', location.pathname));

console.log('[B].listen: "[B] -> path"');
historyB.listen((location, action) => console.log('[B] -> ', location.pathname));

console.log('[A].push("/a/1")');
historyA.push('/a/1');

// console.log('push [/456] to [A]');
// historyA.push('/456');

// console.log('push [/yyy] to [B]');
// historyB.push('/yyy');

console.log(listenCallbackStackA);
