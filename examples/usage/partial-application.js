@macro import '../macros/partial-application.js';

function add(a, b) { return a + b; }

const addOne = add($, 1);

export { addOne };
