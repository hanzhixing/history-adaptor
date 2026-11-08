const BASE = 'http://localhost';

export const parsePath = (path: string): {pathname: string; search: string; hash: string} => {
    if (!path) {
        return {pathname: '/', search: '', hash: ''};
    }

    const hashIndex = path.indexOf('#');
    const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
    const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;

    const url = new URL(withoutHash || '/', BASE);
    return {pathname: url.pathname, search: url.search, hash};
};
