/**
 * Post-initialization script
 * This runs after all Falcon components are initialized
 */

module.exports.run = async function(context) {
    const { logger, mqtt_client, models, server } = context;
    
    logger.info("Running post-initialization script...");
    
    // Example: Set up MQTT subscriptions for the main server
    if (mqtt_client) {
        // Subscribe to service responses
        mqtt_client.subscribe("service_*_response", (err) => {
            if (err) {
                logger.error("Failed to subscribe to service responses:", err);
            } else {
                logger.info("Subscribed to service response topics");
            }
        });
        
        // Subscribe to worker completions
        mqtt_client.subscribe("worker_*_complete", (err) => {
            if (err) {
                logger.error("Failed to subscribe to worker completions:", err);
            } else {
                logger.info("Subscribed to worker completion topics");
            }
        });
        
        // Handle incoming messages
        mqtt_client.on("message", async function (topic, msg) {
            try {
                const message = JSON.parse(msg.toString());
                logger.info(`Received message on ${topic}:`, message);
                
                // Handle different message types
                if (topic.includes('_response')) {
                    // Handle service responses
                    logger.info("Service response received:", message);
                } else if (topic.includes('_complete')) {
                    // Handle worker completions
                    logger.info("Worker job completed:", message);
                }
            } catch (error) {
                logger.error("Error processing MQTT message:", error);
            }
        });
    }
    
    // Example: Add custom routes dynamically
    if (server) {
        server.route({
            method: 'GET',
            path: '/api/status',
            options: {
                tags: ['system'],
                description: 'System status endpoint'
            },
            handler: async (request, h) => {
                return {
                    status: 'running',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    version: require('../package.json').version
                };
            }
        });
    }
    
    // Example: Initialize background tasks
    setInterval(() => {
        logger.debug("Heartbeat - System is running");
    }, 60000); // Every minute
    
    logger.info("Post-initialization completed successfully");
};
