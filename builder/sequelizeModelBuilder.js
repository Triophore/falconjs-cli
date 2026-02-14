// builder/sequelizeModelBuilder.js
const {
  input,
  confirm,
  select,
  checkbox,
} = require('@inquirer/prompts');
const fs = require('fs');
const path = require('path');
const { capitalize } = require('lodash');

async function sequelizeModelBuilder(baseDir = process.cwd()) {
  console.log('\nSequelize Model + Migration Builder\n');

  const sequelizeDir = path.join(baseDir, 'models', 'sequelize');
  const migrationsDir = path.join(baseDir, 'migrations');

  // Auto-create folders
  [sequelizeDir, migrationsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created: ${dir}`);
    }
  });

  const modelName = await input({
    message: 'Model name (singular, e.g., User):',
    validate: v => v.trim() ? true : 'Required',
  });

  const tableName = await input({
    message: 'Table name (optional, leave empty for pluralized):',
    default: '',
  }) || undefined;

  const fields = {};
  const indexes = [];
  const associations = [];

  // === Field Builder ===
  while (await confirm({ message: 'Add field?', default: true })) {
    const name = await input({ message: 'Field name:' });

    const type = await select({
      message: 'Data type:',
      choices: [
        'STRING', 'TEXT', 'INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL',
        'BOOLEAN', 'DATE', 'DATEONLY', 'JSON', 'UUID', 'ENUM'
      ],
    });

    const field = { type: `DataTypes.${type}` };

    // Common options
    if (await confirm({ message: 'Allow null?', default: true })) field.allowNull = true;
    if (await confirm({ message: 'Unique?', default: false })) field.unique = true;
    if (await confirm({ message: 'Primary key?', default: false })) field.primaryKey = true;

    const hasDefault = await confirm({ message: 'Default value?', default: false });
    if (hasDefault) {
      if (type === 'BOOLEAN') field.defaultValue = await confirm({ message: 'true?', default: true });
      else if (type === 'DATE') field.defaultValue = "DataTypes.NOW";
      else if (type === 'UUID') field.defaultValue = "DataTypes.UUIDV4";
      else field.defaultValue = await input({ message: 'Default (JS):' });
    }

    if (type === 'ENUM') {
      const values = await input({ message: 'Enum values (comma-separated):' });
      field.type = `DataTypes.ENUM(${values.split(',').map(v => `'${v.trim()}'`).join(', ')})`;
    }

    if (type === 'DECIMAL') {
      const precision = await input({ message: 'Precision (e.g. 10):', default: '10' });
      const scale = await input({ message: 'Scale (e.g. 2):', default: '2' });
      field.type = `DataTypes.DECIMAL(${precision}, ${scale})`;
    }

    fields[name] = field;
  }

  // === Indexes ===
  while (await confirm({ message: 'Add index?', default: false })) {
    const fieldsList = await input({ message: 'Fields (comma-separated):' });
    const opts = await checkbox({
      message: 'Index options:',
      choices: ['unique', 'fulltext', 'spatial'],
    });
    indexes.push({
      fields: fieldsList.split(',').map(f => f.trim()),
      unique: opts.includes('unique'),
      type: opts.includes('fulltext') ? 'FULLTEXT' : opts.includes('spatial') ? 'SPATIAL' : undefined,
    });
  }

  // === Associations (for future reference in code) ===
  while (await confirm({ message: 'Add association?', default: false })) {
    const type = await select({ message: 'Type:', choices: ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'] });
    const target = await input({ message: 'Target model:' });
    const options = {};
    if (type !== 'hasMany') options.foreignKey = await input({ message: 'Foreign key:', default: `${modelName.toLowerCase()}Id` });
    if (type === 'belongsToMany') options.through = await input({ message: 'Through table:' });
    associations.push({ type, target, options });
  }

  // === Generate Files ===
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const migrationName = `${timestamp}-create-${modelName.toLowerCase()}-table`;

  const modelCode = generateSequelizeModel(modelName, fields, tableName, indexes, associations);
  const migrationCode = generateSequelizeMigration(migrationName, modelName, fields, tableName, indexes);

  const modelPath = path.join(sequelizeDir, `${capitalize(modelName)}.js`);
  const migrationPath = path.join(migrationsDir, `${migrationName}.js`);

  fs.writeFileSync(modelPath, modelCode, 'utf8');
  fs.writeFileSync(migrationPath, migrationCode, 'utf8');

  console.log(`\nModel: ${modelPath}`);
  console.log(`Migration: ${migrationPath}\n`);
  console.log(`Run: npx sequelize-cli db:migrate   (or let Falcon run it automatically)\n`);
}

// === Code Generators ===
function generateSequelizeModel(name, fields, tableName, indexes, associations) {
  const modelName = capitalize(name);
  return `'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('${tableName || name.toLowerCase() + 's'}', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
${Object.entries(fields)
  .map(([k, v]) => `      ${k}: {\n        type: ${v.type},\n        allowNull: ${v.allowNull !== false},\n        ${v.unique ? 'unique: true,' : ''}\n        ${v.defaultValue ? `defaultValue: ${v.defaultValue},` : ''}\n      },`)
  .join('\n')}
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

${indexes.map(idx => `    await queryInterface.addIndex('${tableName || name.toLowerCase() + 's'}', [${idx.fields.map(f => `'${f}'`).join(', ')}], { ${idx.unique ? 'unique: true,' : ''} ${idx.type ? `type: '${idx.type}',` : ''} });`).join('\n')}
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('${tableName || name.toLowerCase() + 's'}');
  }
};
`;
}

function generateSequelizeMigration(migrationName, modelName, fields, tableName, indexes) {
  const capitalized = capitalize(modelName);
  return `'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ${capitalized} = sequelize.define('${capitalized}', {
${Object.entries(fields)
  .map(([name, def]) => `    ${name}: {\n      type: ${def.type},\n      allowNull: ${def.allowNull !== false},\n      ${def.primaryKey ? 'primaryKey: true,' : ''}\n      ${def.unique ? 'unique: true,' : ''}\n      ${def.defaultValue ? `defaultValue: ${def.defaultValue},` : ''}\n    },`)
  .join('\n')}
  }, {
    tableName: '${tableName || modelName.toLowerCase() + 's'}',
    timestamps: true,
    indexes: [
${indexes.map(idx => `      { fields: [${idx.fields.map(f => `'${f}'`).join(', ')}], ${idx.unique ? 'unique: true,' : ''} ${idx.type ? `type: '${idx.type}',` : ''} },`).join('\n')}
    ]
  });

  ${capitalized}.associate = (models) => {
    // Add associations here later
  };

  return ${capitalized};
};
`;
}

module.exports = { sequelizeModelBuilder };