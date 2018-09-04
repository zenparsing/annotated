const path = require('path');
const { rollup } = require('rollup');
const resolve = require('rollup-plugin-node-resolve');
const { createFilter } = require('rollup-pluginutils');
const { spawnSync } = require('child_process');

spawnSync('git', ['clean', '-dfX', './dist']);

rollup({
  input: path.resolve(__dirname, '../src/index.js'),
  plugins: [
    resolve(),
    annotatedPlugin({ include: 'src/**' }),
  ],
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

function annotatedPlugin(options = {}) {
  let filter = createFilter(options.include, options.exclude);

  return {
    name: 'annotated',
    transform(code, id) {
      return null;
      /*
      if (!filter(id)) {
        return null;
      }

      let result = expandMacros(code, {
        location: id,
        macros: options.macros,
        sourceMap: options.sourceMap !== false,
      });

      return {
        code: result.output,
        map: result.sourceMap,
      };
      */
    },
  };
}
