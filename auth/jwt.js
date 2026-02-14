module.exports.validate = async function (decoded, CONTXET) {
    // TODO: Implement your own logic here
    // Example: Check against database or environment variables
    // For example, check if a specific environment variable matches a decoded value
    if (decoded.role === process.env.EXPECTED_ADMIN_ROLE && decoded.secret === process.env.EXPECTED_ADMIN_SECRET) {
        return { isValid: true, credentials: { id: decoded.sub, name: 'Admin', roles: ['admin'] } };
    }
    return { isValid: false };
}