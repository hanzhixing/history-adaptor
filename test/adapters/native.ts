import {fromBrowserNative} from '../../src/helper';
import type {HistoryLike} from '../../src/index';

// HTML5 History, bound to an injected window (so each test gets a clean stack).
export const createWindowHistory = (win: Window): HistoryLike => fromBrowserNative({window: win});

// Hash history, bound to an injected window.
export const createHashHistory = (win: Window): HistoryLike =>
    fromBrowserNative({window: win, hash: true});
