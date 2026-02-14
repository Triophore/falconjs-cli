const ModelGenerator = require('../lib/ModelGenerator');
const RouteGenerator = require('../lib/RouteGenerator');
const ServiceGenerator = require('../lib/ServiceGenerator');

module.exports = {
    command: 'generate <type> [name]',
    aliases: ['g'],
    describe: 'Generate project components',
    builder: (yargs) => {
        return yargs
            .positional('type', {
                describe: 'Type of component to generate',
                type: 'string',
                choices: ['model', 'route', 'service', 'worker', 'validator']
            })
            .positional('name', {
                describe: 'Component name',
                type: 'string'
            })
            .option('fields', {
                alias: 'f',
                describe: 'Model fields (for model generation)',
                type: 'array'
            })
            .option('crud', {
                describe: 'Generate CRUD routes (for model generation)',
                type: 'boolean',
                default: false
            });
    },
    handler: async (argv) => {
        try {
            const { type, name } = argv;
            
            switch (type) {
                case 'model':
                    const modelGen = new ModelGenerator({ verbose: argv.verbose });
                    await modelGen.generate(name, { fields: argv.fields, crud: argv.crud });
                    break;
                    
                case 'route':
                    const routeGen = new RouteGenerator({ verbose: argv.verbose });
                    await routeGen.generate(name);
                    break;
                    
                case 'service':
                    const serviceGen = new ServiceGenerator({ verbose: argv.verbose });
                    await serviceGen.generate(name);
                    break;
                    
                case 'worker':
                    const workerGen = new ServiceGenerator({ verbose: argv.verbose, type: 'worker' });
                    await workerGen.generate(name);
                    break;
                    
                case 'validator':
                    const validatorGen = new RouteGenerator({ verbose: argv.verbose, type: 'validator' });
                    await validatorGen.generate(name);
                    break;
                    
                default:
                    console.error(`❌ Unknown generator type: ${type}`);
                    process.exit(1);
            }
            
        } catch (error) {
            console.error(`❌ Failed to generate ${argv.type}:`, error.message);
            if (argv.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }
};
