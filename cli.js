#!/usr/bin/env node

/**
 * Falcon CLI - Command Line Interface for Falcon.js Framework
 * 
 * Standard CLI structure with proper command handling
 */

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const path = require('path');

// Import command modules
const createCommand = require('./commands/create');
const generateCommand = require('./commands/generate');
const { version } = require('./package.json');

// Setup graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    if (error.name === 'ExitPromptError') {
        console.log('\n👋 Operation cancelled');
        process.exit(0);
    } else {
        console.error('❌ Unexpected error:', error.message);
        process.exit(1);
    }
});

// CLI Configuration
const cli = yargs(hideBin(process.argv))
    .scriptName('falcon-cli')
    .version(version)
    .usage('Usage: $0 <command> [options]')
    .help('h')
    .alias('h', 'help')
    .alias('v', 'version')
    .demandCommand(1, 'You need at least one command before moving on')
    .strict()
    .recommendCommands()
    .wrap(Math.min(120, process.stdout.columns || 80));

// Register commands
cli.command(createCommand);
cli.command(generateCommand);

// Global options
cli.option('verbose', {
    alias: 'V',
    type: 'boolean',
    description: 'Run with verbose logging',
    global: true
});

// Parse and execute
cli.parse();
