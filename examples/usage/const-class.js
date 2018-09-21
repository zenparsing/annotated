@macro import '../macros/const-class.js';

@constClass
class C {}

@constClass
class D {
  constructor() {
    this.x = 1;
  }
}

@constClass
class E extends D {
  constructor() {
    super();
    this.y = 2;
  }
}

let e = new E();
console.log(e);
