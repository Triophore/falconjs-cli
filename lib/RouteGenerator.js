const { input, select, confirm } = require("@inquirer/prompts");
const fs = require("fs").promises;
const path = require("path");

class RouteGenerator {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.type = options.type || 'route'; // 'route' or 'validator'
    }

    async generate(name) {
        const currentDir = process.cwd();

        // Check if we're in a Falcon project
        try {
            await fs.access(path.join(currentDir, 'settings.js'));
        } catch (error) {
            throw new Error('Not in a Falcon.js project directory. Run this command from your project root.');
        }

        if (!name) {
            name = await input({
                message: `${this.type === 'validator' ? 'Validator' : 'Route'} name (e.g., User):`,
                validate: v => v.trim() ? true : 'Name is required',
            });
        }

        if (this.type === 'validator') {
            await this.generateValidator(currentDir, name);
        } else {
            await this.generateRoute(currentDir, name);
        }
    }

    async generateRoute(projectDir, name) {
        const routesDir = path.join(projectDir, 'routes');
        await fs.mkdir(routesDir, { recursive: true });

        // Determine path and filename
        // If name contains /, treat as path
        const parts = name.split('/');
        const fileName = parts.pop();
        const subDir = parts.join('/');

        const targetDir = path.join(routesDir, subDir);
        await fs.mkdir(targetDir, { recursive: true });

        const filePath = path.join(targetDir, `${fileName}.js`);

        // Check if file exists
        try {
            await fs.access(filePath);
            const overwrite = await confirm({
                message: `Route file ${filePath} already exists. Overwrite?`,
                default: false
            });
            if (!overwrite) return;
        } catch (e) {
            // File doesn't exist, proceed
        }

        // Helper to get template content
        const templatePath = path.join(__dirname, '..', 'templates', 'example-route.js');
        let content = await fs.readFile(templatePath, 'utf8');

        // Simple replacements if needed, or just use the example as a starter
        // For now, we'll just write the template

        await fs.writeFile(filePath, content);
        console.log(`✅ Route created: ${filePath}`);
    }

    async generateValidator(projectDir, name) {
        const validatorsDir = path.join(projectDir, 'validators');
        await fs.mkdir(validatorsDir, { recursive: true });

        const filePath = path.join(validatorsDir, `${name}.js`);

        // Check if file exists
        try {
            await fs.access(filePath);
            const overwrite = await confirm({
                message: `Validator file ${filePath} already exists. Overwrite?`,
                default: false
            });
            if (!overwrite) return;
        } catch (e) {
            // File doesn't exist, proceed
        }

        const templatePath = path.join(__dirname, '..', 'templates', 'example-validator.js');
        let content = await fs.readFile(templatePath, 'utf8');

        // Replace Joi with Joi (no change needed usually, but good for future)

        await fs.writeFile(filePath, content);
        console.log(`✅ Validator created: ${filePath}`);
    }
}

module.exports = RouteGenerator;
