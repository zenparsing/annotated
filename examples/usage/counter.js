@import '../macros/bound-methods.js';
@import '../macros/observed.js';

class Counter extends HTMLElement {
  //@observed
  _x = 0;

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
