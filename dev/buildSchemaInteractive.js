// buildSchemaInteractive.js
const {
  input,
  confirm,
  select,
  checkbox,
  rawlist,
} = require('@inquirer/prompts');

/**
 * Interactive function to build Mongoose JSON schema
 * @returns {Promise<Object>} Final schema JSON
 */
async function buildMongooseSchemaInteractive() {
  console.log('\nMongoose Schema Builder\n'.bold);

  // 1. Model Name
  const modelName = await input({
    message: 'Model name (e.g., User, Product):',
    validate: (v) => v.trim() ? true : 'Model name is required',
  });

  // 2. Options
  const useTimestamps = await confirm({
    message: 'Add timestamps (createdAt, updatedAt)?',
    default: true,
  });

  const schema = {};
  const options = { timestamps: useTimestamps };

  console.log('\nAdd fields (one at a time):\n');

  while (true) {
    const addMore = await confirm({
      message: 'Add a new field?',
      default: true,
    });

    if (!addMore) break;

    const fieldName = await input({
      message: 'Field name:',
      validate: (v) => v.trim() && !schema[v] ? true : 'Invalid or duplicate field name',
    });

    const fieldType = await select({
      message: `Type for "${fieldName}":`,
      choices: [
        { name: 'string', value: 'string' },
        { name: 'number', value: 'number' },
        { name: 'boolean', value: 'boolean' },
        { name: 'date', value: 'date' },
        { name: 'objectid', value: 'objectid' },
        { name: 'array', value: 'array' },
        { name: 'object', value: 'object' },
        { name: 'mixed', value: 'mixed' },
      ],
    });

    const field = { type: fieldType };

    // Common options
    const required = await confirm({ message: 'Required?', default: false });
    if (required) field.required = true;

    const unique = await confirm({ message: 'Unique?', default: false });
    if (unique) field.unique = true;

    const index = await confirm({ message: 'Indexed?', default: false });
    if (index) field.index = true;

    // Type-specific
    if (fieldType === 'string') {
      const extras = await checkbox({
        message: 'String options:',
        choices: [
          { name: 'trim', value: 'trim' },
          { name: 'lowercase', value: 'lowercase' },
          { name: 'uppercase', value: 'uppercase' },
        ],
      });
      extras.forEach(opt => field[opt] = true);

      const hasEnum = await confirm({ message: 'Use enum values?', default: false });
      if (hasEnum) {
        const enumStr = await input({ message: 'Comma-separated values (e.g., admin,user,guest):' });
        field.enum = enumStr.split(',').map(v => v.trim()).filter(v => v);
      }
    }

    if (fieldType === 'date' || fieldType === 'number') {
      const hasDefaultNow = await confirm({ message: 'Default to now/current?', default: fieldType === 'date' });
      if (hasDefaultNow) {
        field.default = 'now';
      }
    }

    if (fieldType === 'array') {
      const itemType = await select({
        message: 'Array item type:',
        choices: [
          { name: 'string', value: 'string' },
          { name: 'number', value: 'number' },
          { name: 'boolean', value: 'boolean' },
          { name: 'date', value: 'date' },
          { name: 'objectid', value: 'objectid' },
          { name: 'object', value: 'object' },
        ],
      });

      if (itemType === 'object') {
        console.log(`\nDefine nested object for "${fieldName}[]":\n`);
        const nested = await buildNestedObject();
        field.items = nested;
      } else {
        field.items = { type: itemType };
      }
    }

    if (fieldType === 'object') {
      console.log(`\nDefine nested object for "${fieldName}":\n`);
      field.properties = await buildNestedObject();
    }

    if (fieldType === 'objectid') {
      const ref = await input({ message: 'Reference model (e.g., User):', default: modelName });
      field.ref = ref.trim();
    }

    schema[fieldName] = field;
  }

  return {
    name: modelName,
    type: 'mongodb',
    schema,
    options,
  };
}

// Helper: recursively build nested object
async function buildNestedObject() {
  const props = {};

  while (true) {
    const add = await confirm({ message: 'Add property to this object?', default: true });
    if (!add) break;

    const name = await input({ message: 'Property name:' });
    const type = await select({
      message: 'Type:',
      choices: [
        'string', 'number', 'boolean', 'date', 'objectid', 'array', 'object', 'mixed'
      ].map(t => ({ name: t, value: t })),
    });

    const prop = { type };

    if (type === 'string') {
      const opts = await checkbox({
        message: 'Options:',
        choices: ['required', 'trim', 'lowercase', 'uppercase'],
      });
      opts.forEach(o => prop[o] = true);
    }

    if (['string', 'number', 'date'].includes(type)) {
      const req = await confirm({ message: 'Required?', default: false });
      if (req) prop.required = true;
    }

    if (type === 'array') {
      const itemType = await select({ message: 'Item type:', choices: ['string', 'number', 'object'].map(t => ({ name: t, value: t })) });
      prop.items = itemType === 'object' ? await buildNestedObject() : { type: itemType };
    }

    if (type === 'object') {
      console.log(`\nNested object for "${name}":\n`);
      prop.properties = await buildNestedObject();
    }

    props[name] = prop;
  }

  return props;
}

module.exports = { buildMongooseSchemaInteractive };