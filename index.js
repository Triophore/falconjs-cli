#!/usr/bin/env node

const {
    input,
    select,
    Separator,
    confirm,
    checkbox,
    password,
} = require("@inquirer/prompts");

process.on('SIGINT', shutdown);

process.on('uncaughtException', (error) => {
    if (error instanceof Error && error.name === 'ExitPromptError') {
        // This catches the prompt rejection globally
        console.log('\n👋 Until next time!');
        process.exit(0); // Exit gracefully after logging
    } else {
        // For other uncaught errors, log them and exit
        console.error('Uncaught Exception:', error);
        process.exit(1);
    }
});

// Do graceful shutdown
function shutdown() {
    console.log('Shutting down');
    process.exit(0)
}

const fs = require("fs");
const path = require("path");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
const argv = yargs(hideBin(process.argv)).parse();
const { spawn } = require('child_process');

const settings_template = require("./templates/settings").settings

const currentDir = process.cwd();

const templatev1 = require("./templates/templatev1.json");

var model = {};

const mongoose_builder = require("./builder/interactiveMongobuilder").buildMongooseSchemaInteractive;

const interactiveModelBuilder = require("./builder/interactiveUnifiedBuilder").interactiveUnifiedBuilder;

const mongoose_schema_builder = require("./builder/mongooseModelBuilder").mongooseModelBuilder

var EnvVals = []

var NpmDeps = []

var ImportsArry = [];

var mkDir = []

var mkFile = []

