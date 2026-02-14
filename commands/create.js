const { input, select, confirm } = require("@inquirer/prompts");
const fs = require("fs");
const path = require("path");
const { spawn } = require('child_process');

const ProjectGenerator = require('../lib/ProjectGenerator');
const { showLogo, showSuccess } = require('../lib/utils');

module.exports = {
    command: 'create [name]',
    describe: 'Create a new Falcon.js project',
    builder: (yargs) => {
        return yargs
            .positional('name', {
                describe: 'Project name',
                type: 'string'
            })
            .option('template', {
                alias: 't',
                describe: 'Project template',
                type: 'string',
                choices: ['basic', 'api', 'microservice'],
                default: 'basic'
            })
            .option('skip-install', {
                describe: 'Skip npm install',
                type: 'boolean',
                default: false
            })
            .option('yes', {
                alias: 'y',
                describe: 'Use default options',
                type: 'boolean',
                default: false
            });
    },
    handler: async (argv) => {
        try {
            showLogo();
            
            const generator = new ProjectGenerator({
                verbose: argv.verbose,
                skipInstall: argv.skipInstall,
                useDefaults: argv.yes
            });
            
            await generator.create(argv.name, argv.template);
            
        } catch (error) {
            console.error('❌ Failed to create project:', error.message);
            if (argv.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }
};
