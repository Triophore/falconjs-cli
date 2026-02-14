const Joi = require('joi');

/**
 * Example Joi validator for API endpoints
 * This validator can be automatically matched with routes by name
 */
module.exports = Joi.object({
    name: Joi.string().min(2).max(50).required().description('User name'),
    email: Joi.string().email().required().description('User email address'),
    age: Joi.number().integer().min(18).max(120).optional().description('User age'),
    preferences: Joi.object({
        newsletter: Joi.boolean().default(false),
        notifications: Joi.boolean().default(true)
    }).optional().description('User preferences')
}).description('Example payload validation schema');
