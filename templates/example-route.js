/**
 * Example route handler
 * This file demonstrates the route structure expected by Falcon.js
 */

module.exports.route = async function (server, context) {
    
    // Example GET route
    server.route({
        method: 'GET',
        path: '/api/example',
        options: {
            tags: ['api', 'example'],
            description: 'Example GET endpoint',
            notes: 'Returns example data'
        },
        handler: async (request, h) => {
            return {
                success: true,
                message: 'Hello from Falcon.js!',
                timestamp: new Date().toISOString()
            };
        }
    });

    // Example POST route with validation
    server.route({
        method: 'POST',
        path: '/api/example',
        options: {
            tags: ['api', 'example'],
            description: 'Example POST endpoint',
            validate: {
                payload: context.validators?.ExamplePayload || undefined
            }
        },
        handler: async (request, h) => {
            const { name, email } = request.payload;
            
            // Example: Save to database if models are available
            if (context.models.example) {
                const result = await context.models.example.create({
                    name,
                    email,
                    createdAt: new Date()
                });
                
                return {
                    success: true,
                    data: result,
                    message: 'Data saved successfully'
                };
            }
            
            return {
                success: true,
                message: 'Data received',
                data: { name, email }
            };
        }
    });

    // Example route that sends job to worker
    server.route({
        method: 'POST',
        path: '/api/example/job',
        options: {
            tags: ['api', 'jobs'],
            description: 'Queue a job for processing'
        },
        handler: async (request, h) => {
            const jobData = request.payload;
            
            // Send job to worker via MQTT (if available)
            if (context.mqtt_client) {
                context.mqtt_client.publish('worker_example_job', JSON.stringify({
                    jobId: Date.now().toString(),
                    data: jobData,
                    timestamp: new Date().toISOString()
                }));
                
                return {
                    success: true,
                    message: 'Job queued for processing'
                };
            }
            
            return {
                success: false,
                message: 'Job queue not available'
            };
        }
    });
};
