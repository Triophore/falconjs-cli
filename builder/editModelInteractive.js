// editModelInteractive.js
const {
  input,
  confirm,
  select,
} = require('@inquirer/prompts');
const fs = require('fs');
const path = require('path');
const { interactiveUnifiedBuilder } = require('./interactiveUnifiedBuilder');

async function editModelInteractive(baseDir, modelName) {
  const mongoDir = path.join(baseDir, 'mongo');
  const sequelizeDir = path.join(baseDir, 'sequelize');

  // Find model
  let filePath = path.join(mongoDir, `${modelName}.json`);
  let isMongo = fs.existsSync(filePath);
  if (!isMongo) {
    filePath = path.join(sequelizeDir, `${modelName}.json`);
    isMongo = false;
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Model "${modelName}" not found in ${mongoDir} or ${sequelizeDir}`);
  }

  const existingConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const dbType = existingConfig.type || (isMongo ? 'mongodb' : 'sequelize');

  if (dbType === 'mongodb') {
    throw new Error('Edit with alter migration is only supported for Sequelize (SQL). Use Mongoose schema evolution.');
  }

  console.log(`\nEditing SEQUELIZE model: ${modelName}\n`);

  // Reuse interactive builder to get new config
  const { config: newConfig } = await interactiveUnifiedBuilder(baseDir);

  // Merge: keep only name, type, tableName, options
  const updatedConfig = {
    name: modelName,
    type: 'sequelize',
    tableName: newConfig.tableName || existingConfig.tableName,
    schema: newConfig.schema,
    associations: newConfig.associations.length > 0 ? newConfig.associations : (existingConfig.associations || []),
    options: { ...existingConfig.options, ...newConfig.options },
  };

  // Generate alter migration
  const migration = generateAlterMigration(existingConfig, updatedConfig);

  // Save updated JSON
  const savePath = path.join(sequelizeDir, `${modelName}.json`);
  fs.writeFileSync(savePath, JSON.stringify(updatedConfig, null, 2), 'utf8');
  console.log(`Updated model saved: ${savePath}`);

  return { config: updatedConfig, migration };
}

// ── Generate Real Alter Migration
function generateAlterMigration(oldConfig, newConfig) {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const table = newConfig.tableName || `${newConfig.name.toLowerCase()}s`;
  const fileName = `${timestamp}-alter-${table}.js`;

  const oldFields = oldConfig.schema || {};
  const newFields = newConfig.schema || {};

  const added = Object.keys(newFields).filter(f => !oldFields[f]);
  const removed = Object.keys(oldFields).filter(f => !newFields[f]);
  const changed = Object.keys(newFields).filter(f => oldFields[f] && !deepEqual(oldFields[f], newFields[f]));

  if (added.length === 0 && removed.length === 0 && changed.length === 0 && oldConfig.tableName === newConfig.tableName) {
    return null; // No changes
  }

  let upCode = [];
  let downCode = [];

  // Add columns
  added.forEach(field => {
    const def = newFields[field];
    upCode.push(`    await queryInterface.addColumn('${table}', '${field}', ${formatField(def)});`);
    downCode.push(`    await queryInterface.removeColumn('${table}', '${field}');`);
  });

  // Remove columns
  removed.forEach(field => {
    upCode.push(`    await queryInterface.removeColumn('${table}', '${field}');`);
    downCode.push(`    await queryInterface.addColumn('${table}', '${field}', ${formatField(oldFields[field])});`);
  });

  // Change columns
  changed.forEach(field => {
    const def = newFields[field];
    upCode.push(`    await queryInterface.changeColumn('${table}', '${field}', ${formatField(def)});`);
    downCode.push(`    await queryInterface.changeColumn('${table}', '${field}', ${formatField(oldFields[field])});`);
  });

  // Rename table
  if (oldConfig.tableName && newConfig.tableName && oldConfig.tableName !== newConfig.tableName) {
    upCode.unshift(`    await queryInterface.renameTable('${oldConfig.tableName}', '${newConfig.tableName}');`);
    downCode.unshift(`    await queryInterface.renameTable('${newConfig.tableName}', '${oldConfig.tableName}');`);
  }

  let code = `'use strict';\n\nmodule.exports = {\n`;
  code += `  up: async (queryInterface, Sequelize) => {\n`;
  code += upCode.join('\n') || `    // No schema changes detected\n`;
  code += `\n  },\n\n`;
  code += `  down: async (queryInterface, Sequelize) => {\n`;
  code += downCode.join('\n') || `    // No rollback needed\n`;
  code += `\n  }\n};\n`;

  return { fileName, code };
}

// Format field for migration
function formatField(field) {
  const parts = [];
  parts.push(`type: ${formatType(field.type, field.values)}`);
  if (field.allowNull === false) parts.push(`allowNull: false`);
  if (field.unique) parts.push(`unique: true`);
  if (field.default !== undefined) parts.push(`defaultValue: ${formatDefault(field.default)}`);

  return `{ ${parts.join(', ')} }`;
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

// Deep compare (for changed detection)
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

module.exports = { editModelInteractive };