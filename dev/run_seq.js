// run.js
const { buildSequelizeSchemaInteractive } = require('./buildSequelizeSchemaInteractive');
const { exportFiles } = require('./generateSequelizeFiles');

(async () => {
  try {
    console.clear();
    const config = await buildSequelizeSchemaInteractive();
    console.log('\nGenerated Config:'.green);
    console.log(JSON.stringify(config, null, 2));

    exportFiles(config);

    console.log('\nAll files generated successfully!'.green);
  } catch (err) {
    console.error('Cancelled or error:'.red, err.message);
  }
})();