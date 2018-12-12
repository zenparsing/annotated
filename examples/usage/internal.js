@macro import '../macros/internal.js';

class A {
  @internal _f = 1;

  show() { return `${ this._f }` }
}

class B extends A {
  @internal _x = 0;
  @internal _y = 0;

  constructor() {
    super();

    this._x = 1;
    this._y = 2;
  }

  show() { return `${ super.show() }:${ this._x }:${ this._y }` }
}

console.log(new B().show());
