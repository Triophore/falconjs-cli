// buildSequelizeSchemaInteractive.js
const {
  input,
  confirm,
  select,
  checkbox,
} = require('@inquirer/prompts');

async function buildSequelizeSchemaInteractive() {
  console.log('\nSequelize Model + Migration Builder\n');

  const modelName = await input({
    message: 'Model name (singular, e.g., User):',
    validate: v => v.trim() ? true : 'Required',
  });

  const tableName = await input({
    message: 'Table name (or press Enter to use model name):',
    default: modelName.toLowerCase() + 's',
  });

  const useTimestamps = await confirm({
    message: 'Add timestamps (createdAt, updatedAt)?',
    default: true,
  });

  const useParanoid = await confirm({
    message: 'Enable soft deletes (deletedAt)?',
    default: false,
  });

  const schema = {};
  const associations = [];
  const options = {
    timestamps: useTimestamps,
    paranoid: useParanoid,
    tableName: tableName.trim() || undefined,
    freezeTableName: true,
  };

  // ── Fields
  while (true) {
    const add = await confirm({ message: 'Add field?', default: true });
    if (!add) break;

    const fieldName = await input({
      message: 'Field name:',
      validate: v => v && !schema[v] ? true : 'Invalid/duplicate',
    });

    const dataType = await select({
      message: `Data type for "${fieldName}":`,
      choices: [
        'STRING', 'TEXT', 'INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE',
        'BOOLEAN', 'DATE', 'DATEONLY', 'JSON', 'ARRAY', 'ENUM'
      ].map(t => ({ name: t, value: t })),
    });

    const field = { type: dataType };

    const allowNull = await confirm({ message: 'Allow NULL?', default: true });
    if (!allowNull) field.allowNull = false;

    const unique = await confirm({ message: 'Unique?', default: false });
    if (unique) field.unique = true;

    // Default value
    const hasDefault = await confirm({ message: 'Set default?', default: false });
    if (hasDefault) {
      if (dataType === 'BOOLEAN') {
        field.defaultValue = await confirm({ message: 'Default TRUE?', default: true });
      } else if (dataType === 'DATE') {
        field.defaultValue = await confirm({ message: 'Default NOW?', default: true })
          ? 'sequelize.fn("NOW")'
          : await input({ message: 'Default (JS):' });
      } else if (dataType === 'ENUM') {
        const vals = await input({ message: 'Enum values (comma-separated):' });
        field.values = vals.split(',').map(v => v.trim()).filter(Boolean);
        const def = await input({ message: 'Default value:' });
        field.defaultValue = def.trim();
      } else {
        const def = await input({ message: 'Default value (JS):' });
        field.defaultValue = def;
      }
    }

    // String length
    if (dataType === 'STRING') {
      const len = await input({ message: 'Length (default 255):', default: '255' });
      if (len !== '255') field.type = `STRING(${len})`;
    }

    // Array items
    if (dataType === 'ARRAY') {
      const itemType = await select({
        message: 'Array item type:',
        choices: ['STRING', 'INTEGER', 'FLOAT', 'BOOLEAN', 'DATE'].map(t => ({ name: t, value: t })),
      });
      field.type = `${itemType}[]`;
    }

    schema[fieldName] = field;
  }

  // ── Associations
  while (true) {
    const addAssoc = await confirm({ message: 'Add association?', default: false });
    if (!addAssoc) break;

    const type = await select({
      message: 'Association type:',
      choices: [
        { name: 'belongsTo', value: 'belongsTo' },
        { name: 'hasMany', value: 'hasMany' },
      ],
    });

    const targetModel = await input({ message: 'Target model name:' });
    const foreignKey = await input({ message: 'Foreign key (in this table):', default: `${targetModel}Id` });
    const as = await input({ message: 'Alias (as):', default: targetModel.toLowerCase() });

    associations.push({ type, targetModel, foreignKey, as });
  }

  return { name: modelName, tableName: tableName.trim(), schema, associations, options };
}

module.exports = { buildSequelizeSchemaInteractive };