// interactiveUnifiedBuilder.js
const {
  input,
  confirm,
  select,
  checkbox,
} = require('@inquirer/prompts');
const fs = require('fs');
const path = require('path');

async function interactiveUnifiedBuilder(baseDir) {
  console.log('\nUnified Model Builder (Mongoose / Sequelize)\n');

  // Ensure base directory exists
  if (!fs.existsSync(baseDir)) {
    console.log(`Creating base directory: ${baseDir}`);
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Define subdirectories
  const mongoDir = path.join(baseDir, 'mongo');
  const sequelizeDir = path.join(baseDir, 'sequelize');

  // Create mongo and sequelize folders if they don't exist
  [mongoDir, sequelizeDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // 1. Choose DB type
  const dbType = await select({
    message: 'Database type:',
    choices: [
      { name: 'MongoDB (Mongoose)', value: 'mongodb' },
      { name: 'SQL (Sequelize)', value: 'sequelize' },
    ],
  });

  const modelName = await input({
    message: 'Model name:',
    validate: v => v.trim() ? true : 'Required',
  });

  const tableName = dbType === 'sequelize' ? await input({
    message: 'Table name (or Enter for default):',
    default: modelName.toLowerCase() + 's',
  }) : undefined;

  const schema = {};
  const associations = [];
  const options = { timestamps: true };

  if (dbType === 'sequelize') {
    options.paranoid = await confirm({ message: 'Enable soft deletes?', default: false });
  }

  // Load models from correct subdir
  const modelsSubDir = dbType === 'mongodb' ? mongoDir : sequelizeDir;
  const availableModels = loadModelsFromDir(modelsSubDir);

  console.log('\nAdd fields:\n');

  while (true) {
    const add = await confirm({ message: 'Add field?', default: true });
    if (!add) break;

    const fieldName = await input({
      message: 'Field name:',
      validate: v => v && !schema[v] ? true : 'Invalid/duplicate',
    });

    const typeChoices = dbType === 'mongodb'
      ? ['string', 'number', 'boolean', 'date', 'objectid', 'array', 'object', 'mixed']
      : ['STRING', 'TEXT', 'INTEGER', 'FLOAT', 'BOOLEAN', 'DATE', 'JSON', 'ARRAY', 'ENUM'];

    const fieldType = await select({
      message: `Type for "${fieldName}":`,
      choices: typeChoices.map(t => ({ name: t, value: t })),
    });

    const field = { type: fieldType };

    const required = await confirm({ message: 'Required?', default: false });
    if (required) {
      field[dbType === 'mongodb' ? 'required' : 'allowNull'] = dbType === 'mongodb' ? true : false;
    }

    const unique = await confirm({ message: 'Unique?', default: false });
    if (unique) field.unique = true;

    const hasDefault = await confirm({ message: 'Set default?', default: false });
    if (hasDefault) {
      if (fieldType.toLowerCase().includes('boolean')) {
        field.default = await confirm({ message: 'Default TRUE?', default: true });
      } else if (fieldType.toLowerCase().includes('date')) {
        field.default = await confirm({ message: 'Default NOW?', default: true }) ? 'now' : await input({ message: 'Default:' });
      } else {
        field.default = await input({ message: 'Default value:' });
      }
    }

    if (fieldType === 'STRING' && dbType === 'sequelize') {
      const len = await input({ message: 'Length (default 255):', default: '255' });
      if (len !== '255') field.type = `STRING(${len})`;
    }

    if (fieldType.toUpperCase() === 'ENUM') {
      const vals = await input({ message: 'Comma-separated values:' });
      field.values = vals.split(',').map(v => v.trim()).filter(Boolean);
    }

    if (fieldType.toLowerCase() === 'array') {
      const itemType = await select({
        message: 'Array item type:',
        choices: dbType === 'mongodb'
          ? ['string', 'number', 'object', 'objectid']
          : ['STRING', 'INTEGER', 'FLOAT'],
        });
      field.items = { type: itemType };
    }

    if (fieldType.toLowerCase() === 'object') {
      field.properties = await buildNestedObject(dbType);
    }

    schema[fieldName] = field;
  }

  // Associations
  if (availableModels.length > 0) {
    while (true) {
      const addAssoc = await confirm({ message: 'Add association?', default: false });
      if (!addAssoc) break;

      const assocType = await select({
        message: 'Association type:',
        choices: dbType === 'mongodb'
          ? ['hasMany', 'belongsTo']
          : ['hasMany', 'belongsTo', 'hasOne'],
      });

      const targetModel = await select({
        message: 'Target model:',
        choices: availableModels.map(m => ({ name: m, value: m })),
      });

      const fk = await input({
        message: 'Foreign key:',
        default: `${targetModel.toLowerCase()}Id`,
      });

      const as = await input({ message: 'Alias (as):', default: targetModel.toLowerCase() });

      associations.push({ type: assocType, targetModel, foreignKey: fk, as });
    }
  }

  // Build final config
  const config = {
    name: modelName,
    type: dbType,
    tableName: tableName?.trim(),
    schema,
    associations,
    options,
  };

  // Generate migration only for Sequelize
  let migration = null;
  if (dbType === 'sequelize') {
    migration = generateMigration(config);
  }

  return {
    config,
    migration, // { fileName, code } or null
  };
}

// Load model names from directory
function loadModelsFromDir(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      try {
        const filePath = path.join(dir, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return content.name || path.basename(file, '.json');
      } catch (err) {
        console.warn(`Failed to read ${file}:`, err.message);
        return null;
      }
    })
    .filter(Boolean);
}

// Nested object builder
async function buildNestedObject(dbType) {
  const props = {};
  while (true) {
    const add = await confirm({ message: 'Add nested field?', default: true });
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

// ── Generate Migration String (Sequelize only)
function generateMigration(config) {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const table = config.tableName || `${config.name.toLowerCase()}s`;
  const fileName = `${timestamp}-create-${table}.js`;

  let code = `'use strict';\n\nmodule.exports = {\n`;
  code += `  up: async (queryInterface, Sequelize) => {\n`;
  code += `    await queryInterface.createTable('${table}', {\n`;
  code += `      id: {\n`;
  code += `        allowNull: false,\n`;
  code += `        autoIncrement: true,\n`;
  code += `        primaryKey: true,\n`;
  code += `        type: Sequelize.INTEGER\n`;
  code += `      },\n`;

  for (const [field, def] of Object.entries(config.schema)) {
    code += `      ${field}: {\n`;
    code += `        type: ${formatType(def.type, def.values)},\n`;
    if (def.allowNull === false) code += `        allowNull: false,\n`;
    if (def.unique) code += `        unique: true,\n`;
    if (def.default !== undefined) {
      code += `        defaultValue: ${formatDefault(def.default)},\n`;
    }
    code = code.replace(/,\n$/, '\n') + `      },\n`;
  }

  if (config.options.timestamps) {
    code += `      createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },\n`;
    code += `      updatedAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },\n`;
  }
  if (config.options.paranoid) {
    code += `      deletedAt: { type: Sequelize.DATE },\n`;
  }

  code += `    });\n`;
  code += `  },\n\n`;
  code += `  down: async (queryInterface) => {\n`;
  code += `    await queryInterface.dropTable('${table}');\n`;
  code += `  }\n};\n`;

  return { fileName, code };
}

function formatType(type, values) {
  if (type.includes('[]')) return `Sequelize.ARRAY(Sequelize.${type.replace('[]', '')})`;
  if (type.includes('(')) return `Sequelize.${type}`;
  if (type === 'ENUM') return `Sequelize.ENUM(${values.map(v => `'${v}'`).join(', ')})`;
  return `Sequelize.${type}`;
}

function formatDefault(val) {
  if (val === 'now') return `Sequelize.fn('NOW')`;
  if (val === true) return 'true';
  if (val === false) return 'false';
  if (!isNaN(val)) return val;
  return `'${val}'`;
}

module.exports = { interactiveUnifiedBuilder };