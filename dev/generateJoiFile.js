// generateJoiFile.js
const fs = require('fs');
const path = require('path');
const Joi = require('joi');

function generateJoiFile(config, outputDir = './joi') {
  const { name, schema } = config;

  // Build Joi schema
  const joiSchema = buildJoiSchema(schema);

  // Generate code
  let code = `const Joi = require('joi');\n\n`;
  code += `const ${name} = ${joiSchema.toString().replace(/Joi\.object\(\)/g, 'Joi.object')}\n\n`;
  code += `module.exports = ${name};\n`;

  // Ensure directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write file
  const filePath = path.join(outputDir, `${name}.js`);
  fs.writeFileSync(filePath, code);

  console.log(`Joi schema saved: ${filePath}`);
}

function buildJoiSchema(def) {
  const schema = {};

  for (const [key, field] of Object.entries(def)) {
    let joiField;

    switch (field.type) {
      case 'string':
        joiField = Joi.string();
        if (field.email) joiField = joiField.email();
        if (field.trim) joiField = joiField.trim();
        if (field.lowercase) joiField = joiField.lowercase();
        if (field.uppercase) joiField = joiField.uppercase();
        if (field.alphanum) joiField = joiField.alphanum();
        if (field.uuid) joiField = joiField.uuid();
        if (field.min) joiField = joiField.min(field.min);
        if (field.max) joiField = joiField.max(field.max);
        if (field.regex) joiField = joiField.pattern(new RegExp(field.regex));
        if (field.enum) joiField = joiField.valid(...field.enum);
        break;

      case 'number':
        joiField = Joi.number();
        if (field.integer) joiField = joiField.integer();
        if (field.positive) joiField = joiField.positive();
        if (field.negative) joiField = joiField.negative();
        if (field.min) joiField = joiField.min(field.min);
        if (field.max) joiField = joiField.max(field.max);
        break;

      case 'boolean':
        joiField = Joi.boolean();
        break;

      case 'date':
        joiField = Joi.date();
        break;

      case 'array':
        const items = buildJoiSchema({ item: field.items }).item;
        joiField = Joi.array().items(items);
        if (field.min) joiField = joiField.min(field.min);
        if (field.max) joiField = joiField.max(field.max);
        if (field.unique) joiField = joiField.unique();
        break;

      case 'object':
        joiField = Joi.object(buildJoiSchema(field.properties));
        break;

      default:
        joiField = Joi.any();
    }

    if (field.required) joiField = joiField.required();
    if (field.default !== undefined) {
      const def = field.default === 'Date.now()' ? Date.now : field.default;
      joiField = joiField.default(def);
    }

    schema[key] = joiField;
  }

  return Joi.object(schema);
}

module.exports = { generateJoiFile };