const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const User = require('../../models/User');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const UserController = require('../../controllers/User')

test('user/checkusernameavailability says available when username is available', () => {
    const DB = new MockMongoDBServer()
    DB.startServer().then(async uri => {
        await mongoose.connect(uri);

        UserController.checkusernameavailability('seb').then(data => {
            DB.stopServer().then(() => {
                expect(data.message).toBe('Username is available')
            })
        })
    })
})