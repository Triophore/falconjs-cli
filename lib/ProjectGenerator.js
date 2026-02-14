const { input, select, confirm } = require("@inquirer/prompts");
const fs = require("fs").promises;
const path = require("path");
const { spawn } = require('child_process');

const { showSuccess, runNpmInstall, createDirectory } = require('./utils');

class ProjectGenerator {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.skipInstall = options.skipInstall || false;
        this.useDefaults = options.useDefaults || false;
    }

    async create(projectName, template = 'basic') {
        const currentDir = process.cwd();
        
        // Get project name if not provided
        if (!projectName) {
            projectName = await input({
                message: 'Project name:',
                validate: v => v.trim() ? true : 'Project name is required',
            });
        }

        const projectPath = path.join(currentDir, projectName);

        // Check if directory exists
        try {
            await fs.access(projectPath);
            const overwrite = await confirm({
                message: `Directory "${projectName}" already exists. Overwrite?`,
                default: false
            });
            if (!overwrite) {
                console.log('❌ Project creation cancelled');
                return;
            }
        } catch (error) {
            // Directory doesn't exist, which is good
        }

        console.log(`\n🚀 Creating Falcon.js project: ${projectName}\n`);

        // Create project structure
        await this.createProjectStructure(projectPath, projectName, template);
        
        // Install dependencies
        if (!this.skipInstall) {
            console.log('📦 Installing dependencies...');
            await runNpmInstall(projectPath);
        }

        showSuccess(projectName, this.skipInstall);
    }

    async createProjectStructure(projectPath, projectName, template) {
        // Create directories
        const directories = [
            'models/mongo',
            'routes',
            'services', 
            'workers',
            'validators',
            'init',
            'logs',
            'public'
        ];

        for (const dir of directories) {
            await createDirectory(path.join(projectPath, dir));
        }

        // Create files
        await this.createPackageJson(projectPath, projectName);
        await this.createSettings(projectPath, projectName);
        await this.createIndexJs(projectPath);
        await this.createEnvFile(projectPath, projectName);
        await this.createExampleFiles(projectPath);
    }

    async createPackageJson(projectPath, projectName) {
        const packageJson = {
            name: projectName,
            version: "1.0.0",
            description: "Falcon.js application",
            main: "index.js",
            scripts: {
                start: "node index.js",
                dev: "nodemon index.js",
                test: "echo \"Error: no test specified\" && exit 1"
            },
            keywords: ["falcon", "nodejs", "api"],
            author: "",
            license: "ISC",
            type: "commonjs",
            dependencies: {
                "falconjs": "file:../falconjs",
                "@hapi/boom": "^10.0.1",
                "@hapi/inert": "^7.1.0", 
                "@hapi/vision": "^7.0.3",
                "joi": "^17.13.3",
                "mongoose": "^8.3.1",
                "redis": "^4.7.0",
                "mqtt": "^5.13.3",
                "log4js": "^6.9.1",
                "rate-limiter-flexible": "^2.4.2",
                "hapi-alive": "^2.0.4",
                "hapi-swagger": "^17.2.1",
                "dotenv": "^16.0.0"
            },
            devDependencies: {
                "nodemon": "^3.1.10"
            }
        };

        await fs.writeFile(
            path.join(projectPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
    }

    async createSettings(projectPath, projectName) {
        const settings = `module.exports.settings = {
  name: "${projectName}",
  http: {
    host: process.env.HTTP_HOST || "localhost",
    port: process.env.HTTP_PORT || 3000
  },
  database: {
    mongodb: {
      database: process.env.MONGODB_URL || "mongodb://localhost:27017/${projectName}_db"
    }
  },
  mqtt: {
    internal: true,
    external: false
  },
  log: {
    appenders: {
      file: {
        type: "file",
        filename: process.env.LOG_FILE_NAME || "logs/app.log",
        maxLogSize: process.env.LOG_MAX_SIZE || "10M",
        backups: 3
      },
      console: {
        type: "console"
      }
    },
    categories: {
      default: {
        appenders: ["file", "console"],
        level: process.env.LOG_LEVEL || "info"
      }
    }
  },
  swagger: {
    enabled: true,
    path: "/documentation"
  },
  auth: {
    jwt: {
      key: process.env.JWT_SECRET || "your-secret-key-here",
      validate: async (decoded, request) => {
        // Your JWT validation logic
        return { id: decoded.id, roles: decoded.roles };
      }
    },
    default: "jwt"
  },
  services: [],
  workers: [],
  models: [],
  routes: [],
  crud: {
    exclude: []
  },
  postInit: "post"
};`;

        await fs.writeFile(path.join(projectPath, 'settings.js'), settings);
    }

    async createIndexJs(projectPath) {
        const indexContent = await fs.readFile(
            path.join(__dirname, '../templates/index.txt'),
            'utf8'
        );
        await fs.writeFile(path.join(projectPath, 'index.js'), indexContent);
    }

    async createEnvFile(projectPath, projectName) {
        const envContent = `# Falcon.js Environment Configuration
# Generated by falcon-cli

# Server Configuration
HTTP_HOST=localhost
HTTP_PORT=3000

# Database Configuration  
MONGODB_URL=mongodb://localhost:27017/${projectName}_db

# MQTT Configuration
MQTT_PORT=1883
MQTT_URL=mqtt://localhost:1883

# Redis Configuration (optional)
REDIS_ENABLE=false
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Logging
LOG_LEVEL=info
LOG_FILE_NAME=logs/app.log
LOG_MAX_SIZE=10M

# Development Mode
MODE=DEV
`;

        await fs.writeFile(path.join(projectPath, '.env'), envContent);
    }

    async createExampleFiles(projectPath) {
        const templates = [
            { src: 'example-route.js', dest: 'routes/example.js' },
            { src: 'example-validator.js', dest: 'validators/ExamplePayload.js' },
            { src: 'example-service.js', dest: 'services/example.js' },
            { src: 'example-worker.js', dest: 'workers/example.js' },
            { src: 'post-init.js', dest: 'init/post.js' }
        ];

        for (const template of templates) {
            const content = await fs.readFile(
                path.join(__dirname, '../templates', template.src),
                'utf8'
            );
            await fs.writeFile(path.join(projectPath, template.dest), content);
        }
    }
}

module.exports = ProjectGenerator;
