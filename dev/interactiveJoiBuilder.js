// interactiveJoiBuilder.js
const {
  input,
  confirm,
  select,
  checkbox,
} = require('@inquirer/prompts');
const fs = require('fs');
const path = require('path');

async function interactiveJoiBuilder() {
  console.log('\nJoi Schema Builder\n');

  const schemaName = await input({
    message: 'Schema name (e.g., UserSchema):',
    default: 'MySchema',
  });

  const schema = {};
  console.log('\nAdd fields:\n');

  while (true) {
    const addField = await confirm({
      message: 'Add a field?',
      default: true,
    });
    if (!addField) break;

    const fieldName = await input({
      message: 'Field name:',
      validate: v => v.trim() && !schema[v] ? true : 'Invalid or duplicate name',
    });

    const type = await select({
      message: `Type for "${fieldName}":`,
      choices: [
        { name: 'string', value: 'string' },
        { name: 'number', value: 'number' },
        { name: 'boolean', value: 'boolean' },
        { name: 'date', value: 'date' },
        { name: 'array', value: 'array' },
        { name: 'object', value: 'object' },
        { name: 'any', value: 'any' },
      ],
    });

    const field = { type };

    // Required
    const required = await confirm({ message: 'Required?', default: false });
    if (required) field.required = true;

    // Default
    const hasDefault = await confirm({ message: 'Set default value?', default: false });
    if (hasDefault) {
      if (type === 'boolean') {
        field.default = await confirm({ message: 'Default TRUE?', default: true });
      } else if (type === 'date') {
        const now = await confirm({ message: 'Default to now?', default: true });
        field.default = now ? 'Date.now()' : await input({ message: 'Default value (JS):' });
      } else {
        field.default = await input({ message: 'Default value (JS literal):' });
      }
    }

    // Type-specific rules
    if (type === 'string') {
      const stringRules = await checkbox({
        message: 'String rules:',
        choices: [
          { name: 'email', value: 'email' },
          { name: 'trim', value: 'trim' },
          { name: 'lowercase', value: 'lowercase' },
          { name: 'uppercase', value: 'uppercase' },
          { name: 'alphanum', value: 'alphanum' },
          { name: 'uuid', value: 'uuid' },
        ],
      });
      stringRules.forEach(r => field[r] = true);

      const min = await input({ message: 'Min length (or leave empty):' });
      const max = await input({ message: 'Max length (or leave empty):' });
      if (min) field.min = +min;
      if (max) field.max = +max;

      const hasRegex = await confirm({ message: 'Add regex pattern?', default: false });
      if (hasRegex) {
        const pattern = await input({ message: 'Regex (e.g., ^[a-z]+$):' });
        field.regex = pattern;
      }

      const hasEnum = await confirm({ message: 'Use allowed values (enum)?', default: false });
      if (hasEnum) {
        const values = await input({ message: 'Comma-separated values:' });
        field.enum = values.split(',').map(v => v.trim()).filter(Boolean);
      }
    }

    if (type === 'number') {
      const numberRules = await checkbox({
        message: 'Number rules:',
        choices: [
          { name: 'integer', value: 'integer' },
          { name: 'positive', value: 'positive' },
          { name: 'negative', value: 'negative' },
        ],
      });
      numberRules.forEach(r => field[r] = true);

      const min = await input({ message: 'Min value:' });
      const max = await input({ message: 'Max value:' });
      if (min) field.min = +min;
      if (max) field.max = +max;
    }

    if (type === 'array') {
      const itemType = await select({
        message: 'Array item type:',
        choices: ['string', 'number', 'object', 'any'].map(t => ({ name: t, value: t })),
      });
      field.items = { type: itemType };

      const min = await input({ message: 'Min items:' });
      const max = await input({ message: 'Max items:' });
      if (min) field.min = +min;
      if (max) field.max = +max;

      const unique = await confirm({ message: 'Unique items?', default: false });
      if (unique) field.unique = true;
    }

    if (type === 'object') {
      console.log(`\nDefine nested object for "${fieldName}":\n`);
      field.properties = await buildNestedObject();
    }

    schema[fieldName] = field;
  }

  return { name: schemaName, schema };
}

// Recursive nested object builder
async function buildNestedObject() {
  const props = {};
  while (true) {
    const add = await confirm({ message: 'Add nested field?', default: true });
    if (!add) break;

    const name = await input({ message: 'Field name:' });
    const type = await select({
      message: 'Type:',
      choices: ['string', 'number', 'boolean', 'date', 'array', 'object', 'any'].map(t => ({ name: t, value: t })),
    });

    const field = { type };
    const required = await confirm({ message: 'Required?', default: false });
    if (required) field.required = true;

    if (type === 'string') {
      const rules = await checkbox({
        message: 'Rules:',
        choices: ['email', 'trim', 'lowercase'],
      });
      rules.forEach(r => field[r] = true);
    }

    if (type === 'object') {
      field.properties = await buildNestedObject();
    }

    props[name] = field;
  }
  return props;
}

module.exports = { interactiveJoiBuilder };