// interactiveModelBuilder.js
const {
  input,
  confirm,
  select,
  checkbox,
} = require('@inquirer/prompts');
const fs = require('fs');
const path = require('path');

async function interactiveModelBuilder() {
  console.log('\nUnified Model Builder (Mongoose / Sequelize / Joi)\n');

  // ── 1. Database Type
  const dbType = await select({
    message: 'Choose database:',
    choices: [
      { name: 'MongoDB (Mongoose)', value: 'mongodb' },
      { name: 'SQL (Sequelize)', value: 'sequelize' },
    ],
  });

  // ── 2. Model Name
  const modelName = await input({
    message: 'Model name (e.g., User):',
    validate: v => v.trim() ? true : 'Required',
  });

  const tableName = dbType === 'sequelize' ? await input({
    message: 'Table name (or Enter for default):',
    default: modelName.toLowerCase() + 's',
  }) : undefined;

  const schema = {};
  const joiRules = {};
  const associations = [];
  const options = { timestamps: true };

  if (dbType === 'sequelize') {
    options.paranoid = await confirm({ message: 'Enable soft deletes (deletedAt)?', default: false });
  }

  console.log('\nAdd fields:\n');

  // ── 3. Fields
  while (true) {
    const addField = await confirm({ message: 'Add a field?', default: true });
    if (!addField) break;

    const fieldName = await input({
      message: 'Field name:',
      validate: v => v && !schema[v] ? true : 'Invalid/duplicate',
    });

    // Type selection
    const typeChoices = dbType === 'mongodb'
      ? ['string', 'number', 'boolean', 'date', 'objectid', 'array', 'object', 'mixed']
      : ['STRING', 'TEXT', 'INTEGER', 'FLOAT', 'BOOLEAN', 'DATE', 'JSON', 'ARRAY', 'ENUM'];

    const fieldType = await select({
      message: `Type for "${fieldName}":`,
      choices: typeChoices.map(t => ({ name: t, value: t })),
    });

    const field = { type: fieldType };
    const joiField = {};

    // ── Common Options
    const required = await confirm({ message: 'Required?', default: false });
    if (required) {
      field[dbType === 'mongodb' ? 'required' : 'allowNull'] = dbType === 'mongodb' ? true : false;
      joiField.required = true;
    }

    const unique = await confirm({ message: 'Unique?', default: false });
    if (unique) {
      field.unique = true;
      joiField.unique = true;
    }

    // ── Default Value
    const hasDefault = await confirm({ message: 'Set default?', default: false });
    if (hasDefault) {
      if (fieldType.toLowerCase() === 'boolean') {
        const val = await confirm({ message: 'Default TRUE?', default: true });
        field.default = val;
        joiField.default = val;
      } else if (fieldType.toLowerCase().includes('date')) {
        const now = await confirm({ message: 'Default to NOW?', default: true });
        field.default = now ? 'now' : await input({ message: 'Default value:' });
        joiField.default = now ? 'now' : field.default;
      } else {
        const def = await input({ message: 'Default value:' });
        field.default = def;
        joiField.default = def;
      }
    }

    // ── String Options (Mongoose & Sequelize)
    if (fieldType.toLowerCase() === 'string') {
      const stringOpts = await checkbox({
        message: 'String options:',
        choices: ['trim', 'lowercase', 'uppercase', 'email'],
      });
      stringOpts.forEach(opt => {
        if (opt !== 'email') field[opt] = true;
        if (opt === 'email') joiField.email = true;
        if (opt === 'trim') joiField.trim = true;
        if (opt === 'lowercase') joiField.lowercase = true;
      });

      if (dbType === 'sequelize') {
        const len = await input({ message: 'Length (default 255):', default: '255' });
        if (len !== '255') field.type = `STRING(${len})`;
      }
    }

    // ── Number/Date Min/Max
    if (['number', 'integer', 'float', 'date'].includes(fieldType.toLowerCase())) {
      const min = await input({ message: 'Min value (or leave empty):' });
      const max = await input({ message: 'Max value (or leave empty):' });
      if (min) { field.min = +min; joiField.min = +min; }
      if (max) { field.max = +max; joiField.max = +max; }
    }

    // ── Enum
    if (fieldType.toUpperCase() === 'ENUM') {
      const values = await input({ message: 'Comma-separated values:' });
      const vals = values.split(',').map(v => v.trim()).filter(Boolean);
      field.values = vals;
      joiField.enum = vals;
    }

    // ── Array
    if (fieldType.toLowerCase() === 'array') {
      const itemType = await select({
        message: 'Array item type:',
        choices: dbType === 'mongodb'
          ? ['string', 'number', 'object', 'objectid']
          : ['STRING', 'INTEGER', 'FLOAT'],
      });
      field.items = { type: itemType };
      joiField.items = { type: itemType.toLowerCase() };
    }

    // ── Nested Object
    if (fieldType.toLowerCase() === 'object') {
      field.properties = await buildNestedObject(dbType);
      joiField.properties = await buildNestedJoi();
    }

    schema[fieldName] = field;
    joiRules[fieldName] = joiField;
  }

  // ── 4. Associations
  while (true) {
    const addAssoc = await confirm({ message: 'Add association?', default: false });
    if (!addAssoc) break;

    const assocType = await select({
      message: 'Type:',
      choices: dbType === 'mongodb'
        ? ['hasMany', 'belongsTo']
        : ['hasMany', 'belongsTo', 'hasOne'],
    });

    const target = await input({ message: 'Target model:' });
    const fk = await input({ message: 'Foreign key:', default: `${modelName.toLowerCase()}Id` });
    const as = await input({ message: 'Alias (as):', default: target.toLowerCase() });

    associations.push({ type: assocType, targetModel: target, foreignKey: fk, as });
  }

  return {
    name: modelName,
    type: dbType,
    tableName: tableName?.trim(),
    schema,
    joi: joiRules,
    associations,
    options,
  };
}

// Helper: nested object
async function buildNestedObject(dbType) {
  const props = {};
  while (true) {
    const add = await confirm({ message: 'Add property?', default: true });
    if (!add) break;
    const name = await input({ message: 'Name:' });
    const type = await select({
      message: 'Type:',
      choices: dbType === 'mongodb'
        ? ['string', 'number', 'boolean', 'date', 'objectid']
        : ['STRING', 'INTEGER', 'BOOLEAN', 'DATE'],
    });
    props[name] = { type };
  }
  return props;
}

async function buildNestedJoi() {
  const props = {};
  while (true) {
    const add = await confirm({ message: 'Add Joi rule?', default: true });
    if (!add) break;
    const name = await input({ message: 'Field name:' });
    props[name] = { type: 'string' }; // simplified
  }
  return props;
}

module.exports = { interactiveModelBuilder };