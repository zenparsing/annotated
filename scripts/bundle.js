const path = require('path');
const { rollup } = require('rollup');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const { spawnSync } = require('child_process');

spawnSync('git', ['clean', '-dfX', './dist']);

rollup({
  input: path.resolve(__dirname, '../src/index.js'),
  plugins: [resolve(), commonjs()],
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
