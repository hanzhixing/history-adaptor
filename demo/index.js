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

historyA.listen((location, action) => console.log('historyA listen callback1'));
historyA.listen((location, action) => console.log('historyA listen callback2'));
historyA.listen((location, action) => console.log('historyA listen callback3'));

historyB.listen((location, action) => console.log('outer', location, action));

historyA.push('/123');
historyA.push('/456');

historyB.push('/yyy');
