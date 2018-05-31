# history-adaptor
To use this library you should know

1. What frontend router is.
2. How to use the [history](https://github.com/ReactTraining/history) package.

## Why
1. There are multiple sets of URIs in the real world.
2. You may not able to decide what your URIs in a set should look like.
3. URIs are shared resources among clients. (Considering browser Bookmarks or programs ships your URIs in their code)
4. URIs are references to different app views.
5. The structure of an application could more or less decide what your URIs look like.
6. URIs those reflect app structure are not always able to affect your browser address bar.
7. The structure of an application may change frequently, which may cause routes change as well.
8. We may integrate with multiple sub applications, and the routes of them may have already been hardcoded.
9. Do you want to keep the paths in the routes always clean?

## Solution
Seperate different sets of URIs and connect them with others loosly, by following the desired rules.

## Installation
```bash
npm install --save history-adaptor
```

## How to use

### 1. define mapping table (not required)
```javascript
const rules = [
    {from: {key: 'Portal', pattern: '/webapp/main/blog/home'}, to: {key: 'Blog', pattern: '/news'}},
    {from: {key: 'Portal', pattern: '/webapp/main/blog'}, to: {key: 'Blog', pattern: '/main'}},
    {from: {key: 'Portal', pattern: '/webapp/main/blog/tags'}, to: {key: 'B', pattern: '/tags'}},
    {from: {key: 'Blog', pattern: '/news'}, to: {key: 'Portal', pattern: '/webapp/main/blog/home'}},
    {from: {key: 'Blog', pattern: '/post/11'}, to: {key: 'Portal', pattern: '/webapp/main/blog/post?id=11'}},
];
```

### 2. create your own url mapping function (implement the logic by yourself)
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

### 3. connect the histories with your adapting function
```javascript
// I believe you don't want to connect multiple BrowserHistories, or multiple HashHistories with each other.
// They munipulates the same thing -> The browser address bar.
// You can, but you should not.
import createBrowserHistory from 'history/createBrowserHistory';
import createMemoryHistory from 'history/createMemoryHistory';
import {connect} from 'history-adaptor';

const [portalHistory, blogHistory] = connect(          // The order remain the same.
    [
        {
            key: 'Portal',                          // Define a key for your source history
            history: [createBrowserHistory, {}],    // You can also provide a history instance instead of the array.
            adaptors: [                             // Provide the targets to which your URIs adapting to.
                {
                    target: 'Blog',                 // Define a key for your target history
                    adapt: createAdaptOf('Portal'), // fn: (location) => (location)
                    // Pure function which accept a location-like object(or string) then return a new one.
                    // See history.push(...) on the manual page of 'history' package.
                },
            ],
        },
        {
            key: 'Blog',
            history: [createMemoryHistory, {}],
            adaptors: [
                {
                    target: 'Portal',
                    adapt: createAdaptOf('Blog'),
                },
            ],
        },
        // You can provide more ones
    ],
);
```

### 4. use the histories like you did it before
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
const Blog = (
  <Router history={blogHistory}>
    <div>
      <nav>
        <ul>
          <li><Link to="/">Main</Link></li>
          <li><Link to="/news">News</Link></li>
          <li><Link to="/tags">Tags</Link></li>
          <li><Link to="/post/11">One Post</Link></li>
        </ul>
      </nav>

      <Route exact path="/" component={Main}/>
      <Route path="/news" component={News}/>
      <Route path="/tags" component={Tags}/>
      <Route path="/post/:id" component={Post}/>
    </div>
  </Router>
);

const Portal = (
  <Router history={portalHistory}>
    <div>
      <ul>
        <li><Link to="/webpapp/main/home">Home</Link></li>
        <li><Link to="/webpapp/main/blog">Blog Home</Link></li>
      </ul>

      <Route exact path="/webpapp/main/home" component={Home}/>
      <Route path="/webpapp/main/blog" component={Blog}/>
    </div>
  </Router>
);

```
