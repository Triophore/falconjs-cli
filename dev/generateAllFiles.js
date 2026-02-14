// generateAllFiles.js
const fs = require('fs');
const path = require('path');
const { createModelFromJson } = require('./createModelFromJson');
const { createJoiSchemaFromJson } = require('./createJoiSchemaFromJson');

function generateAllFiles(config) {
  const baseDir = 'generated';
  const modelDir = path.join(baseDir, config.type);
  const joiDir = path.join(baseDir, 'joi');
  const migDir = path.join(baseDir, 'migrations');

  [baseDir, modelDir, joiDir, migDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 1. Model (Mongoose or Sequelize)
  const result = createModelFromJson(config);
  const modelPath = path.join(modelDir, `${config.name}.js`);
  fs.writeFileSync(modelPath, generateModelCode(result));

  // 2. Joi Schema
  const joiSchema = createJoiSchemaFromJson({ schema: config.joi });
  const joiCode = `const Joi = require('joi');\nmodule.exports = ${joiSchema.toString().replace('Joi.object()', 'Joi.object')};`;
  fs.writeFileSync(path.join(joiDir, `${config.name}.js`), joiCode);

  // 3. Migration (Sequelize only)
  if (config.type === 'sequelize' && result.migration) {
    fs.writeFileSync(path.join(migDir, result.migration.fileName), result.migration.code);
  }

  console.log(`Model: ${modelPath}`);
  console.log(`Joi: ${joiDir}/${config.name}.js`);
  if (result.migration) console.log(`Migration: ${migDir}/${result.migration.fileName}`);
}

function generateModelCode(result) {
  if (result.type === 'mongoose') {
    return `const mongoose = require('mongoose');\nconst schema = new mongoose.Schema(${JSON.stringify(result.schema.tree, null, 2)}, { timestamps: true });\nmodule.exports = mongoose.model('${result.modelName}', schema);`;
  } else {
    return `const { DataTypes } = require('sequelize');\nmodule.exports = (sequelize) => {\n  return sequelize.define('${result.modelName}', ${JSON.stringify(result.Model.rawAttributes, null, 2)}, { tableName: '${result.Model.getTableName()}', timestamps: true });\n};`;
  }
}

module.exports = { generateAllFiles };