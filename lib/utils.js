const fs = require("fs").promises;
const path = require("path");
const { spawn } = require('child_process');

const logo = `
███████╗ █████╗ ██╗      ██████╗ ██████╗ ███╗   ██╗
██╔════╝██╔══██╗██║     ██╔════╝██╔═══██╗████╗  ██║
█████╗  ███████║██║     ██║     ██║   ██║██╔██╗ ██║
██╔══╝  ██╔══██║██║     ██║     ██║   ██║██║╚██╗██║
██║     ██║  ██║███████╗╚██████╗╚██████╔╝██║ ╚████║
╚═╝     ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝
                                                    
🚀 Falcon.js CLI - Build powerful Node.js APIs
Powered by Triophore Technologies
Visit us at https://triophore.com
`;

function showLogo() {
    console.log(logo);
}

function showSuccess(projectName, skipInstall = false) {
    console.log(`
✅ Falcon.js project created successfully!

📁 Project structure:
   ├── index.js          # Main application entry point
   ├── settings.js       # Falcon configuration
   ├── .env             # Environment variables
   ├── package.json     # Dependencies
   ├── routes/          # API route handlers
   ├── models/mongo/    # Database models
   ├── services/        # Background services
   ├── workers/         # Job processors
   ├── validators/      # Joi validation schemas
   ├── init/           # Initialization scripts
   └── logs/           # Application logs

🚀 Next steps:
   1. cd ${projectName}${skipInstall ? '\n   2. npm install' : ''}
   ${skipInstall ? '3' : '2'}. npm run dev

📚 Documentation will be available at: http://localhost:3000/documentation
❤️  Health check at: http://localhost:3000/health
`);
}

async function createDirectory(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

function runNpmInstall(projectPath, packageName = null) {
    return new Promise((resolve, reject) => {
        const args = packageName ? ['install', packageName] : ['install'];
        const npm = spawn('npm', args, {
            cwd: projectPath,
            stdio: 'inherit'
        });

        npm.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`npm install failed with code ${code}`));
            }
        });

        npm.on('error', (error) => {
            reject(error);
        });
    });
}

function validateProjectName(name) {
    if (!name || typeof name !== 'string') {
        return 'Project name is required';
    }

    if (!/^[a-z0-9-_]+$/i.test(name)) {
        return 'Project name can only contain letters, numbers, hyphens, and underscores';
    }

    if (name.length < 2) {
        return 'Project name must be at least 2 characters long';
    }

    return true;
}

module.exports = {
    showLogo,
    showSuccess,
    createDirectory,
    runNpmInstall,
    validateProjectName
};
