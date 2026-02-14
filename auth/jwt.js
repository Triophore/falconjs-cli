module.exports.validate = async function (decoded, CONTXET) {
    if (username === 'admin' && password === 'secret') {
        return { isValid: true, credentials: { id: 1, name: 'Admin', roles: ['admin'], permissions: { admin: ['*'] } } };
    }
    return { isValid: false };
}