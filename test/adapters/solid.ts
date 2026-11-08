import {createMemoryHistory} from '@solidjs/router';

import {fromSolidRouter} from '../../src/helper';

// Builds a real Solid Router memory history and adapts it with the public helper.
// Tests read `history.get()` to assert against actual Solid Router state.
export const createSolidHistory = (initialEntries: string[] = ['/']) => {
    const history = createMemoryHistory();
    const initial = initialEntries[0] ?? '/';
    if (initial !== '/') {
        history.set({value: initial, replace: true});
    }
    return {history, historyLike: fromSolidRouter(history)};
};
