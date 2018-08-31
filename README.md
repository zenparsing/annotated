# annotated

An experimental JavaScript superset language.

```js
// Import a macro definition
@macro import './http-route-macros';

// Apply a macro to a function
@http.get('/hello')
export function helloWorld(req, res) {
  res.send('hello world');
}
```
