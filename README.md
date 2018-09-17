# annotated

An experimental JavaScript superset language supporting annotations and macros.

```js
// Import a macro definition
@macro import './custom-element-macros';


// Apply a macro to a class
@customElement('hello-world')
class HelloWorld extends HTMLElement {
  connectedCallback() {
    this.textContent = 'hello world';
  }
}
```
