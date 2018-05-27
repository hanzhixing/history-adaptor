const listenCallbacks = {};

const matches = (pattern, location) => (pattern === location.pathname);

const createListenHooker = stack => (rules, source, target) => (location, action) => {
    callStack(stack)(location, action);

    const triggerTarget = (location, action) => {
        if (!['PUSH', 'REPLACE', 'POP'].includes(action)) {
            throw new Error('The action can only be one of PUSH, REPLACE, or POP');
        }

        if (action === 'POP') {
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

    triggerTarget(location, action);
};

const callStack = stack => (...args) => stack.reduce((acc, cur) => ([
    ...acc,
    cur(...args),
]), []);

const appendListenCallback = stack => callback => stack.push(callback);

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
            if (property === 'index') {
                console.log('origin', origin.history.index, origin.history.length);
            }
            return origin.history[property];
        }
        return target[property];
    },
});

export const link = (rules, a, b) => {
    const listenCallbacks = [a.key, b.key]
          .reduce((acc, cur) => ({
              ...acc,
              [cur]: [],
          }), {});

    a.history.listen(
        createListenHooker(listenCallbacks[a.key])(rules, a, b)
    );

    b.history.listen(
        createListenHooker(listenCallbacks[b.key])(rules, b, a)
    );

    const newA = {
        ...a.history,
        listen: appendListenCallback(listenCallbacks[a.key]),
        go: createGo(a, b),
        goForward: createGoForward(a, b),
        goBack: createGoBack(a, b),
    };

    const newB = {
        ...b.history,
        listen: appendListenCallback(listenCallbacks[b.key]),
        go: createGo(b, a),
        goForward: createGoForward(b, a),
        goBack: createGoBack(b, a),
    };

    return {
        [a.key]: new Proxy(newA, createProxyHandler(a)),
        [b.key]: new Proxy(newB, createProxyHandler(b)),
    };
};
