@macro import '../macros/frozen.js';

@frozen class C {}

@frozen class D {
  constructor() {
    this.x = 1;
  }
}

@frozen class E extends D {
  constructor() {
    super();
    this.y = 2;
  }
}

let e = new E();
console.log(e);
