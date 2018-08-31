@macro import '../macros/observed.js';

class C {
  @observed
  data = 1;

  render() {}
}
