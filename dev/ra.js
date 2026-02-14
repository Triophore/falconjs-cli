// run.js
const { interactiveModelBuilder } = require('./interactiveModelBuilder');
const { generateAllFiles } = require('./generateAllFiles');
const { createModelFromJson } = require('./createModelFromJson');
const { createJoiSchemaFromJson } = require('./createJoiSchemaFromJson');

(async () => {
  try {
    const config = await interactiveModelBuilder();
    console.log('\nConfig:'.green, JSON.stringify(config, null, 2));

    generateAllFiles(config);

    // Optional: test
    const result = createModelFromJson(config);
    const joi = createJoiSchemaFromJson({ schema: config.joi });
    console.log('\nJoi schema ready! Use:'.cyan, `joi.validate(data)`);

  } catch (err) {
    console.error('Cancelled:', err.message);
  }
})();