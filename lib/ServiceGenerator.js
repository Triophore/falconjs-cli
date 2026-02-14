const path = require('path');
const fs = require('fs').promises;
const { input } = require('@inquirer/prompts');

class ServiceGenerator {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.type = options.type || 'service'; // can be 'service' or 'worker'
    }

    async generate(name) {
        const currentDir = process.cwd();
        const baseDir = this.type === 'worker' ? 'workers' : 'services';
        const targetDir = path.join(currentDir, baseDir);

        // Check if we're in a Falcon project
        try {
            await fs.access(path.join(currentDir, 'settings.js'));
        } catch (error) {
            throw new Error('Not in a Falcon.js project directory. Run this command from your project root.');
        }

        if (!name) {
            name = await input({
                message: `${this.type.charAt(0).toUpperCase() + this.type.slice(1)} name:`,
                validate: v => v.trim() ? true : 'Name is required',
            });
        }

        console.log(`\n🔧 Generating ${this.type}: ${name}\n`);

        // Create directory if it doesn't exist
        try {
            await fs.mkdir(targetDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }

        const content = this.getTemplate(name);
        const fileName = `${name.toLowerCase()}.js`;
        const filePath = path.join(targetDir, fileName);

        await fs.writeFile(filePath, content);

        console.log(`✅ ${this.type.charAt(0).toUpperCase() + this.type.slice(1)} created: ${filePath}`);
    }

    getTemplate(name) {
        if (this.type === 'worker') {
            return `module.exports = async function (job) {
    // Process job here
    console.log('Processing job:', job.id);
    return { done: true };
};`;
        }

        return `class ${name}Service {
    constructor(app) {
        this.app = app;
    }

    async doSomething() {
        return 'done';
    }
}

module.exports = ${name}Service;`;
    }
}

module.exports = ServiceGenerator;
