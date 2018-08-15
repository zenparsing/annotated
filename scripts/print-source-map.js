function fromVLQSigned(v) {
  let m = (v & 1) === 1 && v !== 0 ? -1 : 1;
  return m * (v >> 1);
}

const BASE64 = Object.create(null);

(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  '0123456789+/'
).split('').forEach((c, i) => BASE64[c] = i);

function deserializeMappings(map) {
  let list = [];
  let { mappings } = map;
  let offset = 0;
  let line = 0;
  let lastGeneratedColumn = 0;
  let lastSource = 0;
  let lastOriginalLine = 0;
  let lastOriginalColumn = 0;
  let lastName = 0;

  function peek() {
    return offset >= mappings.length ? '' : mappings[offset];
  }

  function endSegment() {
    switch (peek()) {
      case ',':
        offset += 1;
        return true;
      case ';':
      case '':
        return true;
    }

    return false;
  }

  function readVLQ(prev) {
    let v = 0;
    let shift = 0;

    while (true) {
      let char = peek();
      offset += 1;

      let digit = BASE64[char];
      if (digit === undefined) {
        throw new Error(`Invalid base64 char: ${ char }`);
      }

      v += (digit & 0b011111) << shift;
      shift += 5;

      if (!(digit & 0b100000)) {
        break;
      }
    }

    return fromVLQSigned(v) + prev;
  }

  while (offset < mappings.length) {
    if (peek() === ';') {
      offset += 1;
      line += 1;
      lastGeneratedColumn = 0;
      continue;
    }

    lastGeneratedColumn = readVLQ(lastGeneratedColumn);

    let entry = {
      original: { line: null, column: null },
      generated: { line, column: lastGeneratedColumn },
      source: null,
      name: null,
    };

    list.push(entry);

    if (endSegment()) continue;

    lastSource = readVLQ(lastSource);
    entry.source = map.sources[lastSource];

    lastOriginalLine = readVLQ(lastOriginalLine);
    entry.original.line = lastOriginalLine;

    lastOriginalColumn = readVLQ(lastOriginalColumn);
    entry.original.column = lastOriginalColumn;

    if (endSegment()) continue;

    lastName = readVLQ(lastName);
    entry.name = map.names[lastName];
  }

  return list;
}

const { readFileSync } = require('fs');
const { inspect } = require('util');
const path = require('path');

let map = JSON.parse(readFileSync(path.resolve(process.argv[2])));
map.mappings = deserializeMappings(map);

console.log(inspect(map, {
  colors: true,
  depth: 10,
}));
