@macro import '../macros/bound-methods.js';
@macro import '../macros/symbol-names.js';
@macro import '../macros/observed.js';
@macro import '../macros/custom-element.js';

@customElement('my-counter')
class Counter extends HTMLElement {
  @observed _x = 0;

  @bound
  _clicked() {
    this._x++;
  }

  constructor() {
    super();
    this.onclick = this._clicked;
  }

  connectedCallback() { this.render(); }

  @bound
  render() {
    this.textContent = this._x.toString();
  }
}
