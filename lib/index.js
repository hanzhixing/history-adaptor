const createMatch = (rules, source, target) => (path, state) => {
    const matched = rules
        .filter(rule => (
            (rule.from.key === source.key)
            && (rule.from.pattern === path)
        ))
        .map(rule => rule.to.pattern);

    if (matched.length > 0) {
        return matched[0];
    }

    return undefined;
};

const createListenHook = trigger => (rules, source, target) => (location, action) => {
    console.log('trigger.key', trigger.key);

    if (trigger.key !== source.key) {
        return;
    }

    if (!['PUSH', 'REPLACE', 'POP'].includes(action)) {
        throw new Error('The action can only be one of PUSH, REPLACE, or POP');
    }

    if (action === 'POP' || action === 'PUSH' || action === 'REPLACE') {
        return;
    }

    const method = action.toLowerCase();

    const match = createMatch(rules, source, target);

    const found = match(location);

    trigger.key = undefined;
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

const createPush = trigger => (rules, source, target) => (path, state) => {
    trigger.key = source.key;

    source.history.push(path, state);

    const match = createMatch(rules, source, target);

    const found = match(path, state);

    if (found) {
        target.history.push(found, state);
    } else {
        target.history.push(target.history.location);
    }
};

const createReplace = trigger => (rules, source, target) => (path, state) => {
    trigger.key = source.key;

    source.history.replace(path, state);

    const match = createMatch(rules, source, target);

    const found = match(path, state);

    if (found) {
        target.history.replace(found, state);
    } else {
        target.history.replace(target.history.location);
    }
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

const createProxyHandler = trigger => (source, target) => rules => ({
    get: (target, property, receiver) => {
        if (['length', 'index', 'entries'].includes(property)) {
            return source.history[property];
        }
        return target[property];
    },
});

export const connect = originHistories => {
    const histories = originHistories.map(origin => {
        let history;

        if (Array.isArray(origin.history)) {
            const [factory, ...args] = origin.history;

            if (typeof factory !== 'function') {
                throw new Error('[history-adaptor] The first item of the history definition array must be a function!');
            }

            history = factory(...args);
        } else {
            history = origin.history;
        }

        return {
            key: origin.key,
            history,
            adapt: origin.adapt,
        };
    });

    const trigger = {
        key: undefined,
        history: undefined,
        method: [],
    };

    return;
    const x = {
        ...a.history,
        listen: createListen(a),
        push: createPush(trigger)(rules, a, b),
        replace: createReplace(trigger)(rules, a, b),
        go: createGo(a, b),
        goForward: createGoForward(a, b),
        goBack: createGoBack(a, b),
    };

    const y = {
        ...b.history,
        listen: createListen(b),
        push: createPush(trigger)(rules, b, a),
        replace: createReplace(trigger)(rules, b, a),
        go: createGo(b, a),
        goForward: createGoForward(b, a),
        goBack: createGoBack(b, a),
    };

    x.listen(createListenHook(trigger)(rules, a, b));
    y.listen(createListenHook(trigger)(rules, b, a));

    return {
        [a.key]: new Proxy(x, createProxyHandler(trigger)(a, b)(rules)),
        [b.key]: new Proxy(y, createProxyHandler(trigger)(b, a)(rules)),
    };
};
