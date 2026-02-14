const { buildMongooseSchemaInteractive } = require('./buildSchemaInteractive');

(async () => {
  try {
    const schemaJson = await buildMongooseSchemaInteractive();
    console.log('\nGenerated Schema JSON:'.green);
    console.log(JSON.stringify(schemaJson, null, 2));

    // Optional: Save to file
    const fs = require('fs');
    fs.writeFileSync(`${schemaJson.name}.schema.json`, JSON.stringify(schemaJson, null, 2));
    console.log(`\nSaved to ${schemaJson.name}.schema.json`.green);
  } catch (err) {
    console.error('Cancelled or error:', err.message);
  }
})();