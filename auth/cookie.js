module.exports.validate = async function (request, session, CONTXET) {
    // TODO: Implement your own logic here
    // Example: Validate session against database or Redis
    /*
    if (session.valid) {
        return { isValid: true, credentials: { id: session.userId, ... } };
    }
    */
    return { isValid: false };
}