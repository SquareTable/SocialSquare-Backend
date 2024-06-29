const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose')
const models = require('../models/index')

class MockMongoDBServer {
    #replicaSetServer = null;
    #snapshot = null;

    async startTest() {
        await this.#startServer();
        await mongoose.connect(this.uri)
    }

    async stopTest() {
        await mongoose.disconnect();
        this.#snapshot = null;
        if (this.#replicaSetServer) await this.#stopServer();
    }

    async takeDBSnapshot() {
      this.#snapshot = await this.#createSnapshot()
    }

    async noChangesMade() {
      return JSON.stringify(this.#snapshot) === JSON.stringify(await this.#createSnapshot())
    }

    async changedCollections() {
      const currentSnapshot = await this.#createSnapshot();
      const changedCollections = [];

      for (const [index, modelName] of Object.keys(models).entries()) {
        if (JSON.stringify(this.#snapshot[index]) !== JSON.stringify(currentSnapshot[index])) {
          changedCollections.push(modelName)
        }
      }

      return changedCollections;
    }

    purgeData() {
      return Promise.all(Object.values(models).map(model => model.deleteMany({})))
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

    async #createSnapshot() {
      return await Promise.all(Object.values(models).map(model => model.find({}).lean()))
    }
}

module.exports = MockMongoDBServer;