async function start() {

    // create other things  
    if (argv.create) {
        switch (argv.create) {
            case "model":
                console.log("Creating model");
                await create_mongoose_model()
                break;
            case "array":
                console.log("Creating array...");
                break;
            default:
                console.log("Invalid option");
        }
    } else {
        //create new project
        console.log(require("./logo").logo)
        console.log("--------------------------------------")
        console.log("Falcon CLI")
        console.log("--------------------------------------")

        var app_settings = {};

        const confirm_start = await confirm({
            message: "Create new Falcon app here?",
        });

        if (!confirm_start) {
            console.log("Exiting...");
            process.exit(0);
        }

        const app_name = await input({
            message: 'App name:',
            validate: v => v.trim() ? true : 'Required',
        });

        templatev1["name"] = app_name
        app_settings["name"] = app_name

        app_settings["http"] = settings_template.http.params;

        EnvVals.push("HTTP_HOST=''")
        EnvVals.push("HTTP_PORT=")

        // console.log("Project Config")

        const log_config = await select({
            message: 'Log Configure',
            choices: [
                { name: 'File', value: 'file' },
                { name: 'Stdio', value: 'stdio' },
                { name: 'Stdio and File', value: 'both' },
            ],
        });

        app_settings["log"] = log_config

        const enable_static = await confirm({
            message: 'Enable Static Serving',
            default: false,
        });

        if (enable_static) {
            app_settings["static"] = settings_template["static"].params
            settings_template["static"].deps.forEach((dep) => { NpmDeps.push(dep) })
            ImportsArry.push(settings_template["static"].require)
            mkDir.push("public")
        }

        const enable_templates = await confirm({
            message: 'Enable Templates',
            default: false,
        });

        if (enable_templates) {
            app_settings["templates"] = settings_template.templates["eta"].params
            settings_template.templates.deps.forEach((dep) => { NpmDeps.push(dep) })
            settings_template.templates["eta"].deps.forEach((dep) => { NpmDeps.push(dep) })
            mkDir.push("templates")
        }

        const enable_crumb = await confirm({
            message: 'Enable Crumb for CSRF',
            default: false,
        });

        app_settings["crumb"] = enable_crumb

        const enable_blipp = await confirm({
            message: 'Enable Blipp (Route printing in log)',
            default: false,
        });


        const enable_database = await confirm({
            message: 'Enable Database?',
            default: false,
        });

        if (enable_database) {
            app_settings["database"] = {};
            app_settings["database"]["mongodb"] = settings_template.database.mongodb.params
        }

        // app_settings["blipp"] = enable_blipp

        const enable_redis = await confirm({
            message: 'Enable Redis',
            default: false,
        });

        app_settings["redis"] = enable_redis

        const mqtt_choice = await select({
            message: 'MQTT type?',
            choices: [
                { name: 'Inbuilt', value: 'aedes' },
                { name: 'External', value: 'external' },
            ],
        });

        app_settings["mqtt"] = mqtt_choice

        const enable_websocket = await confirm({
            message: 'Enable Websocket (Socket.io)',
            default: true,
        });

        if (enable_websocket) {
            app_settings["websocket"] = {}
            mkDir.push("websocket")
            const web_sock_transport = await select({
                message: 'WebSocket Transport type?',
                choices: [
                    { name: 'text', value: 'text' },
                    { name: 'binary', value: 'binary' },
                ],
            });
            console.log(web_sock_transport)
            app_settings["websocket"][web_sock_transport] = {};
            app_settings["websocket"][web_sock_transport] = settings_template.websocket[web_sock_transport].params
        }


        const enable_auth = await confirm({
            message: 'Enable Authentication',
            default: true,
        });

        if (enable_auth) {
            app_settings["auth"] = {}
            const auth_choice = await select({
                message: 'Select Auth type(s)?',
                choices: [
                    { name: 'Basic', value: 'basic' },
                    { name: 'JWT', value: 'jwt' },
                    { name: 'JWKS', value: 'jwks' },
                    { name: 'Cookie', value: 'cookie' },
                    { name: 'Openid', value: 'openid' },
                ],
            });
            mkDir.push("auth")
        }

        mkDir.push("models/mongo")  // Fixed: falconjs expects models in models/mongo/
        mkDir.push("routes")
        mkDir.push("services")
        mkDir.push("workers")
        mkDir.push("validators")
        mkDir.push("init")
        mkDir.push("logs")

        if (enable_static) {
            mkDir.push("public")
        }

        if (enable_templates) {
            mkDir.push("templates")
        }

        // const enable_init_script = await confirm({
        //     message: 'Create Init Script: ?',
        //     default: false,
        // });

        // app_settings["init"] = enable_init_script

        // const enable_post_script = await confirm({
        //     message: 'Create Post Init Script: ?',
        //     default: false,
        // });

        // app_settings["post"] = enable_post_script

        // const enable_service = await confirm({
        //     message: 'Create a Falcon Service',
        //     default: false,
        // });

        // app_settings["service"] = enable_service

        // const enable_worker = await confirm({
        //     message: 'Create a Falcon Worker',
        //     default: false,
        // });

        // app_settings["worker"] = enable_worker



        // app_settings["database"] = db_choice

        // app_settings["databasasd"] = 'process.env.API_URL || "mongo://localhost:27017/"'

        // console.log(app_settings)

        // await writeJsonToCjsModule(app_settings,"./settings.js")

        await fs.promises.appendFile(path.join(currentDir, ".env"), "# Created by falcon CLI" + '\n')
        for (var i = 0; i < EnvVals.length; i++) {
            await fs.promises.appendFile(path.join(currentDir, ".env"), EnvVals[i] + '\n')
        }
        await fs.promises.appendFile(path.join(currentDir, ".env"), "#------------------------------------------------------#" + '\n')
        await fs.promises.appendFile(path.join(currentDir, ".env"), "# Please add app specific ENV values below" + '\n')
        await fs.promises.appendFile(path.join(currentDir, ".env"), "#------------------------------------------------------#" + '\n')

        var imports_text = "";
        for (var i = 0; i < ImportsArry.length; i++) {
            imports_text = imports_text + ImportsArry[i].slice(3).trim() + "\n";
        }

        if (ImportsArry.length) {
            await require("./builder/createCjsModule").createCjsModule(path.join(currentDir, "settings.js"), app_settings, {
                exportStyle: "default",
                functionName: "settings",
                pretty: true,
                async: false,
                imports: imports_text,
            })
        } else {
            await require("./builder/createCjsModule").createCjsModule(path.join(currentDir, "settings.js"), app_settings, {
                exportStyle: "default",
                functionName: "settings",
                pretty: true,
                async: false,
                imports: false,
            })
        }

        await fs.promises.writeFile(path.join(currentDir, "package.json"), JSON.stringify(templatev1, null, 2))
        console.log("installing core packages")
        runNpmInstall(currentDir)
        console.log("Installing project packages")

        for (var i = 0; i < NpmDeps.length; i++) {
            runNpmInstall(currentDir, NpmDeps[i])
        }

        for (var i = 0; i < mkDir.length; i++) {
            try {
                await fs.promises.access(path.join(currentDir, mkDir[i]))
            } catch (error) {
                await fs.promises.mkdir(path.join(currentDir, mkDir[i]))
            }
        }

        await fs.promises.writeFile(path.join(currentDir, "index.js"), await fs.promises.readFile(path.join(__dirname, "templates", "index.txt")))

        // Create example files
        await fs.promises.writeFile(
            path.join(currentDir, "routes", "example.js"),
            await fs.promises.readFile(path.join(__dirname, "templates", "example-route.js"))
        );

        await fs.promises.writeFile(
            path.join(currentDir, "validators", "ExamplePayload.js"),
            await fs.promises.readFile(path.join(__dirname, "templates", "example-validator.js"))
        );

        await fs.promises.writeFile(
            path.join(currentDir, "services", "example.js"),
            await fs.promises.readFile(path.join(__dirname, "templates", "example-service.js"))
        );

        await fs.promises.writeFile(
            path.join(currentDir, "workers", "example.js"),
            await fs.promises.readFile(path.join(__dirname, "templates", "example-worker.js"))
        );

        await fs.promises.writeFile(
            path.join(currentDir, "init", "post.js"),
            await fs.promises.readFile(path.join(__dirname, "templates", "post-init.js"))
        );

        // Create .env file
        await fs.promises.writeFile(path.join(currentDir, ".env"), `# Falcon.js Environment Configuration
# Generated by falcon-cli

# Server Configuration
HTTP_HOST=localhost
HTTP_PORT=3000

# Database Configuration  
MONGODB_URL=mongodb://localhost:27017/${app_name}_db

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
`);

        console.log(`
✅ Falcon.js project created successfully!

📁 Project structure:
   ├── index.js          # Main application entry point
   ├── settings.js       # Falcon configuration
   ├── .env             # Environment variables
   ├── package.json     # Dependencies
   ├── routes/          # API route handlers
   ├── models/          # Database models
   ├── services/        # Background services
   ├── workers/         # Job processors
   ├── validators/      # Joi validation schemas
   ├── init/           # Initialization scripts
   └── logs/           # Application logs

🚀 Next steps:
   1. cd ${app_name}
   2. npm install
   3. npm run dev

📚 Documentation will be available at: http://localhost:[PORT]/documentation
❤️  Health check at: http://localhost:[PORT]/health
`);


    }
}

