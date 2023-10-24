const { MongoMemoryReplSet } = require('mongodb-memory-server');

class MockMongoDBServer {
    #replicaSetServer = null;

    startServer() {
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

    stopServer() {
        return new Promise(async (resolve, reject) => {
            try {
                await this.#replicaSetServer.stop();
                resolve()
            } catch (error) {
                reject(error)
            }
        })
    }
}

module.exports = MockMongoDBServer;