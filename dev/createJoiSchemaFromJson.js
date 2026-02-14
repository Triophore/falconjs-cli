// createJoiSchemaFromJson.js
const Joi = require('joi');

/**
 * Converts custom JSON schema → Joi schema
 * @param {Object} config - Your JSON config
 * @returns {Joi.ObjectSchema}
 */
function createJoiSchemaFromJson(config) {
  if (!config || !config.schema) {
    throw new Error('Config must have "schema"');
  }

  const schemaDef = config.schema;
  const joiDef = {};

  for (const [fieldName, field] of Object.entries(schemaDef)) {
    let joiField = null;

    const type = (field.type || '').toLowerCase();

    // Base type
    switch (type) {
      case 'string':
        joiField = Joi.string();
        if (field.trim) joiField = joiField.trim();
        if (field.lowercase) joiField = joiField.lowercase();
        if (field.uppercase) joiField = joiField.uppercase();
        if (field.email) joiField = joiField.email();
        if (field.min) joiField = joiField.min(field.min);
        if (field.max) joiField = joiField.max(field.max);
        if (field.regex) joiField = joiField.pattern(new RegExp(field.regex));
        if (field.enum) joiField = joiField.valid(...field.enum);
        break;

      case 'number':
        joiField = Joi.number();
        if (field.min !== undefined) joiField = joiField.min(field.min);
        if (field.max !== undefined) joiField = joiField.max(field.max);
        if (field.integer) joiField = joiField.integer();
        break;

      case 'boolean':
        joiField = Joi.boolean();
        break;

      case 'date':
        joiField = Joi.date();
        if (field.min) joiField = joiField.min(field.min);
        if (field.max) joiField = joiField.max(field.max);
        break;

      case 'array':
        const items = convertItem(field.items || { type: 'string' });
        joiField = Joi.array().items(items);
        if (field.min) joiField = joiField.min(field.min);
        if (field.max) joiField = joiField.max(field.max);
        if (field.unique) joiField = joiField.unique();
        break;

      case 'object':
        joiField = Joi.object(createNestedJoi(field.properties || {}));
        break;

      case 'objectid':
        joiField = field.ref
          ? Joi.any().meta({ ref: field.ref }) // custom tag
          : Joi.string().length(24).hex(); // MongoID
        break;

      case 'mixed':
      default:
        joiField = Joi.any();
    }

    // Required
    if (field.required) {
      joiField = joiField.required();
    } else {
      joiField = joiField.optional();
    }

    // Default
    if (field.default !== undefined) {
      const def = field.default === 'now' ? new Date() : field.default;
      joiField = joiField.default(def);
    }

    joiDef[fieldName] = joiField;
  }

  return Joi.object(joiDef).options({ stripUnknown: true });
}

// Helper: recursive nested object
function createNestedJoi(properties) {
  const nested = {};
  for (const [key, field] of Object.entries(properties)) {
    nested[key] = convertFieldToJoi(field);
  }
  return nested;
}

// Convert single field (used in array items & nested)
function convertFieldToJoi(field) {
  const type = (field.type || '').toLowerCase();
  let joi = null;

  switch (type) {
    case 'string': joi = Joi.string(); break;
    case 'number': joi = Joi.number(); break;
    case 'boolean': joi = Joi.boolean(); break;
    case 'date': joi = Joi.date(); break;
    case 'objectid': joi = Joi.string().hex().length(24); break;
    case 'array':
      const items = convertFieldToJoi(field.items || { type: 'string' });
      joi = Joi.array().items(items);
      break;
    case 'object':
      joi = Joi.object(createNestedJoi(field.properties || {}));
      break;
    default: joi = Joi.any();
  }

  if (field.required) joi = joi.required();
  if (field.default !== undefined) joi = joi.default(field.default === 'now' ? new Date() : field.default);
  if (field.enum) joi = joi.valid(...field.enum);

  return joi;
}

// Helper for array items
function convertItem(item) {
  return convertFieldToJoi(item);
}

module.exports = { createJoiSchemaFromJson };