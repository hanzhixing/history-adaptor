function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

var pops = [];

var createAdaptListener = function createAdaptListener(source, others) {
    return function (location, action) {
        if (action !== 'POP') {
            return;
        }

        if (pops.includes(source.key)) {
            pops = pops.filter(function (pop) {
                return pop !== source.key;
            });
            return;
        }

        createPushOrReplaceOfOthers(source, others)(location);
    };
};

var createPushOrReplaceOfOthers = function createPushOrReplaceOfOthers(source, others) {
    var method = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'push';
    return function (location) {
        others.forEach(function (other) {
            source.adaptors.forEach(function (adaptor) {
                if (adaptor.target !== other.key) {
                    return;
                }
                var targetLocation = adaptor.adapt(location);
                if (!targetLocation) {
                    return;
                }
                other.history[method](targetLocation);
            });
        });
    };
};

var createProxyHandlers = function createProxyHandlers(source, others) {
    return {
        get: function get(target, property, receiver) {
            switch (property) {
                case 'listen':
                    {
                        var listeners = [];

                        return function (fn) {
                            var hasAdaptor = false;

                            // remove adaptor
                            if (listeners.length > 0) {
                                hasAdaptor = true;
                                listeners.pop().unlisten();
                            }

                            // previous ones
                            listeners = listeners.map(function (listener) {
                                listener.unlisten();
                                return {
                                    unlisten: target.listen(listener.fn),
                                    fn: listener.fn
                                };
                            });

                            // new one
                            listeners.push({
                                unlisten: target.listen(fn),
                                fn: fn
                            });

                            if (hasAdaptor) {
                                // adaptor. only if there was a adaptor already
                                var adaptor = createAdaptListener(source, others);

                                listeners.push({
                                    unlisten: target.listen(adaptor),
                                    fn: adaptor
                                });
                            }
                        };
                    }
                case 'push':
                case 'replace':
                    {
                        return function (location, state) {
                            target[property](location, state);
                            createPushOrReplaceOfOthers(source, others, property)(location);
                        };
                    }
                case 'go':
                case 'goForward':
                case 'goBack':
                    {
                        return function () {
                            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                                args[_key] = arguments[_key];
                            }

                            pops.push(source.key) && target[property].apply(target, args);
                            others.forEach(function (other) {
                                var _other$history;

                                pops.push(other.key) && (_other$history = other.history)[property].apply(_other$history, args);
                            });
                        };
                    }
                case 'length':
                case 'index':
                case 'entries':
                default:
                    {
                        return Reflect.get(target, property, receiver);
                    }
            };
        }
    };
};

export var connect = function connect(originHistories) {
    var histories = void 0;

    histories = originHistories.map(function (origin) {
        var history = void 0;

        if (Array.isArray(origin.history)) {
            var _origin$history = _toArray(origin.history),
                factory = _origin$history[0],
                args = _origin$history.slice(1);

            if (typeof factory !== 'function') {
                throw new Error('[history-adaptor] The first item of the history definition array must be a function!');
            }

            history = factory.apply(undefined, _toConsumableArray(args));
        } else {
            history = origin.history;
        }

        return {
            key: origin.key,
            history: history,
            adaptors: origin.adaptors
        };
    });

    histories = histories.map(function (current, index) {
        var others = histories.filter(function (item, idx) {
            return idx !== index;
        });

        var history = new Proxy(current.history, createProxyHandlers(current, others));

        // do initial push in order to trigger others
        if (history.location.pathname !== '/') {
            history.push(history.location.pathname);
        }

        history.listen(createAdaptListener(current, others));

        return history;
    });

    return histories;
};
