/**
 * Example route handler
 * This file demonstrates the route structure expected by Falcon.js
 */

module.exports.route = async function (context) {
    return {
        method: 'POST',
        path: '/api/example',
        options: {
            tags: ['api'],
            description: 'Auto-generated POST route',
            notes: 'Returns example data',
            validate: {} // Add payload/query/params validation here
        },
        handler: async (request, h) => {
            return {
                success: true,
                message: 'Hello from Falcon.js!',
                timestamp: new Date().toISOString(),
                // data: request.payload // for POST/PUT
            };
        }
    };
};