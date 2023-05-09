const AdminLibrary = require('../libraries/Admin')
const adminLib = new AdminLibrary()

const HTTPWTLibrary = require('../libraries/HTTPWT')
const HTTPWTHandler = new HTTPWTLibrary()

class AdminController {
    static #login = (email, password) => {
        return new Promise(resolve => {
            email = email.trim();
            password = password.trim();

            if (email == "" || password == "") {
                resolve(HTTPWTHandler.badInput('Empty credentials supplied!'))
            }

            adminLib.login(email, password).then(data => {
                resolve(HTTPWTHandler.OK('Signin successful', {}, data))
            }).catch(error => {
                resolve(HTTPWTHandler.serverError(error))
            })
        })
    }

    static #getAssignedReports = (adminId) => {
        return new Promise(resolve => {
            adminLib.getAssignedReports(adminId).then(data => {
                resolve(HTTPWTHandler.OK('Found assigned reports', data))
            }).catch(error => {
                resolve(HTTPWTHandler.serverError(error))
            })
        })
    }

    static #dismissPostReport = (adminId, reportId) => {
        return new Promise(resolve => {
            adminLib.dismissPostReport(adminId, reportId).then(() => {
                resolve(HTTPWTHandler.OK('Successfully deleted post report'))
            }).catch(error => {
                resolve(HTTPWTHandler.serverError(error))
            })
        })
    }

    static #deletePostAndReport = (adminId, reportId) => {
        return new Promise(resolve => {
            adminLib.deletePostAndReport(adminId, reportId).then(() => {
                resolve(HTTPWTHandler.OK('Successfully deleted post and report'))
            }).catch(error => {
                console.error('Error deleting post and report:', error)
                resolve(HTTPWTHandler.serverError(error))
            })
        })
    }



    static login = async (email, password) => {
        return await this.#login(email, password)
    }

    static getAssignedReports = async (adminId) => {
        return await this.#getAssignedReports(adminId)
    }

    static dismissPostReport = async (adminId, reportId) => {
        return await this.#dismissPostReport(adminId, reportId)
    }

    static deletePostAndReport = async (adminId, reportId) => {
        return await this.#deletePostAndReport(adminId, reportId)
    }
}

module.exports = AdminController;