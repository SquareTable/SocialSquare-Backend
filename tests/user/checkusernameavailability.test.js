const mongoose = require('mongoose');
const User = require('../../models/User');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const UserController = require('../../controllers/User')

jest.setTimeout(100000); // 100s

test('user/checkusernameavailability says available when username is available', async () => {
    const DB = new MockMongoDBServer()
    const uri = await DB.startServer();

    await mongoose.connect(uri);

    const returned = await UserController.checkusernameavailability('seb')

    await mongoose.disconnect();
    await DB.stopServer();

    expect(returned.data.message).toBe('Username is available')
})


test('user/checkusernameavailability says not available when username is not available', async () => {
    const DB = new MockMongoDBServer()
    const uri = await DB.startServer();

    await mongoose.connect(uri);
    
    const newUser = new User({name: 'seb'});
    await newUser.save();

    const returned = await UserController.checkusernameavailability('seb')

    await mongoose.disconnect();
    await DB.stopServer();

    expect(returned.data.message).toBe('Username is not available')
})

test('user/checkusernameavailability says not available when uppercased username is not available', async () => {
    const DB = new MockMongoDBServer()
    const uri = await DB.startServer();

    await mongoose.connect(uri);
    
    const newUser = new User({name: 'SEB'});
    await newUser.save();

    const returned = await UserController.checkusernameavailability('seb')

    await mongoose.disconnect();
    await DB.stopServer();

    expect(returned.data.message).toBe('Username is not available')
})