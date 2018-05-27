const listenCallbacks = {};

const matches = (pattern, location) => (pattern === location.pathname);

const createListenHooker = stack => (rules, source, target) => (location, action) => {
    callStack(stack)(location, action);

    const triggerTarget = (location, action) => {
        if (action !== 'PUSH') {
            return;
        }

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
            target.history.push(
                matched[0],
                {
                    ...location.state,
                    '$history-adaptor': {
                        source: source.key,
                    },
                },
            );
        } else {
            target.history.push({
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

const createGoBack = (source, target) => (s) => {
    source.history.goBack();
    target.history.goBack();
};

const createProxyHandler = origin => ({
    set: (target, property, value, receiver) => {
        if (property === 'length') {
            console.log('set', value);
        }
        return target[property];
    },
    get: (target, property, receiver) => {
        console.log('get', property);
        if (property === 'length') {
            return origin.history.length;
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

    return {
        [a.key]: {
            ...a.history,
            listen: appendListenCallback(listenCallbacks[a.key]),
            go: createGo(a, b),
            goForward: createGoForward(a, b),
            goBack: createGo(a, b),
        },
        [b.key]: {
            ...b.history,
            listen: appendListenCallback(listenCallbacks[b.key]),
            go: createGo(b, a),
            goForward: createGoForward(b, a),
            goBack: createGoBack(b, a),
        },
    };
};
