// mongooseModelBuilder.js
const {
  input,
  confirm,
  select,
  checkbox,
} = require('@inquirer/prompts');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Interactive Mongoose model builder with timestamps & relations
 * @param {string} outputDir - Folder to save the .js model file
 * @returns {Promise<void>}
 */
async function mongooseModelBuilder(outputDir) {
  console.log('\nMongoose Model Builder (with Timestamps & Relations)\n');

  if (!fs.existsSync(outputDir)) {
    console.log(`Creating directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const modelName = await input({
    message: 'Model name (e.g., User):',
    validate: v => v.trim() ? true : 'Required',
  });

  const schemaDef = {};
  const indexes = [];
  const virtuals = [];
  const options = { toJSON: { virtuals: true }, toObject: { virtuals: true } };

  // Timestamps
  const useTimestamps = await confirm({ message: 'Enable timestamps (createdAt, updatedAt)?', default: true });
  if (useTimestamps) options.timestamps = true;

  console.log('\nAdd fields:\n');

  while (true) {
    const addField = await confirm({ message: 'Add a field?', default: true });
    if (!addField) break;

    const fieldName = await input({
      message: 'Field name:',
      validate: v => v && !schemaDef[v] ? true : 'Invalid/duplicate',
    });

    const type = await select({
      message: `Type for "${fieldName}":`,
      choices: [
        'String', 'Number', 'Date', 'Boolean',
        'ObjectId', 'Array', 'Object'
      ].map(t => ({ name: t, value: t })),
    });

    const field = { type };

    // Required
    const required = await confirm({ message: 'Required?', default: false });
    if (required) field.required = true;

    // Unique
    const unique = await confirm({ message: 'Unique?', default: false });
    if (unique) field.unique = true;

    // Default
    const hasDefault = await confirm({ message: 'Set default?', default: false });
    if (hasDefault) {
      if (type === 'Boolean') {
        field.default = await confirm({ message: 'Default TRUE?', default: true });
      } else if (type === 'Date') {
        field.default = await confirm({ message: 'Default NOW?', default: true }) ? 'Date.now' : await input({ message: 'JS expression:' });
      } else {
        field.default = await input({ message: 'Default value (JS):' });
      }
    }

    // String-specific
    if (type === 'String') {
      const opts = await checkbox({
        message: 'String options:',
        choices: ['lowercase', 'uppercase', 'trim', 'enum', 'match'],
      });
      if (opts.includes('lowercase')) field.lowercase = true;
      if (opts.includes('uppercase')) field.uppercase = true;
      if (opts.includes('trim')) field.trim = true;
      if (opts.includes('enum')) {
        const values = await input({ message: 'Enum values (comma-separated):' });
        field.enum = values.split(',').map(v => v.trim()).filter(Boolean);
      }
      if (opts.includes('match')) {
        field.match = await input({ message: 'Regex pattern:' });
      }
    }

    // ObjectId → Ref
    if (type === 'ObjectId') {
      const refModel = await input({ message: 'Reference model name:' });
      field.ref = refModel;
    }

    // Array
    if (type === 'Array') {
      const itemType = await select({
        message: 'Array item type:',
        choices: ['String', 'Number', 'ObjectId', 'Object'],
      });
      if (itemType === 'ObjectId') {
        const refModel = await input({ message: 'Ref model for array items:' });
        field.type = [{ type: mongoose.Schema.Types.ObjectId, ref: refModel }];
      } else if (itemType === 'Object') {
        field.type = [await buildNestedSchema()];
      } else {
        field.type = [`[${itemType}]`];
      }
    }

    // Nested Object
    if (type === 'Object') {
      field.type = await buildNestedSchema();
    }

    schemaDef[fieldName] = field;
  }

  // Indexes
  while (true) {
    const addIndex = await confirm({ message: 'Add index?', default: false });
    if (!addIndex) break;

    const field = await input({ message: 'Field to index:' });
    const order = await select({ message: 'Order:', choices: ['1 (asc)', '-1 (desc)'], default: '1' });
    const opts = await checkbox({
      message: 'Index options:',
      choices: ['unique', 'sparse', 'text', 'ttl'],
    });

    const indexObj = { [field]: parseInt(order) };
    const indexOpts = {};

    if (opts.includes('unique')) indexOpts.unique = true;
    if (opts.includes('sparse')) indexOpts.sparse = true;
    if (opts.includes('text')) indexOpts.text = true;
    if (opts.includes('ttl')) {
      const ttl = await input({ message: 'TTL seconds:', default: '3600' });
      indexOpts.expireAfterSeconds = Number(ttl);
    }

    indexes.push({ fields: indexObj, options: indexOpts });
  }

  // Relations (Virtuals)
  while (true) {
    const addRel = await confirm({ message: 'Add relation (virtual)?', default: false });
    if (!addRel) break;

    const relType = await select({
      message: 'Relation type:',
      choices: ['hasMany', 'belongsTo', 'hasOne'],
    });

    const targetModel = await input({ message: 'Target model name:' });

    let localField, foreignField, justOne = false;

    if (relType === 'belongsTo') {
      localField = await input({ message: 'Local field (e.g., userId):', default: `${targetModel.toLowerCase()}Id` });
      foreignField = await input({ message: 'Foreign field (e.g., _id):', default: '_id' });
      justOne = true;
    } else {
      localField = await input({ message: 'Local field (e.g., _id):', default: '_id' });
      foreignField = await input({ message: 'Foreign field (e.g., userId):', default: `${modelName.toLowerCase()}Id` });
      justOne = relType === 'hasOne';
    }

    const virtualName = await input({
      message: 'Virtual name (e.g., posts, author):',
      default: relType === 'belongsTo' ? targetModel.toLowerCase() : `${targetModel.toLowerCase()}s`
    });

    virtuals.push({ virtualName, ref: targetModel, localField, foreignField, justOne });
  }

  // Generate code
  const code = generateMongooseModelCode(modelName, schemaDef, indexes, virtuals, options);
  const filePath = path.join(outputDir, `${modelName}.js`);

  fs.writeFileSync(filePath, code, 'utf8');
  console.log(`\nMongoose model saved: ${filePath}`);
  return modelName
}

// Nested schema builder
async function buildNestedSchema() {
  const nested = {};
  while (true) {
    const add = await confirm({ message: 'Add nested field?', default: true });
    if (!add) break;

    const name = await input({ message: 'Field name:' });
    const type = await select({
      message: 'Type:',
      choices: ['String', 'Number', 'Boolean', 'Date', 'ObjectId', 'Array', 'Object'],
    });

    const field = { type };
    if (type === 'ObjectId') field.ref = await input({ message: 'Ref:' });
    if (type === 'Object') field.type = await buildNestedSchema();
    if (type === 'Array') {
      const itemType = await select({ message: 'Array item type:', choices: ['String', 'Number', 'ObjectId', 'Object'] });
      field.type = itemType === 'ObjectId' ? [{ type: mongoose.Schema.Types.ObjectId, ref: await input({ message: 'Ref:' }) }] : [`[${itemType}]`];
    }

    nested[name] = field;
  }
  return Object.keys(nested).length > 0 ? nested : null;
}

// Generate full .js file
function generateMongooseModelCode(modelName, schemaDef, indexes = [], virtuals = [], options = {}) {
  let code = `module.exports = async function (mongoose) {\n`;
  // code += `const { Schema } = mongoose;\n\n`;

  code += `const ${modelName}Schema = new mongoose.Schema(\n`;
  code += `  {\n`;

  Object.entries(schemaDef).forEach(([name, def]) => {
    code += `    ${name}: {\n`;

    // Type
    if (Array.isArray(def.type)) {
      code += `      type: ${formatArrayType(def.type)},\n`;
    } else if (typeof def.type === 'object' && def.type !== null) {
      code += `      type: ${JSON.stringify(def.type, null, 6).replace(/\n/g, '\n      ')},\n`;
    } else {
      code += `      type: mongoose.Schema.Types.${def.type},\n`;
    }

    if (def.required) code += `      required: ${def.required},\n`;
    if (def.unique) code += `      unique: ${def.unique},\n`;
    if (def.default !== undefined) code += `      default: ${def.default === 'Date.now' ? 'Date.now' : JSON.stringify(def.default)},\n`;
    if (def.lowercase) code += `      lowercase: true,\n`;
    if (def.uppercase) code += `      uppercase: true,\n`;
    if (def.trim) code += `      trim: true,\n`;
    if (def.enum) code += `      enum: ${JSON.stringify(def.enum)},\n`;
    if (def.match) code += `      match: /${def.match}/,\n`;
    if (def.ref) code += `      ref: '${def.ref}',\n`;

    code = code.replace(/,\n$/, '\n') + `    },\n`;
  });

  code += `  },\n`;
  code += `  ${JSON.stringify(options, null, 2).replace(/\n/g, '\n  ')}\n`;
  code += `);\n\n`;

  // Indexes
  indexes.forEach(idx => {
    const fields = JSON.stringify(idx.fields);
    const opts = Object.keys(idx.options).length > 0 ? `, ${JSON.stringify(idx.options)}` : '';
    code += `${modelName}mongoose.Schema.index(${fields}${opts});\n`;
  });

  // Virtuals (Relations)
  virtuals.forEach(v => {
    code += `\n${modelName}mongoose.Schema.virtual('${v.virtualName}', {\n`;
    code += `  ref: '${v.ref}',\n`;
    code += `  localField: '${v.localField}',\n`;
    code += `  foreignField: '${v.foreignField}',\n`;
    code += `  justOne: ${v.justOne}\n`;
    code += ` });\n`;
  });

  code += `\n return mongoose.model('${modelName}', ${modelName}Schema);\n`;

  code += `}`;

  return code;
}

function formatArrayType(arr) {
  if (arr.length === 1 && typeof arr[0] === 'string' && arr[0].startsWith('[')) {
    return arr[0];
  }
  return JSON.stringify(arr);
}

module.exports = { mongooseModelBuilder };