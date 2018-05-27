const matches = (pattern, location) => (pattern === location.pathname);

const createListenHook = (rules, source, target) => (location, action) => {
    if (!['PUSH', 'REPLACE', 'POP'].includes(action)) {
        throw new Error('The action can only be one of PUSH, REPLACE, or POP');
    }

    if (action === 'POP') {
        // console.log(location);
        return;
    }

    const method = action.toLowerCase();

    if (location.state
        && location.state['$history-adaptor']
        && location.state['$history-adaptor'].source !== source.key
       ) {
        return;
    }

    const matched = rules.filter(rule => (
        (rule.from.key === source.key) && matches(rule.from.pattern, location)
    )).map(rule => rule.to.pattern);

    if (matched.length >= 0) {
        target.history[method](
            matched[0],
            {
                ...location.state,
                '$history-adaptor': {
                    source: source.key,
                },
            },
        );
    } else {
        target.history[method]({
            ...target.history.location,
            state: {
                ...target.history.location.state,
                '$history-adaptor': {
                    source: source.key,
                },
            },
        });
    }
};

const createListen = source => {
    const listenCallbacks = [];

    return callback => {
        let listenHook;

        if (listenCallbacks.length > 0) {
            listenHook = listenCallbacks.pop();
            listenHook.unlisten();

            listenCallbacks.forEach(item => {
                item.unlisten();
                item = {
                    unlisten: source.history.listen(item.callback),
                    callback: item.callback,
                };
            });
        }

        listenCallbacks.push({
            unlisten: source.history.listen(callback),
            callback,
        });

        if (listenHook) {
            listenCallbacks.push({
                unlisten: source.history.listen(listenHook.callback),
                callback: listenHook.callback,
            });
        }
    };
};

const createGo = (source, target) => (...args) => {
    source.history.go(...args);
    target.history.go(...args);
};

const createGoForward = (source, target) => () => {
    source.history.goForward();
    target.history.goForward();
};

const createGoBack = (source, target) => () => {
    source.history.goBack();
    target.history.goBack();
};

const createProxyHandler = origin => ({
    get: (target, property, receiver) => {
        if (['length', 'index', 'entries'].includes(property)) {
            return origin.history[property];
        }
        return target[property];
    },
});

export const link = (rules, a, b) => {
    const x = {
        ...a.history,
        listen: createListen(a),
        go: createGo(a, b),
        goForward: createGoForward(a, b),
        goBack: createGoBack(a, b),
    };

    const y = {
        ...b.history,
        listen: createListen(b),
        go: createGo(b, a),
        goForward: createGoForward(b, a),
        goBack: createGoBack(b, a),
    };

    x.listen(createListenHook(rules, a, b));
    y.listen(createListenHook(rules, b, a));

    return {
        [a.key]: new Proxy(x, createProxyHandler(a)),
        [b.key]: new Proxy(y, createProxyHandler(b)),
    };
};
