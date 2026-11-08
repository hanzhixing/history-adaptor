import {createMemoryRouter, type RouteObject} from 'react-router';

import {fromReactRouter} from '../../src/helper';

// Builds a real React Router data router and adapts it with the public helper.
// Tests read `router.state.location` to assert against actual React Router state.
export const createReactHistory = (
    initialEntries: string[] = ['/'],
    routes: RouteObject[] = [{path: '*'}],
) => {
    const router = createMemoryRouter(routes, {initialEntries});
    return {router, history: fromReactRouter(router)};
};
