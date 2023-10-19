class MongooseSession {
    endSession(session) {
        return new Promise(resolve => {
            session.endSession().catch(error => {
                console.error('An error occurred while ending Mongoose session:', error)
            }).finally(() => {
                resolve()
            })
        })
    }

    abortTransaction(session) {
        return new Promise(resolve => {
            session.abortTransaction().catch(error => {
                console.error('An error occurred while aborting Mongoose transaction:', error)
            }).finally(() => {
                this.endSession(session).then(() => {
                    resolve()
                })
            })
        })
    }

    commitTransaction(session) {
        return new Promise((resolve, reject) => {
            session.commitTransaction().then(() => {
                this.endSession(session).then(() => {
                    resolve()
                })
            }).catch(error => {
                console.error('An error occurred while committing Mongoose transaction:', error)
                this.abortTransaction(session).then(() => {
                    reject()
                })
            })
        })
    }
}

module.exports = MongooseSession;