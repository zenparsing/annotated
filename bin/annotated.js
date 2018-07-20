#!/usr/bin/env node

const lib = require('../');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  let list = [];
  let map = new Map();
  let key = null;

  for (let part of process.argv.slice(2)) {
    if (part.startsWith('-')) {
      map.set(key = part, undefined);
    } else if (key) {
      map.set(key, part);
      key = null;
    } else {
      list.push(part);
    }
  }

  list.named = map;
  return list;
}

function fail(msg) {
  console.log(typeof msg === 'string' ? new Error(msg) : msg);
  process.exit(1);
}

function run() {
  let args = parseArgs();
  let inPath = args.length > 0 ? args[0].trim() : null;
  let outPath = null;
  let folder = false;
  let options = { createFolder: true };

  if (!inPath) {
    fail('Missing input path');
  }

  inPath = path.resolve(inPath);

  try {
    folder = fs.statSync(inPath).isDirectory();
  } catch (err) {
    fail(`Input path "${ inPath }" not found.`);
  }

  for (let [key, value] of args.named) {
    switch (key) {
      case '--output':
      case '-o':
        outPath = value;
        break;
      case '--modules':
      case '-m':
        options.translateModules = true;
        break;
      case '--sourcemaps':
      case '-s':
        options.sourceMap = value || true;
        break;
    }
  }

  let promise;

  if (!outPath) {
    if (folder) {
      fail('Missing directory output option (--output or -o).');
    }
    promise = lib.expandFileToString(inPath, options).then(console.log);
  } else if (folder) {
    promise = lib.expandFolder(inPath, outPath, options).catch(fail);
  } else {
    promise = lib.expandFile(inPath, outPath, options).catch(fail);
  }

  promise.catch(fail);
}

run();
