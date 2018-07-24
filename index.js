const lib = module.exports = require('./dist/annotated.js');

try {
  // TODO: Should we attempt to translate stuff in the REPL
  // or expressions on the command line?
  if (module.parent && module.parent.id === 'internal/preload') {
    lib.registerLoader();
  }
} catch (e) {}
