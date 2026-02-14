// validateJsConfig.js
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const estraverse = require('estraverse');
const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Validate JS config file against JSON schema
 * @param {string} filePath - Path to .js config file
 * @param {Object} schema - JSON schema for validation
 * @returns {Object} { valid: boolean, errors: Array }
 */
function validateJsConfig(filePath, schema) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      return {
        valid: false,
        errors: [{ message: `File not found: ${fullPath}` }]
      };
    }

    // Step 1: Extract settings object from JS
    const settings = extractSettingsFromJs(fullPath);
    if (!settings) {
      return {
        valid: false,
        errors: [{ message: 'Could not parse module.exports.settings' }]
      };
    }

    // Step 2: Validate with AJV
    const validate = ajv.compile(schema);
    const valid = validate(settings);

    if (!valid) {
      const errors = validate.errors.map(err => ({
        path: err.instancePath || err.dataPath,
        message: err.message,
        value: getValueByPath(settings, err.instancePath.replace(/^\//, '').replace(/\//g, '.')),
        expected: err.params
      }));
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };

  } catch (err) {
    return {
      valid: false,
      errors: [{ message: `Parse error: ${err.message}` }]
    };
  }
}

// ── Extract settings from JS file (safe)
function extractSettingsFromJs(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
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
        this.break();
      }
    }
  });

  return settingsValue;
}

// ── Convert AST ObjectExpression → JS Object
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
        obj[key] = valueNode.elements
          .filter(el => el.type === 'Literal')
          .map(el => el.value);
        break;
      case 'ObjectExpression':
        obj[key] = evaluateObjectExpression(valueNode);
        break;
      default:
        obj[key] = null;
    }
  }
  return obj;
}

// ── Helper: Get nested value by dot path
function getValueByPath(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
}

// ── Export
module.exports = { validateJsConfig };