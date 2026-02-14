// generateSequelizeFiles.js
const fs = require('fs');
const path = require('path');

function generateModelFile(config) {
  const { name, schema, associations, options } = config;
  const modelName = name;
  const tableName = options.tableName;

  let code = `const { DataTypes } = require('sequelize');\n\n`;
  code += `module.exports = (sequelize) => {\n`;
  code += `  const ${modelName} = sequelize.define('${modelName}', {\n`;

  for (const [field, def] of Object.entries(schema)) {
    code += `    ${field}: {\n`;
    code += `      type: ${formatType(def.type, def.values)},\n`;
    if (def.allowNull === false) code += `      allowNull: false,\n`;
    if (def.unique) code += `      unique: true,\n`;
    if (def.defaultValue !== undefined) {
      code += `      defaultValue: ${formatDefault(def.defaultValue)},\n`;
    }
    code = code.replace(/,\n$/, '\n'); // remove last comma
    code += `    },\n`;
  }

  code += `  }, {\n`;
  code += `    tableName: '${tableName}',\n`;
  code += `    timestamps: ${options.timestamps},\n`;
  code += `    paranoid: ${options.paranoid},\n`;
  code += `    freezeTableName: true\n`;
  code += `  });\n\n`;

  // Associations
  if (associations.length > 0) {
    code += `  // Associations\n`;
    associations.forEach(assoc => {
      if (assoc.type === 'belongsTo') {
        code += `  ${modelName}.belongsTo(sequelize.models.${assoc.targetModel}, { foreignKey: '${assoc.foreignKey}', as: '${assoc.as}' });\n`;
      } else if (assoc.type === 'hasMany') {
        code += `  ${modelName}.hasMany(sequelize.models.${assoc.targetModel}, { foreignKey: '${assoc.foreignKey}', as: '${assoc.as}' });\n`;
      }
    });
  }

  code += `\n  return ${modelName};\n};\n`;

  return code;
}

function generateMigrationFile(config) {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const migrationName = `create-${config.tableName}`;
  const fileName = `${timestamp}-${migrationName}.js`;

  let code = `'use strict';\n\n`;
  code += `module.exports = {\n`;
  code += `  up: async (queryInterface, Sequelize) => {\n`;
  code += `    await queryInterface.createTable('${config.tableName}', {\n`;

  // Add id
  code += `      id: {\n`;
  code += `        allowNull: false,\n`;
  code += `        autoIncrement: true,\n`;
  code += `        primaryKey: true,\n`;
  code += `        type: Sequelize.INTEGER\n`;
  code += `      },\n`;

  // Add fields
  for (const [field, def] of Object.entries(config.schema)) {
    code += `      ${field}: {\n`;
    code += `        type: ${formatType(def.type, def.values)},\n`;
    if (def.allowNull === false) code += `        allowNull: false,\n`;
    if (def.unique) code += `        unique: true,\n`;
    if (def.defaultValue !== undefined) {
      code += `        defaultValue: ${formatDefault(def.defaultValue)},\n`;
    }
    code = code.replace(/,\n$/, '\n');
    code += `      },\n`;
  }

  // Timestamps
  if (config.options.timestamps) {
    code += `      createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },\n`;
    code += `      updatedAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },\n`;
  }
  if (config.options.paranoid) {
    code += `      deletedAt: { type: Sequelize.DATE },\n`;
  }

  code += `    });\n`;

  // Add indexes
  code += `\n    // Indexes\n`;
  for (const [field, def] of Object.entries(config.schema)) {
    if (def.unique) {
      code += `    await queryInterface.addIndex('${config.tableName}', ['${field}'], { unique: true });\n`;
    }
  }

  // Foreign keys
  const fks = config.associations.filter(a => a.type === 'belongsTo');
  if (fks.length > 0) {
    code += `\n    // Foreign Keys\n`;
    for (const fk of fks) {
      code += `    await queryInterface.addConstraint('${config.tableName}', {\n`;
      code += `      fields: ['${fk.foreignKey}'],\n`;
      code += `      type: 'foreign key',\n`;
      code += `      name: 'fk_${config.tableName}_${fk.foreignKey}',\n`;
      code += `      references: { table: '${fk.targetModel.toLowerCase()}s', field: 'id' },\n`;
      code += `      onDelete: 'SET NULL',\n`;
      code += `      onUpdate: 'CASCADE'\n`;
      code += `    });\n`;
    }
  }

  code += `  },\n\n`;

  code += `  down: async (queryInterface) => {\n`;
  code += `    await queryInterface.dropTable('${config.tableName}');\n`;
  code += `  }\n};\n`;

  return { fileName, code };
}

function formatType(type, enumValues) {
  if (type.includes('[]')) {
    const base = type.replace('[]', '');
    return `Sequelize.ARRAY(Sequelize.${base})`;
  }
  if (type.includes('(')) {
    const [base, len] = type.split('(');
    return `Sequelize.${base}(${len}`;
  }
  if (type === 'ENUM') {
    return `Sequelize.ENUM(${enumValues.map(v => `'${v}'`).join(', ')})`;
  }
  return `Sequelize.${type}`;
}

function formatDefault(val) {
  if (val === 'sequelize.fn("NOW")') return `Sequelize.fn('NOW')`;
  if (val === true) return 'true';
  if (val === false) return 'false';
  if (!isNaN(val)) return val;
  return `'${val}'`;
}

function exportFiles(config) {
  const modelDir = 'models';
  const migrationDir = 'migrations';

  if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir);
  if (!fs.existsSync(migrationDir)) fs.mkdirSync(migrationDir);

  // Model
  const modelCode = generateModelFile(config);
  fs.writeFileSync(path.join(modelDir, `${config.name}.js`), modelCode);

  // Migration
  const { fileName, code } = generateMigrationFile(config);
  fs.writeFileSync(path.join(migrationDir, fileName), code);

  console.log(`Model: ${modelDir}/${config.name}.js`);
  console.log(`Migration: ${migrationDir}/${fileName}`);
}

module.exports = { exportFiles };