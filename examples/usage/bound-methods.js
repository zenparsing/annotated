@macro import '../macros/bound-methods.js';

class C {

  @bound
  method1() {}

  @bound
  [method2]() {}

  @bound
  static method3() {}

}
