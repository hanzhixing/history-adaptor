const trigger = {
    key: undefined,
    history: undefined,
    method: [],
};

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

const createMethodAdapted = (target, method, others) => (location, state) => {
    target[method](location, state);
    others.forEach(other => {
        other[method](...args);
    });
};

const createMethodSynced = (target, method, others) => (...args) => {
    target[method](...args);
    others.forEach(other => {
        other[method](...args);
    });
};

const createProxyHandlers = others => ({
    get: (target, property, receiver) => {
        switch (property) {
            case 'length':
            case 'index':
            case 'entries': {
                return Reflect.get(target, property, receiver);
            }
            case 'push':
            case 'replace': {
                return createMethodAdapted(target, property, others);
            }
            case 'go':
            case 'goForward':
            case 'goBack': {
                return createMethodSynced(target, property, others);
            }
        };
        return target[property];
    },
});

const wrapProxies = histories => histories.map((current, index) => {
    const others = histories.filter((item, idx) => idx !== index);

    return (new Proxy(current.history, createProxyHandlers(others)));
});

export const connect = originHistories => {
    let histories;

    histories = originHistories.map(origin => {
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

    histories = wrapProxies(histories);

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
