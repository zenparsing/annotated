const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

const version = '^0.2.0';
const dir = path.resolve(__dirname, 'bootstrap');
const outDir = path.resolve(__dirname, '../dist');
const outPath = path.resolve(outDir, 'annotated.js');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

if (fs.existsSync(outPath) && !process.argv.includes('--force')) {
  if (!process.argv.includes('--quiet')) {
    console.log(
      'Bundle "annotated.js" already exists in "dist" folder. ' +
      'Use --force option to overwrite.'
    );
  }
  process.exit(0);
}

console.log('\n== Annotated Bootstrap ==\n');
console.log('..Creating temp folder');

rimraf.sync(dir);
fs.mkdirSync(dir);

fs.writeFileSync(
  path.resolve(dir, 'package.json'),
  JSON.stringify({
    dependencies: {
      'annotated': version,
    },
  }),
  { encoding: 'utf8' }
);

console.log(`..Installing annotated@${ version }\n`);

let result = spawnSync('npm', ['install'], {
  env: process.env,
  stdio: 'inherit',
  cwd: dir,
  shell: true,
});

if (result.error) {
  throw result.error;
}

console.log('..Copying bundle to dist/');

// Copy bundled file into dist folder
fs.copyFileSync(
  path.resolve(dir, 'node_modules/annotated/dist/annotated.js'),
  outPath
);

console.log('..Clearing temp folder');
rimraf.sync(dir);

console.log('..Done\n');
