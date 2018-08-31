@macro import '../macros/soft-private.js';

export class C {
  //_x = 1;

  constructor() {
    this._x = 1;
  }

  getX() { return this._x = 1 }

  _y() { console.log(this._x); }

  static _z(a) {
    return '_x' in a;
  }
}
