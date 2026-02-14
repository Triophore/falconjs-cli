const { input, confirm } = require("@inquirer/prompts");
const fs = require("fs").promises;
const path = require("path");

class ServiceGenerator {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.type = options.type || 'service'; // 'service' or 'worker'
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
                message: `${this.type === 'worker' ? 'Worker' : 'Service'} name (e.g., Email):`,
                validate: v => v.trim() ? true : 'Name is required',
            });
        }

        const dirName = this.type === 'worker' ? 'workers' : 'services';
        const targetDir = path.join(currentDir, dirName);
        await fs.mkdir(targetDir, { recursive: true });

        const filePath = path.join(targetDir, `${name}.js`);

        // Check if file exists
        try {
            await fs.access(filePath);
            const overwrite = await confirm({
                message: `${this.type === 'worker' ? 'Worker' : 'Service'} file ${filePath} already exists. Overwrite?`,
                default: false
            });
            if (!overwrite) return;
        } catch (e) {
            // File doesn't exist, proceed
        }

        // Get template
        const templateName = this.type === 'worker' ? 'example-worker.js' : 'example-service.js';
        const templatePath = path.join(__dirname, '..', 'templates', templateName);
        let content = await fs.readFile(templatePath, 'utf8');

        await fs.writeFile(filePath, content);
        console.log(`✅ ${this.type === 'worker' ? 'Worker' : 'Service'} created: ${filePath}`);

        // Update settings.js to include the service/worker
        await this.updateSettings(currentDir, name, dirName);
    }

    async updateSettings(projectDir, name, listName) {
        const settingsPath = path.join(projectDir, 'settings.js');
        let settingsContent = await fs.readFile(settingsPath, 'utf8');

        // Regex to find the array:  services: [...] or workers: [...]
        const regex = new RegExp(`${listName}:\\s*\\[(.*?)\\]`, 's');
        const match = settingsContent.match(regex);

        if (match) {
            const listContent = match[1];
            // Simple check if name is already there
            if (!listContent.includes(`"${name}"`) && !listContent.includes(`'${name}'`)) {
                const newListContent = listContent.trim()
                    ? `${listContent.trim()}, "${name}"`
                    : `"${name}"`;

                settingsContent = settingsContent.replace(
                    regex,
                    `${listName}: [${newListContent}]`
                );
                await fs.writeFile(settingsPath, settingsContent);
                console.log(`✅ Added "${name}" to settings.js ${listName} array`);
            }
        }
    }
}

module.exports = ServiceGenerator;
