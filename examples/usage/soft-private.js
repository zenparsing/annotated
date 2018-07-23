@import '../macros/soft-private.js';

class C {
  _x = 1;

  _y() { console.log(this._x); }

  static _z(a) {
    return '_x' in a;
  }
}
