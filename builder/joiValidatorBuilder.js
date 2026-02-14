// builder/joiValidatorBuilder.js
const {
  input,
  confirm,
  select,
  checkbox,
} = require('@inquirer/prompts');
const fs = require('fs');
const path = require('path');

async function joiValidatorBuilder(outputDir) {
  console.log('\nJoi Validator Builder (Nested, Refs, Messages, Labels)\n');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  const validatorName = await input({
    message: 'Validator name (e.g., CreateUser, UpdatePost):',
    validate: v => v.trim() ? true : 'Required',
  });

  const schemaDef = {};
  const refs = new Set();

  console.log('\nAdd validation rules:\n');

  while (true) {
    const addMore = await confirm({ message: 'Add another field?', default: true });
    if (!addMore) break;

    const fieldName = await input({
      message: 'Field name:',
      validate: v => v && !schemaDef[v] ? true : 'Invalid or duplicate',
    });

    const type = await select({
      message: `Joi type for "${fieldName}":`,
      choices: [
        'string', 'number', 'boolean', 'date',
        'object', 'array', 'binary', 'any', 'ref'
      ].map(t => ({ name: t, value: t })),
    });

    let rule = type === 'ref' ? null : `Joi.${type}()`;

    // Required / Optional / Forbidden
    const presence = await select({
      message: 'Presence:',
      choices: [
        { name: 'Required', value: 'required' },
        { name: 'Optional', value: 'optional' },
        { name: 'Forbidden', value: 'forbidden' },
        { name: 'Allow null/empty', value: 'allow_null' },
      ],
      default: 'optional',
    });

    if (presence === 'required') rule += `.required()`;
    if (presence === 'forbidden') rule += `.forbidden()`;
    if (presence === 'allow_null') rule += `.allow(null, '')`;

    // Label & Description
    const label = await input({ message: 'Label (for error messages):', default: fieldName });
    if (label) rule += `.label('${label}')`;

    const description = await input({ message: 'Description (optional):' });
    if (description) rule += `.description('${description}')`;

    // Type-specific rules
    if (type === 'string') {
      const opts = await checkbox({
        message: 'String rules:',
        choices: ['email', 'uri', 'uuid', 'lowercase', 'uppercase', 'trim', 'min', 'max', 'length', 'pattern', 'alphanum', 'token'],
      });

      if (opts.includes('email')) rule += `.email({ tlds: { allow: false } })`;
      if (opts.includes('uri')) rule += `.uri()`;
      if (opts.includes('uuid')) rule += `.uuid()`;
      if (opts.includes('lowercase')) rule += `.lowercase()`;
      if (opts.includes('uppercase')) rule += `.uppercase()`;
      if (opts.includes('trim')) rule += `.trim()`;
      if (opts.includes('alphanum')) rule += `.alphanum()`;
      if (opts.includes('token')) rule += `.token()`;

      if (opts.includes('min')) {
        const min = await input({ message: 'Min length:' });
        rule += `.min(${min})`;
      }
      if (opts.includes('max')) {
        const max = await input({ message: 'Max length:' });
        rule += `.max(${max})`;
      }
      if (opts.includes('length')) {
        const len = await input({ message: 'Exact length:' });
        rule += `.length(${len})`;
      }
      if (opts.includes('pattern')) {
        const regex = await input({ message: 'Regex (without //):' });
        rule += `.pattern(new RegExp('${regex}'))`;
      }
    }

    if (type === 'number') {
      const opts = await checkbox({
        message: 'Number rules:',
        choices: ['integer', 'positive', 'min', 'max', 'greater', 'less', 'precision'],
      });
      if (opts.includes('integer')) rule += `.integer()`;
      if (opts.includes('positive')) rule += `.positive()`;
      if (opts.includes('min')) {
        const min = await input({ message: 'Min value:' });
        rule += `.min(${min})`;
      }
      if (opts.includes('max')) {
        const max = await input({ message: 'Max value:' });
        rule += `.max(${max})`;
      }
      if (opts.includes('precision')) {
        const p = await input({ message: 'Precision (decimal places):' });
        rule += `.precision(${p})`;
      }
    }

    if (type === 'array') {
      const itemsType = await select({
        message: 'Array items type:',
        choices: ['string', 'number', 'object', 'ref', 'nested validator'],
      });

      if (itemsType === 'ref') {
        const refKey = await input({ message: 'Ref key (e.g., userId):' });
        refs.add(refKey);
        rule += `.items(Joi.ref('${refKey}'))`;
      } else if (itemsType === 'nested validator') {
        const nested = await buildNestedObject();
        rule += `.items(${nested})`;
      } else {
        rule += `.items(Joi.${itemsType}())`;
      }

      const arrayRules = await checkbox({
        message: 'Array rules:',
        choices: ['min', 'max', 'length', 'unique'],
      });
      if (arrayRules.includes('min')) {
        const min = await input({ message: 'Min items:' });
        rule += `.min(${min})`;
      }
      if (arrayRules.includes('max')) {
        const max = await input({ message: 'Max items:' });
        rule += `.max(${max})`;
      }
      if (arrayRules.includes('unique')) rule += `.unique()`;
    }

    if (type === 'object') {
      const nested = await buildNestedObject();
      rule = nested;
    }

    if (type === 'ref') {
      const refKey = await input({ message: 'Reference key (e.g., user.id):' });
      refs.add(refKey.split('.')[0]);
      rule = `Joi.ref('${refKey}')`;
    }

    // Custom error message
    const customMsg = await input({ message: 'Custom error message (optional):' });
    if (customMsg) rule += `.messages({ 'any.required': '${customMsg}', 'string.base': '${customMsg}' })`;

    schemaDef[fieldName] = rule;
  }

  const code = generateJoiValidatorCode(validatorName, schemaDef, refs);
  const filePath = path.join(outputDir, `${validatorName}.js`);

  fs.writeFileSync(filePath, code, 'utf8');
  console.log(`\nValidator created: ${filePath}\n`);
}

async function buildNestedObject() {
  let code = 'Joi.object({\n';
  while (await confirm({ message: 'Add nested field?', default: true })) {
    const name = await input({ message: 'Field name:' });
    const type = await select({
      message: 'Type:',
      choices: ['string', 'number', 'boolean', 'date', 'array', 'object', 'any'],
    });
    let rule = `Joi.${type}()`;
    if (type === 'array') {
      const itemType = await select({ message: 'Array items:', choices: ['string', 'number', 'object'] });
      rule = `Joi.array().items(Joi.${itemType}())`;
    }
    if (type === 'object') rule = await buildNestedObject();
    code += `      ${name}: ${rule},\n`;
  }
  code += '    })';
  return code;
}

function generateJoiValidatorCode(name, fields, refs) {
  let code = `'use strict';\n`;
  code += `const Joi = require('joi');\n\n`;
  code += `const ${name} = Joi.object({\n`;

  Object.entries(fields).forEach(([field, rule]) => {
    code += `  ${field}: ${rule},\n`;
  });

  code += `});\n\n`;
  code += `module.exports = ${name};\n`;

  return code;
}

module.exports = { joiValidatorBuilder };