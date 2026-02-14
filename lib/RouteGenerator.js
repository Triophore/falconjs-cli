const path = require('path');
const fs = require('fs').promises;
const { input, select } = require('@inquirer/prompts');

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

        const method = await select({
            message: 'HTTP Method:',
            choices: [
                { name: 'GET', value: 'GET' },
                { name: 'POST', value: 'POST' },
                { name: 'PUT', value: 'PUT' },
                { name: 'DELETE', value: 'DELETE' },
                { name: 'PATCH', value: 'PATCH' },
                { name: 'ANY', value: '*' },
            ]
        });

        console.log(`\n🔧 Generating route: ${name} [${method}]\n`);

        // Construct filename: [METHOD]#name.js
        const filename = `[${method.toUpperCase()}]#${name.toLowerCase()}.js`;

        // Handle nested paths
        // If name contains slashes, we need to handle directory creation
        // But wait, if name is "auth/login", filename becomes "[GET]#auth/login.js" which is wrong.
        // We want "auth/[GET]#login.js".

        let finalPath;
        if (name.includes('/') || name.includes('\\')) {
            const parts = name.split(/[/\\]/);
            const baseName = parts.pop();
            const dirPath = parts.join('/');

            finalPath = path.join(routesDir, dirPath, `[${method.toUpperCase()}]#${baseName.toLowerCase()}.js`);

            // Create subdirectories
            try {
                await fs.mkdir(path.dirname(finalPath), { recursive: true });
            } catch (error) {
                // Ignore
            }
        } else {
            finalPath = path.join(routesDir, filename);
            // Ensure routes dir exists
            try {
                await fs.mkdir(routesDir, { recursive: true });
            } catch (err) { }
        }


        const routeContent = this.getRouteTemplate(name, method);
        await fs.writeFile(finalPath, routeContent);

        console.log(`✅ Route created: ${finalPath}`);
    }

    getRouteTemplate(name, method) {
        method = method === '*' ? 'ANY' : method;
        return `/**
 * ${method} Route for ${name}
 */
module.exports = {
    options: {
        tags: ['api'],
        description: 'Auto-generated ${method} route',
        notes: 'Returns example data',
        validate: {} // Add payload/query/params validation here
    },
    handler: async (request, h) => {
        return {
            success: true,
            message: 'Hello from Falcon.js!',
            timestamp: new Date().toISOString(),
            // data: request.payload // for POST/PUT
        };
    }
};`;
    }
}

module.exports = RouteGenerator;
