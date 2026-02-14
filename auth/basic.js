module.exports.validate = async function (request, username, password, CONTXET) {
    if (username === 'admin' && password === 'secret') {
        return { isValid: true, credentials: { id: 1, name: 'Admin', roles: ['admin'], permissions: { admin: ['*'] } } };
    }
    return { isValid: false };
}