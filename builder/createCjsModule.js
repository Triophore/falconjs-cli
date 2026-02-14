const fs = require('fs');
const path = require('path');

/**
 * Create a CJS module from data that may include raw JS expressions
 * @param {string} filePath
 * @param {Object} data - Can include strings starting with 'JS:' for raw code
 * @param {Object} options
 */
async function createCjsModule(filePath, data, options = {}) {
  const {
    exportStyle = 'default',
    functionName = 'getValue',
    pretty = true,
    async = false,
    imports = false
  } = options;

  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });

  let content = '';

  // Helper: convert value to JS source string
  function toSource(value, indent = '  ') {
    // Special case: raw JS code via prefix
    if (typeof value === 'string' && value.startsWith('JS:')) {
      const rawCode = value.slice(3).trim();
      return rawCode;
    }

    // Functions: preserve source if possible
    if (typeof value === 'function') {
      const funcStr = value.toString();
      return pretty ? funcStr.split('\n').map(line => indent + line).join('\n') : funcStr;
    }

    // Objects/Arrays: recursive
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        const items = value.map(v => toSource(v, indent + '  '));
        return `[\n${indent}  ${items.join(`,\n${indent}  `)}\n${indent}]`;
      } else {
        const entries = Object.entries(value)
          .map(([k, v]) => `${indent}  ${JSON.stringify(k)}: ${toSource(v, indent + '  ')}`);
        return `{\n${entries.join(`,\n`)}\n${indent}}`;
      }
    }

    // Primitives
    return JSON.stringify(value);
  }

  const dataSource = toSource(data, '');

  switch (exportStyle) {
    case 'default':
      content = `module.exports.${functionName} = ${dataSource};\n`;
      break;

    case 'named':
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('Named exports require a plain object');
      }
      const namedLines = Object.entries(data)
        .filter(([_, v]) => !v?.toString().startsWith?.('function')) // skip functions for now
        .map(([key, value]) => {
          const src = toSource(value, '');
          return `exports.${key} = ${src};`;
        });
      content = namedLines.join('\n') + '\n';
      break;

    case 'function':
      const asyncKw = async ? 'async ' : '';
      const returnVal = async ? `Promise.resolve(${dataSource})` : dataSource;
      content = `module.exports.${functionName} = ${asyncKw}() => ${returnVal};\n`;
      break;

    default:
      throw new Error(`Invalid exportStyle: ${exportStyle}`);
  }

  if (imports) {
    await fs.promises.appendFile(filePath, imports, 'utf8');
    await fs.promises.appendFile(filePath, content, 'utf8');
  } else {
    await fs.promises.writeFile(filePath, content, 'utf8');
    return path.resolve(filePath);
  }


}

module.exports = { createCjsModule };