const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose')

class MockMongoDBServer {
    #replicaSetServer = null;

    async startTest() {
        await this.#startServer();
        await mongoose.connect(this.uri)
    }

    async stopTest() {
        await mongoose.disconnect();
        if (this.#replicaSetServer) await this.#stopServer();
    }

    #startServer() {
        return new Promise(async (resolve, reject) => {
            try {
                const replSet = await MongoMemoryReplSet.create({ replSet: { count: 3 } });

                this.#replicaSetServer = replSet;
                this.uri = replSet.getUri();

                resolve(this.uri)
            } catch (error) {
                reject(error)
            }
        })
    }

    #stopServer() {
        return new Promise(async (resolve, reject) => {
            try {
                await this.#replicaSetServer.stop();
                this.#replicaSetServer = null;
                resolve()
            } catch (error) {
                reject(error)
            }
        })
    }
}

module.exports = MockMongoDBServer;