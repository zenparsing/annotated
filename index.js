module.exports = require('./src/default.js');

function isNodePreload() {
  try {
    return module.parent.id === 'internal/preload';
  } catch (e) {
    return false;
  }
}
