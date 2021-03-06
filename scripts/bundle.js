const path = require('path');
const { rollup } = require('rollup');
const resolve = require('rollup-plugin-node-resolve');

rollup({
  input: path.resolve(__dirname, '../src/index.js'),
  plugins: [resolve()],
  external: ['path', 'fs', 'module'],
}).then(bundle => {
  return bundle.write({
    file: path.resolve(__dirname, '../dist/annotated.js'),
    format: 'cjs',
  });
}).catch(err => {
  console.log(err);
  process.exit(1);
});
