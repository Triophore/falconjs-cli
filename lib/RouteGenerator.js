const path = require('path');
const fs = require('fs').promises;
const { input } = require('@inquirer/prompts');

class RouteGenerator {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
    }

    async generate(name) {
        const currentDir = process.cwd();
        const routesDir = path.join(currentDir, 'routes');

        // Check if we're in a Falcon project
        try {
            await fs.access(path.join(currentDir, 'settings.js'));
        } catch (error) {
            throw new Error('Not in a Falcon.js project directory. Run this command from your project root.');
        }

        if (!name) {
            name = await input({
                message: 'Route name (e.g., users):',
                validate: v => v.trim() ? true : 'Route name is required',
            });
        }

        console.log(`\n🔧 Generating route: ${name}\n`);

        // Create routes directory if it doesn't exist
        try {
            await fs.mkdir(routesDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }

        const routeContent = this.getRouteTemplate(name);
        const routePath = path.join(routesDir, `${name.toLowerCase()}.js`);

        await fs.writeFile(routePath, routeContent);

        console.log(`✅ Route created: ${routePath}`);
    }

    getRouteTemplate(name) {
        return `module.exports.route = async function (context) {
            context.server.route({
                method: 'GET',
                path: '/${name.toLowerCase()}',
                options: {
                    tags: ['api', 'example'],
                    description: 'Example GET endpoint',
                    notes: 'Returns example data'
                },
                handler: async (request, h) => {
                    return {
                        success: true,
                        message: 'Hello from Falcon.js!',
                        timestamp: new Date().toISOString()
                    };
                }
            });

        };`;
    }
}

module.exports = RouteGenerator;
