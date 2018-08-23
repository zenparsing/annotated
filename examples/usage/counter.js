@import '../macros/bound-methods.js';
@import '../macros/soft-private.js';
@import '../macros/observed.js';
@import '../macros/custom-element.js';

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
