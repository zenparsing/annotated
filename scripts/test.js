const fs = require('fs');
const path = require('path');
const { registerLoader } = require('../src/default.js');

registerLoader();

function visitFiles(dir, cb) {
  dir = path.resolve(__dirname, dir);
  let entries = fs.readdirSync(dir);
  for (let name of entries) {
    let full = path.resolve(dir, name);
    let stat = fs.statSync(full);
    if (stat.isDirectory()) visitFiles(full, cb);
    else cb(full);
  }
}

visitFiles('../test', require);
