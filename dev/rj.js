// run.js
const { interactiveJoiBuilder } = require('./interactiveJoiBuilder');
const { generateJoiFile } = require('./generateJoiFile');

(async () => {
  try {
    console.clear();
    const config = await interactiveJoiBuilder();
    console.log('\nGenerated Joi Config:'.green);
    console.log(JSON.stringify(config, null, 2));

    generateJoiFile(config, './joi-schemas');

    console.log('\nJoi schema generated and saved!'.green);
  } catch (err) {
    console.error('Cancelled or error:'.red, err.message);
  }
})();