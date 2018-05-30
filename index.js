let pops = [];

const createAdaptListener = (source, others) => (location, action) => {
    if (action !== 'POP') {
        return;
    }

    if (pops.includes(source.key)) {
        pops = pops.filter(pop => pop !== source.key);
        return;
    }

    createPushOrReplaceOfOthers(source, others)(location);
};

const createPushOrReplaceOfOthers = (source, others, method = 'push') => location => {
    others.forEach(other => {
        source.adaptors.forEach(adaptor => {
            if (adaptor.target !== other.key) {
                return;
            }
            const targetLocation = adaptor.adapt(location);
            if (!targetLocation) {
                return;
            }
            other.history[method](targetLocation);
        });
    });
};

const createProxyHandlers = (source, others) => ({
    get: (target, property, receiver) => {
        switch (property) {
            case 'listen': {
                let listeners = [];

                return fn => {
                    let hasAdaptor = false;

                    // remove adaptor
                    if (listeners.length > 0) {
                        hasAdaptor = true;
                        listeners.pop().unlisten();
                    }

                    // previous ones
                    listeners = listeners.map(listener => {
                        listener.unlisten();
                        return {
                            unlisten: target.listen(listener.fn),
                            fn: listener.fn,
                        };
                    });

                    // new one
                    listeners.push({
                        unlisten: target.listen(fn),
                        fn,
                    });

                    if (hasAdaptor) {
                        // adaptor. only if there was a adaptor already
                        const adaptor = createAdaptListener(source, others);

                        listeners.push({
                            unlisten: target.listen(adaptor),
                            fn: adaptor,
                        });
                    }
                };
            }
            case 'push':
            case 'replace': {
                return (location, state) => {
                    target[property](location, state);
                    createPushOrReplaceOfOthers(source, others, property)(location);
                };
            }
            case 'go':
            case 'goForward':
            case 'goBack': {
                return (...args) => {
                    pops.push(source.key) && target[property](...args);
                    others.forEach(other => {
                        pops.push(other.key) && other.history[property](...args);
                    });
                };
            }
            case 'length':
            case 'index':
            case 'entries':
            default: {
                return Reflect.get(target, property, receiver);
            }
        };
    },
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
            adaptors: origin.adaptors,
        };
    });

    histories = histories.map((current, index) => {
        const others = histories.filter((item, idx) => idx !== index);

        const history = new Proxy(current.history, createProxyHandlers(current, others));

        // do initial push in order to trigger others
        if (history.location.pathname !== '/') {
            history.push(history.location.pathname);
        }

        history.listen(createAdaptListener(current, others));

        return history;
    });

    return histories;
};
