# history-adaptor
To use this library, you should know how to use the [history](https://github.com/ReactTraining/history) package.

## Installation
```bash
npm install --save history-adaptor
```

## How to use

### 1. import
```javascript
import createHashHistory from 'history/createBrowserHistory';
import createMemoryHistory from 'history/createMemoryHistory';
import {connect} from 'history-adaptor';
```

### 2. define mapping table
```javascript
const rules = [
    // to same path of target
    {from: {key: 'A', pattern: '/123/456'}, to: {key: 'B', pattern: '/abc/def'}},
    {from: {key: 'A', pattern: '/345/678'}, to: {key: 'B', pattern: '/abc/def'}},
    // opposite
    {from: {key: 'B', pattern: '/ijk/lmn'}, to: {key: 'A', pattern: '/456/789'}},
    // maybe infinte
    {from: {key: 'A', pattern: '/777/888'}, to: {key: 'B', pattern: '/xxx/yyy'}},
    {from: {key: 'B', pattern: '/xxx/yyy'}, to: {key: 'A', pattern: '/777/888'}},
];
```

### 3. create your own url mapping function
```javascript
const createAdaptOf = sourceKey => location => {
    const matched = rules
        .filter(rule => {
            if (rule.from.key === sourceKey) {
                if (typeof location === 'string') {
                    return rule.from.pattern === location;
                }
                return location.pathname && (rule.from.pattern === location.pathname);
            }
            return false;
        })
        .map(rule => rule.to.pattern);

    if (matched.length > 0) {
        return matched[0];
    }

    return undefined;
};
```

### 4. connect the histories with your adapting function
```javascript
const [historyA, historyB] = connect(
    [
        {
            key: 'A',                           // Define a key for your source history
            history: [createMemoryHistory, {}], // You can also provide a history instance instead of the array.
            adaptors: [                         // Provide the targets to which your URIs adapting to.
                {
                    target: 'B',                // Define a key for your target history
                    adapt: createAdaptOf('A'),  // (location) => (location)
                },
            ],
        },
        {
            key: 'B',
            history: [createMemoryHistory, {}],
            adaptors: [
                {
                    target: 'A',
                    adapt: createAdaptOf('B'),
                },
            ],
        },
    ],
);
```

### 5. use the histories like you did it before
```javascript
history.push(...);
history.replace(...);
history.go(n);
history.goForward();
history.goBack();
history.listen(...);
```
or
```javascript
<Router history={history}>
  <App/>
</Router>
```
