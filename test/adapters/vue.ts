import {createMemoryHistory, createRouter, type RouteRecordRaw} from 'vue-router';

import {fromVueRouter} from '../../src/helper';

// Builds a real Vue Router and adapts it with the public helper.
// Tests read `router.currentRoute.value.path` to assert against actual Vue state.
export const createVueHistory = (
    initialEntries: string[] = ['/'],
    routes: RouteRecordRaw[] = [{path: '/:pathMatch(.*)*', component: {}}],
) => {
    const router = createRouter({history: createMemoryHistory(), routes});
    if (initialEntries[0] && initialEntries[0] !== '/') {
        void router.push(initialEntries[0]);
    }
    return {router, history: fromVueRouter(router)};
};