try {
    start();
} catch (error) { }


async function writeJsonToCjsModule(dataObject, filePath) {
    try {
        // 1. Convert the JavaScript object into a formatted JSON string.
        // The arguments (null, 2) ensure the output is pretty-printed with 2 spaces.
        const jsonString = JSON.stringify(dataObject, null, 2);

        // 2. Wrap the string in the CommonJS export syntax.
        const cjsContent = `module.exports = ${jsonString};\n`;

        // 3. Write the content to the file.
        await fs.promises.writeFile(filePath, cjsContent, 'utf-8');

        console.log(`✅ Successfully created CommonJS module at: ${path.resolve(filePath)}`);
    } catch (error) {
        console.error(`❌ Error writing CJS module to ${filePath}:`, error.message);
    }
}

function isDirectoryEmpty(dirPath) {
    try {
        // 1. Get stats to check if the path is a directory
        const stats = fs.statSync(dirPath);

        if (!stats.isDirectory()) {
            // If the path exists but is not a directory (e.g., it's a file),
            // we can consider it "not empty" in the context of checking a directory.
            // Alternatively, you could throw an error if the path points to a file.
            console.log(`Path ${dirPath} exists but is not a directory.`);
            return false;
        }

        // 2. Read the contents of the directory
        const files = fs.readdirSync(dirPath);

        // 3. Check the length of the returned array
        return files.length === 0;

    } catch (error) {
        return false;
        // Handle specific error codes
        if (error.code === 'ENOENT') {
            // 'ENOENT' means 'Error NO ENTry', i.e., the file or directory does not exist.
            console.error(`Error: Directory not found at path: ${dirPath}`);
            // Based on context, you might want to return true here (since it has 0 contents)
            // but throwing an error is usually safer if you expect the directory to exist.
            throw new Error(`Directory not found: ${dirPath}`);
        } else if (error.code === 'EACCES') {
            console.error(`Error: Permission denied to access: ${dirPath}`);
            throw error;
        } else {
            // Handle other potential file system errors
            console.error(`An unexpected error occurred: ${error.message}`);
            throw error;
        }
    }
}

async function getProjectInfo() {

}


async function create_mongoose_model() {
    mongoose_schema_builder(path.join(currentDir, "models", "mongo")) // Correct path for falconjs
}
// await fs.writeFileSync(model_path, JSON.stringify(res,null,2));



async function precheck() {
    //check if package.json
    if (fs.existsSync(path.join(currentDir, "package.json"))) {

    } else {

    }
}

function runNpmInstall(directory, package) {
    // Use 'npm' for Windows and other OSs, or 'npm.cmd' on Windows if needed,
    // but usually 'npm' works if Node/npm is in the PATH.
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    if (package) {
        const child = spawn(npm, ['install', package], {
            // This is the directory where 'npm install' will run
            cwd: directory,
            // Pipe the output directly to the main process's stdout/stderr
            stdio: 'inherit'
        });

        child.on('error', (err) => {
            console.error(`Failed to start npm process: ${err}`);
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log('✅ npm install completed successfully.');
            } else {
                console.error(`❌ npm install failed with code ${code}`);
            }
        });
    } else {
        const child = spawn(npm, ['install'], {
            // This is the directory where 'npm install' will run
            cwd: directory,
            // Pipe the output directly to the main process's stdout/stderr
            stdio: 'inherit'
        });

        child.on('error', (err) => {
            console.error(`Failed to start npm process: ${err}`);
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log('✅ npm install completed successfully.');
            } else {
                console.error(`❌ npm install failed with code ${code}`);
            }
        });
    }


}