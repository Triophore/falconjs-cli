const { FalconBaseWorker } = require('@triophore/falconjs');

/**
 * Example worker - rename and customize as needed
 */
class ExampleWorker extends FalconBaseWorker {
    
    constructor() {
        super('example'); // Worker ID for MQTT topics
    }

    /**
     * Handle incoming MQTT messages
     */
    async onMessage(topic, msg) {
        try {
            const message = JSON.parse(msg.toString());
            
            switch (topic) {
                case 'worker_example_job':
                    await this.processJob(message);
                    break;
                default:
                    console.log(`Unhandled topic: ${topic}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    }

    /**
     * Process a job
     */
    async processJob(job) {
        const { jobId, data } = job;
        
        console.log(`Processing job ${jobId}:`, data);
        
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update job status in database if available
        if (this.models.job) {
            await this.models.job.findByIdAndUpdate(jobId, {
                status: 'completed',
                completedAt: new Date(),
                result: { processed: true }
            });
        }
        
        // Send completion notification
        await this.publish('worker_example_complete', {
            jobId: jobId,
            status: 'completed',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Worker main logic
     */
    async run() {
        const args = this.parseArgs();
        console.log('Example worker started with args:', args);
        
        // If specific job passed as argument, process it immediately
        if (args.jobId) {
            await this.processJob(args);
            process.exit(0); // Exit after processing single job
        }
        
        // Otherwise, keep running and wait for MQTT jobs
        console.log('Waiting for jobs...');
    }
}

// Start the worker if this file is run directly
if (require.main === module) {
    const worker = new ExampleWorker();
    worker.init().catch(console.error);
}

module.exports = ExampleWorker;
