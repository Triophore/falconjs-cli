const { input, select, confirm, checkbox } = require("@inquirer/prompts");
const fs = require("fs").promises;
const path = require("path");

class ModelGenerator {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
    }

    async generate(modelName, options = {}) {
        const currentDir = process.cwd();
        const modelsDir = path.join(currentDir, 'models', 'mongo');

        // Check if we're in a Falcon project
        try {
            await fs.access(path.join(currentDir, 'settings.js'));
        } catch (error) {
            throw new Error('Not in a Falcon.js project directory. Run this command from your project root.');
        }

        // Get model name if not provided
        if (!modelName) {
            modelName = await input({
                message: 'Model name (e.g., User):',
                validate: v => v.trim() ? true : 'Model name is required',
            });
        }

        console.log(`\n🔧 Generating model: ${modelName}\n`);

        // Create models directory if it doesn't exist
        try {
            await fs.mkdir(modelsDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }

        // Generate model interactively
        const modelContent = await this.buildModelInteractively(modelName);
        
        // Write model file
        const modelPath = path.join(modelsDir, `${modelName.toLowerCase()}.js`);
        await fs.writeFile(modelPath, modelContent);

        console.log(`✅ Model created: ${modelPath}`);

        // Update settings.js to include the model
        await this.updateSettings(currentDir, modelName.toLowerCase());

        // Generate CRUD routes if requested
        if (options.crud) {
            await this.generateCrudRoutes(currentDir, modelName);
        }
    }

    async buildModelInteractively(modelName) {
        const fields = {};
        const indexes = [];
        
        // Add timestamps option
        const useTimestamps = await confirm({
            message: 'Enable timestamps (createdAt, updatedAt)?',
            default: true
        });

        console.log('\n📝 Add fields to your model:\n');

        // Add fields interactively
        while (true) {
            const addField = await confirm({
                message: 'Add a field?',
                default: true
            });

            if (!addField) break;

            const fieldName = await input({
                message: 'Field name:',
                validate: v => v && !fields[v] ? true : 'Invalid or duplicate field name',
            });

            const fieldType = await select({
                message: 'Field type:',
                choices: [
                    { name: 'String', value: 'String' },
                    { name: 'Number', value: 'Number' },
                    { name: 'Boolean', value: 'Boolean' },
                    { name: 'Date', value: 'Date' },
                    { name: 'ObjectId (Reference)', value: 'ObjectId' },
                    { name: 'Array', value: 'Array' },
                    { name: 'Mixed (Object)', value: 'Mixed' }
                ]
            });

            const fieldOptions = {};

            // Common options
            const isRequired = await confirm({
                message: 'Is this field required?',
                default: false
            });
            if (isRequired) fieldOptions.required = true;

            const hasIndex = await confirm({
                message: 'Add index to this field?',
                default: false
            });
            if (hasIndex) fieldOptions.index = true;

            // Type-specific options
            if (fieldType === 'String') {
                const isUnique = await confirm({
                    message: 'Should this field be unique?',
                    default: false
                });
                if (isUnique) fieldOptions.unique = true;

                const maxLength = await input({
                    message: 'Maximum length (optional):',
                    validate: v => !v || !isNaN(v) ? true : 'Must be a number'
                });
                if (maxLength) fieldOptions.maxlength = parseInt(maxLength);
            }

            if (fieldType === 'ObjectId') {
                const refModel = await input({
                    message: 'Reference model name:',
                    validate: v => v.trim() ? true : 'Reference model is required'
                });
                fieldOptions.ref = refModel;
            }

            fields[fieldName] = {
                type: fieldType,
                ...fieldOptions
            };
        }

        return this.generateModelCode(modelName, fields, { timestamps: useTimestamps });
    }

    generateModelCode(modelName, fields, options = {}) {
        const fieldsCode = Object.entries(fields)
            .map(([name, config]) => {
                const configStr = JSON.stringify(config, null, 4)
                    .replace(/"([^"]+)":/g, '$1:')
                    .replace(/"/g, "'");
                return `    ${name}: ${configStr}`;
            })
            .join(',\n');

        const optionsCode = options.timestamps ? '{ timestamps: true }' : '{}';

        return `module.exports = async function (mongoose) {
    const ${modelName}Schema = new mongoose.Schema({
${fieldsCode}
    }, ${optionsCode});

    // Add any custom methods here
    // ${modelName}Schema.methods.customMethod = function() {
    //     // Custom instance method
    // };

    // ${modelName}Schema.statics.customStatic = function() {
    //     // Custom static method
    // };

    return mongoose.model('${modelName}', ${modelName}Schema);
};`;
    }

    async updateSettings(projectDir, modelName) {
        const settingsPath = path.join(projectDir, 'settings.js');
        let settingsContent = await fs.readFile(settingsPath, 'utf8');

        // Add model to models array if not already present
        const modelRegex = /models:\s*\[(.*?)\]/s;
        const match = settingsContent.match(modelRegex);

        if (match) {
            const modelsArray = match[1];
            if (!modelsArray.includes(`"${modelName}"`)) {
                const newModelsArray = modelsArray.trim() 
                    ? `${modelsArray.trim()}, "${modelName}"`
                    : `"${modelName}"`;
                settingsContent = settingsContent.replace(
                    modelRegex,
                    `models: [${newModelsArray}]`
                );
                await fs.writeFile(settingsPath, settingsContent);
                console.log(`✅ Added "${modelName}" to settings.js models array`);
            }
        }
    }

    async generateCrudRoutes(projectDir, modelName) {
        // This would generate basic CRUD routes
        console.log(`🔧 Generating CRUD routes for ${modelName}...`);
        // Implementation would go here
    }
}

module.exports = ModelGenerator;
