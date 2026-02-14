// builder/mongooseModelBuilder.js
const {
  input,
  confirm,
  select,
  checkbox,
} = require('@inquirer/prompts');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

/**
 * Interactive Mongoose model builder (fixed & polished)
 * Generates clean, correct, ready-to-use model files for Falcon
 */
async function mongooseModelBuilder(outputDir) {
  console.log('\nMongoose Model Builder (Timestamps, Relations, Indexes)\n');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  const modelName = await input({
    message: 'Model name (e.g., User):',
    validate: v => v.trim() ? true : 'Model name is required',
  });

  const capitalized = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  const schemaDef = {};
  const indexes = [];
  const virtuals = [];
  const schemaOptions = {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  };

  // Timestamps
  const useTimestamps = await confirm({
    message: 'Enable timestamps (createdAt, updatedAt)?',
    default: true,
  });
  if (useTimestamps) schemaOptions.timestamps = true;

  console.log('\nAdd fields (leave empty to finish):\n');

  while (true) {
    const addMore = await confirm({ message: 'Add another field?', default: true });
    if (!addMore) break;

    const fieldName = await input({
      message: 'Field name:',
      validate: v => v && !schemaDef[v] ? true : 'Invalid or duplicate field name',
    });

    const typeChoice = await select({
      message: `Type for "${fieldName}":`,
      choices: [
        'String', 'Number', 'Date', 'Boolean',
        'ObjectId', 'Array', 'Mixed', 'Object'
      ].map(t => ({ name: t, value: t })),
    });

    const field = {};

    // Handle type
    switch (typeChoice) {
      case 'String':    field.type = String; break;
      case 'Number':    field.type = Number; break;
      case 'Date':      field.type = Date; break;
      case 'Boolean':   field.type = Boolean; break;
      case 'Mixed':     field.type = mongoose.Schema.Types.Mixed; break;
      case 'ObjectId':  field.type = mongoose.Schema.Types.ObjectId; break;
      case 'Array':
      case 'Object':
        // Handled below
        break;
    }

    // Required / Unique
    if (await confirm({ message: 'Required?', default: false })) field.required = true;
    if (await confirm({ message: 'Unique?', default: false })) field.unique = true;

    // Default value
    const hasDefault = await confirm({ message: 'Set default value?', default: false });
    if (hasDefault) {
      if (typeChoice === 'Boolean') {
        field.default = await confirm({ message: 'Default = true?', default: true });
      } else if (typeChoice === 'Date') {
        field.default = await confirm({ message: 'Default = now?', default: true }) ? Date.now : await input({ message: 'JS expression:' });
      } else if (typeChoice === 'Number') {
        field.default = Number(await input({ message: 'Default number:' }));
      } else {
        field.default = await input({ message: 'Default value (JS):' });
      }
    }

    // String options
    if (typeChoice === 'String') {
      const opts = await checkbox({
        message: 'String options:',
        choices: ['trim', 'lowercase', 'uppercase', 'enum', 'match'],
      });
      if (opts.includes('trim')) field.trim = true;
      if (opts.includes('lowercase')) field.lowercase = true;
      if (opts.includes('uppercase')) field.uppercase = true;
      if (opts.includes('enum')) {
        const values = await input({ message: 'Enum values (comma-separated):' });
        field.enum = values.split(',').map(v => v.trim()).filter(Boolean);
      }
      if (opts.includes('match')) {
        const pattern = await input({ message: 'Regex pattern (without //):' });
        field.match = new RegExp(pattern);
      }
    }

    // Reference (ObjectId)
    if (typeChoice === 'ObjectId') {
      const ref = await input({ message: 'Reference model (e.g., User):' });
      field.ref = ref;
    }

    // Array type
    if (typeChoice === 'Array') {
      const itemType = await select({
        message: 'Array item type:',
        choices: ['String', 'Number', 'Boolean', 'Date', 'ObjectId', 'Object', 'Mixed'],
      });

      if (itemType === 'ObjectId') {
        const ref = await input({ message: 'Ref model:' });
        field.type = [{ type: mongoose.Schema.Types.ObjectId, ref }];
      } else if (itemType === 'Object') {
        field.type = [await buildNestedSchema()];
      } else if (itemType === 'Mixed') {
        field.type = [mongoose.Schema.Types.Mixed];
      } else {
        const map = { String, Number, Boolean, Date };
        field.type = [map[itemType]];
      }
    }

    // Nested object
    if (typeChoice === 'Object') {
      field.type = await buildNestedSchema();
    }

    schemaDef[fieldName] = field;
  }

  // Indexes
  while (await confirm({ message: 'Add index?', default: false })) {
    const field = await input({ message: 'Field(s) to index (comma-separated):' });
    const fields = field.split(',').reduce((obj, f) => {
      const trimmed = f.trim();
      obj[trimmed] = trimmed.startsWith('-') ? -1 : 1;
      return obj;
    }, {});

    const options = {};
    const opts = await checkbox({
      message: 'Index options:',
      choices: ['unique', 'sparse', 'text', 'ttl'],
    });

    if (opts.includes('unique')) options.unique = true;
    if (opts.includes('sparse')) options.sparse = true;
    if (opts.includes('text')) options.text = true;
    if (opts.includes('ttl')) {
      const secs = await input({ message: 'TTL seconds:', default: '3600' });
      options.expireAfterSeconds = Number(secs);
    }

    indexes.push({ fields, options });
  }

  // Virtuals (Relations)
  while (await confirm({ message: 'Add virtual relation?', default: false })) {
    const relType = await select({
      message: 'Relation type:',
      choices: ['belongsTo', 'hasOne', 'hasMany'],
    });

    const targetModel = await input({ message: 'Target model:' });
    const virtualName = await input({
      message: 'Virtual field name:',
      default: relType === 'hasMany' ? targetModel.toLowerCase() + 's' : targetModel.toLowerCase(),
    });

    let localField, foreignField, justOne = false;

    if (relType === 'belongsTo') {
      localField = await input({ message: 'Local field (e.g., userId):', default: targetModel.toLowerCase() + 'Id' });
      foreignField = await input({ message: 'Foreign field:', default: '_id' });
      justOne = true;
    } else {
      localField = await input({ message: 'Local field:', default: '_id' });
      foreignField = await input({ message: 'Foreign field:', default: modelName.toLowerCase() + 'Id' });
      justOne = relType === 'hasOne';
    }

    virtuals.push({ virtualName, ref: targetModel, localField, foreignField, justOne });
  }

  // Generate & save
  const code = generateMongooseModelCode(capitalized, schemaDef, indexes, virtuals, schemaOptions);
  const filePath = path.join(outputDir, `${capitalized}.js`);

  fs.writeFileSync(filePath, code, 'utf8');
  console.log(`\nModel created: ${filePath}\n`);
}

