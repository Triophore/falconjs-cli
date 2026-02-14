module.exports.validate = async function (request, username, password, CONTXET) {
    // TODO: Implement your own logic here
    // Example: Check against database or environment variables
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
        return { isValid: true, credentials: { id: 1, name: 'Admin', roles: ['admin'], permissions: { admin: ['*'] } } };
    }
    return { isValid: false };
}