const { FalconBaseService } = require('falconjs');

/**
 * Example service - rename and customize as needed
 */
class ExampleService extends FalconBaseService {
    
    constructor() {
        super('example'); // Service ID for MQTT topics
    }

    /**
     * Handle incoming MQTT messages
     */
    async onMessage(topic, msg) {
        try {
            const message = JSON.parse(msg.toString());
            
            switch (topic) {
                case 'service_example':
                    await this.handleRequest(message);
                    break;
                default:
                    console.log(`Unhandled topic: ${topic}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    }

    /**
     * Handle service requests
     */
    async handleRequest(request) {
        console.log('Processing request:', request);
        
        // Your service logic here
        
        // Send response back via MQTT
        this.publish({
            status: 'completed',
            result: 'success',
            timestamp: new Date().toISOString()
        }, 'service_example_response');
    }

    /**
     * Service main logic
     */
    async run() {
        console.log('Example service is running...');
        
        // Your initialization logic here
    }
}

// Start the service if this file is run directly
if (require.main === module) {
    const service = new ExampleService();
    service.init().catch(console.error);
}

module.exports = ExampleService;
