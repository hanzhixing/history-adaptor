import '@angular/compiler';
import {APP_BASE_HREF, Location} from '@angular/common';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router, withDisabledInitialNavigation} from '@angular/router';
import {BrowserTestingModule, platformBrowserTesting} from '@angular/platform-browser/testing';

import {fromAngularRouter} from '../../src/helper';

// Real Angular TestBed. This file must run in a DOM environment (jsdom).
TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

export const createAngularHistory = async (initialEntries: string[] = ['/']) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            // Pin the base href so it is not derived from the URL at creation time.
            {provide: APP_BASE_HREF, useValue: '/'},
            provideRouter([{path: '**', children: []}], withDisabledInitialNavigation()),
        ],
    });

    const router = TestBed.inject(Router);
    const location = TestBed.inject(Location);

    const initial = initialEntries[0] ?? '/';
    if (initial !== '/') {
        await router.navigateByUrl(initial);
    }

    const history = fromAngularRouter(router, location);

    return {
        router,
        location,
        history,
        destroy: () => TestBed.resetTestingModule(),
    };
};