// Nested schema helper
async function buildNestedSchema() {
  const obj = {};
  console.log('\nNested object:\n');
  while (await confirm({ message: 'Add nested field?', default: true })) {
    const name = await input({ message: 'Field name:' });
    const type = await select({
      message: 'Type:',
      choices: ['String', 'Number', 'Boolean', 'Date', 'ObjectId', 'Mixed'],
    });

    const field = {};
    switch (type) {
      case 'String': field.type = String; break;
      case 'Number': field.type = Number; break;
      case 'Boolean': field.type = Boolean; break;
      case 'Date': field.type = Date; break;
      case 'Mixed': field.type = mongoose.Schema.Types.Mixed; break;
      case 'ObjectId':
        field.type = mongoose.Schema.Types.ObjectId;
        field.ref = await input({ message: 'Ref model:' });
        break;
    }
    obj[name] = field;
  }
  return obj;
}

// Clean, correct code generation
function generateMongooseModelCode(modelName, fields, indexes = [], virtuals = [], options = {}) {
  let code = `module.exports = async function (mongoose) {\n`;
  code += `  const { Schema } = mongoose;\n\n`;
  code += `  const ${modelName}Schema = new Schema(\n`;
  code += `    {\n`;

  Object.entries(fields).forEach(([name, def]) => {
    code += `      ${name}: {\n`;
    if (def.type && typeof def.type !== 'object') {
      const typeName = def.type === String ? 'String' :
                       def.type === Number ? 'Number' :
                       def.type === Boolean ? 'Boolean' :
                       def.type === Date ? 'Date' :
                       def.type === mongoose.Schema.Types.ObjectId ? 'Schema.Types.ObjectId' :
                       def.type === mongoose.Schema.Types.Mixed ? 'Schema.Types.Mixed' : '???';
      code += `        type: ${typeName},\n`;
    } else if (Array.isArray(def.type)) {
      const inner = def.type[0];
      if (typeof inner === 'function') {
        const name = inner === String ? 'String' : inner === Number ? 'Number' : '???';
        code += `        type: [${name}],\n`;
      } else {
        code += `        type: ${JSON.stringify(def.type, null, 8).replace(/\n/g, '\n        ')},\n`;
      }
    } else if (def.type) {
      code += `        type: ${JSON.stringify(def.type, null, 8).replace(/\n/g, '\n        ')},\n`;
    }

    if (def.required) code += `        required: ${JSON.stringify(def.required)},\n`;
    if (def.unique) code += `        unique: ${def.unique},\n`;
    if (def.default !== undefined) {
      const defVal = def.default === Date.now ? 'Date.now' : JSON.stringify(def.default);
      code += `        default: ${defVal},\n`;
    }
    if (def.ref) code += `        ref: '${def.ref}',\n`;
    if (def.enum) code += `        enum: ${JSON.stringify(def.enum)},\n`;
    if (def.match) code += `        match: ${def.match},\n`;
    if (def.trim) code += `        trim: true,\n`;
    if (def.lowercase) code += `        lowercase: true,\n`;
    if (def.uppercase) code += `        uppercase: true,\n`;

    code = code.trimEnd() + '\n      },\n';
  });

  code += `    },\n`;
  code += `    ${JSON.stringify(options, null, 4).replace(/\n/g, '\n    ')}\n`;
  code += `  );\n\n`;

  // Indexes
  indexes.forEach(idx => {
    const fields = JSON.stringify(idx.fields);
    const opts = Object.keys(idx.options).length ? `, ${JSON.stringify(idx.options)}` : '';
    code += `  ${modelName}Schema.index(${fields}${opts});\n`;
  });

  // Virtuals
  virtuals.forEach(v => {
    code += `\n  ${modelName}Schema.virtual('${v.virtualName}', {\n`;
    code += `    ref: '${v.ref}',\n`;
    code += `    localField: '${v.localField}',\n`;
    code += `    foreignField: '${v.foreignField}',\n`;
    code += `    justOne: ${v.justOne}\n`;
    code += `  });\n`;
  });

  code += `\n  return mongoose.model('${modelName}', ${modelName}Schema);\n`;
  code += `};\n`;

  return code;
}

module.exports = { mongooseModelBuilder };