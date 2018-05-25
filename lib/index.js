export const link = (rules, historyA, historyB) => {
    const listenCallbacksA = [];

    const listenA = callback => {
        const listener = historyA;

        const newCallback = (location, action) => {
            console.log('listenA inner fn', location, action);
            callback(location, action);
        };

        return historyA.history.listen(newCallback);
    };

    return {
        [historyA.key]: {
            ...historyA.history,
            listen: listenA,
        },
        [historyB.key]: historyB.history,
    };
};
