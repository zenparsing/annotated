export function generateSourceMap(mappings, options = {}) {
  let names = new Map();
  let sources = new Map();
  let encodedMappings = serializeMappings(mappings, names, sources);

  let map = {
    version: 3,
    sources: [...sources.keys()],
    names: [...names.keys()],
    mappings: encodedMappings,
  };

  options.file && map.file = options.file;
  options.sourceRoot && map.sourceRoot = options.sourceRoot;

  if (options.contents) {
    map.sourcesContent = [...sources.keys()].map(source => {
      let content = options.content[source];
      return typeof content === 'string' ? content : null;
    })
  }

  return map;
}

const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  '0123456789+/'.split('');

function toVLQSigned(v) {
  return v < 0 ? ((-v) << 1) + 1 : (v << 1) + 0;
}

export function encodeVLQ(v) {
  let more = toVLQSigned(v);
  let encoded = '';

  do {
    let digit = more & 0b011111;
    more >>>= 5;
    encoded += BASE64[more ? digit | 0b100000 : digit];
  } while (more);

  return encoded;
}

function optionalStringEqual(a, b) {
  return a === b || (a == null && b == null);
}

function mappingsEqual(a, b) {
  return (
    a.generated.line === b.generated.line &&
    a.generated.column === b.generated.column &&
    a.original.line === b.original.line &&
    a.original.column === b.original.column &&
    optionalStringEqual(a.source, b.source) &&
    optionalStringEqual(a.name, b.name)
  );
}

function serializeMappings(mappings, sources, names) {
  let prevGeneratedLine = 1;
  let prevGeneratedColumn = 0;
  let prevOriginalLine = 0;
  let prevOriginalColumn = 0;
  let prevName = 0;
  let prevSource = 0;
  let result = '';

  for (let i = 0; i < mappings.length; ++i) {
    let mapping = mappings[i];
    let next = '';

    if (mapping.generated.line !== prevGeneratedLine) {
      prevGeneratedColumn = 0;
      while (mapping.generated.line !== prevGeneratedLine) {
        next += ';';
        prevGeneratedLine++;
      }
    } else if (i > 0) {
      if (mappingsEqual(mapping, mappings[i - 1])) {
        continue;
      }
      next += ',';
    }

    // Generated column
    next += encodeVLQ(mapping.generated.column - prevGeneratedColumn);
    prevGeneratedColumn = mapping.generated.column;

    if (mapping.source != null) {
      if (!sources.has(mapping.source)) {
        sources.set(mapping.source, sources.size - 1);
      }

      // Source index
      let sourceIndex = sources.get(mapping.source);
      next += encodeVLQ(sourceIndex - prevSource);
      prevSource = sourceIndex;

      // Original line
      next += encodeVLQ(mapping.original.line - 1 - prevOriginalLine);
      prevOriginalLine = mapping.original.line - 1;

      // Original column
      next += encodeVLQ(mapping.original.column - prevOriginalColumn);
      prevOriginalColumn = mapping.original.column;

      // Identifier name index
      if (mapping.name != null) {
        if (!names.has(mapping.name)) {
          names.set(mapping.name, names.size - 1);
        }
        let nameIndex = names.get(mapping.name);
        next += encodeVLQ(nameIndex - prevName);
        prevName = nameIndex;
      }
    }

    result += next;
  }

  return result;
}
