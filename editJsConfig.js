// editJsConfig.js
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const estraverse = require('estraverse');
const escodegen = require('escodegen');

/**
 * READ: Get the current settings object from JS file
 * @param {string} filePath
 * @returns {Object} settings object
 */
function getJsConfigProperties(filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  const code = fs.readFileSync(fullPath, 'utf8');
  const ast = acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
  });

  let settingsValue = null;

  estraverse.traverse(ast, {
    enter(node) {
      if (
        node.type === 'AssignmentExpression' &&
        node.left.type === 'MemberExpression' &&
        node.left.object.name === 'module' &&
        node.left.property.name === 'exports' &&
        node.right.type === 'MemberExpression' &&
        node.right.property.name === 'settings'
      ) {
        settingsValue = evaluateObjectExpression(node.right.object);
        this.break(); // Stop traversal
      }
    }
  });

  if (settingsValue === null) {
    throw new Error('Could not find module.exports.settings');
  }

  return settingsValue;
}

/**
 * EDIT: Edit a nested property and save file
 * @param {string} filePath
 * @param {string} propPath - e.g., 'crud.exclude', 'routes'
 * @param {any} newValue
 * @returns {boolean}
 */
function editJsConfig(filePath, propPath, newValue) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const code = fs.readFileSync(fullPath, 'utf8');
    const ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    });

    let modified = false;
    const pathParts = propPath.split('.');

    estraverse.traverse(ast, {
      enter(node) {
        if (
          node.type === 'AssignmentExpression' &&
          node.left.type === 'MemberExpression' &&
          node.left.object.name === 'module' &&
          node.left.property.name === 'exports' &&
          node.right.type === 'MemberExpression' &&
          node.right.property.name === 'settings'
        ) {
          modified = editNestedProperty(node.right.object, pathParts, newValue);
        }
      }
    });

    if (!modified) {
      throw new Error(`Property "${propPath}" not found`);
    }

    const newCode = escodegen.generate(ast, {
      format: {
        indent: { style: '    ' },
        newline: '\n',
        quotes: 'double',
        semicolons: true,
      },
    });

    fs.writeFileSync(fullPath, newCode, 'utf8');
    console.log(`Updated: ${propPath}`);
    return true;
  } catch (err) {
    console.error('Edit error:', err.message);
    return false;
  }
}

// ── Helper: Evaluate ObjectExpression → JS Object
function evaluateObjectExpression(node) {
  if (node.type !== 'ObjectExpression') return null;

  const obj = {};
  for (const prop of node.properties) {
    if (prop.type !== 'Property' || prop.key.type !== 'Identifier') continue;

    const key = prop.key.name;
    const valueNode = prop.value;

    switch (valueNode.type) {
      case 'Literal':
        obj[key] = valueNode.value;
        break;
      case 'ArrayExpression':
        obj[key] = valueNode.elements.map(el => el.type === 'Literal' ? el.value : null);
        break;
      case 'ObjectExpression':
        obj[key] = evaluateObjectExpression(valueNode);
        break;
      default:
        obj[key] = null; // Unsupported
    }
  }
  return obj;
}

// ── Helper: Edit nested property in AST
function editNestedProperty(node, pathParts, newValue) {
  if (pathParts.length === 0 || node.type !== 'ObjectExpression') return false;

  const currentKey = pathParts[0];

  for (const prop of node.properties) {
    if (
      prop.type === 'Property' &&
      prop.key.type === 'Identifier' &&
      prop.key.name === currentKey
    ) {
      if (pathParts.length === 1) {
        prop.value = createLiteralNode(newValue);
        return true;
      } else {
        return editNestedProperty(prop.value, pathParts.slice(1), newValue);
      }
    }
  }
  return false;
}

// ── Helper: Convert JS value → AST node
function createLiteralNode(value) {
  if (Array.isArray(value)) {
    return {
      type: 'ArrayExpression',
      elements: value.map(v => createLiteralNode(v)),
    };
  }
  if (value === null || typeof value !== 'object') {
    return { type: 'Literal', value };
  }
  return {
    type: 'ObjectExpression',
    properties: Object.entries(value).map(([k, v]) => ({
      type: 'Property',
      key: { type: 'Identifier', name: k },
      value: createLiteralNode(v),
      kind: 'init',
    })),
  };
}

module.exports = {
  getJsConfigProperties,
  editJsConfig,
};