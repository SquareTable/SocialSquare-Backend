const mongoose = require('mongoose');
const User = require('../../models/User');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const UserController = require('../../controllers/User')

const {test, beforeEach, afterEach} = require('@jest/globals');

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.stopTest();
})

jest.setTimeout(20_000); // 20s

test('user/checkusernameavailability says available when username is available', async () => {
    const returned = await UserController.checkusernameavailability('seb')

    expect(returned.data.message).toBe('Username is available')
    expect(returned.statusCode).toBe(200)
})


test('user/checkusernameavailability says not available when username is not available', async () => {
    const newUser = new User({name: 'seb'});
    await newUser.save();

    const returned = await UserController.checkusernameavailability('seb')

    expect(returned.data.message).toBe('Username is not available')
    expect(returned.statusCode).toBe(200)
})

test('user/checkusernameavailability says not available when lowercase username is queried and uppercase username is in db', async () => {
    const newUser = new User({name: 'SEB'});
    await newUser.save();

    const returned = await UserController.checkusernameavailability('seb')

    expect(returned.data.message).toBe('Username is not available')
    expect(returned.statusCode).toBe(200)
})

test('user/checkusernameavailability says not available when uppercase username is queried and uppercase username is in db', async () => {
    const newUser = new User({name: 'seb'});
    await newUser.save();

    const returned = await UserController.checkusernameavailability('SEB')

    expect(returned.data.message).toBe('Username is not available')
    expect(returned.statusCode).toBe(200)
})

test('user/checkusernameavailability says not available when query and db name are multicase', async () => {    
    const newUser = new User({name: 'sEbasTiaN'});
    await newUser.save();

    const returned = await UserController.checkusernameavailability('sebasTiAN')

    expect(returned.data.message).toBe('Username is not available')
    expect(returned.statusCode).toBe(200)
})