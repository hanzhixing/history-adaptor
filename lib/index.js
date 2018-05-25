const listenCallbackStackA = [];

const matches = (pattern, uri) => (pattern === uri);

const createAutoListenCallBackA = (rules, targetHistory) => stack => (location, action) => {
    const auto = () => {
        const matched = rules
            .filter(rule => (
                (rule.from.key === 'A') && matches(rule.from.pattern, location.pathname)
            ))
            .map(rule => rule.to.pattern);
        if (matched.length > 0) {
            targetHistory.push(matched[0]);
        }
    };

    callStack(stack)(location, action);
    auto(location, action);
};

const callStack = stack => (...args) => stack.reduce((acc, cur) => ([
    ...acc,
    cur(...args),
]), []);

const listenA = callback => listenCallbackStackA.push(callback);

const newCallback = autoListenCallBackA => (...args) => {
    callStack(...args);
    autoListenCallBackA(...args);
};

export const link = (rules, historyA, historyB) => {
    const autoCallbackA = createAutoListenCallBackA(rules, historyB.history);

    historyA.history.listen(autoCallbackA(listenCallbackStackA));

    return {
        [historyA.key]: {
            ...historyA.history,
            listen: listenA,
        },
        [historyB.key]: historyB.history,
        listenCallbackStackA,
    };
};
