module.exports = require('./src/default.js');

function isNodePreload() {
  try {
    return module.parent.id === 'internal/preload';
  } catch (e) {
    return false;
  }
}

if (isNodePreload()) {
  // TODO: Should we attempt to translate stuff in the REPL
  // or expressions on the command line?
  module.exports.registerLoader();
}
