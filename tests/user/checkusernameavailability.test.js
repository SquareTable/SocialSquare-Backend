const mongoose = require('mongoose');
const User = require('../../models/User');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const UserController = require('../../controllers/User')
const CONSTANTS = require('../../constants.js');
const TEST_CONSTANTS = require('../TEST_CONSTANTS.js');

const {test, beforeEach, afterEach} = require('@jest/globals');

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.stopTest();
})

jest.setTimeout(20_000); // 20s

const failingUsernames = [
    'ab!',
    'a  ',
    '$%',
    'ABC',
    'ABC123',
    ' ',
    '%^&#*('
]

test('user/checkusernameavailability says available when username is available', async () => {
    expect.assertions(2);

    const returned = await UserController.checkusernameavailability('seb')

    expect(returned.data.message).toBe('Username is available')
    expect(returned.statusCode).toBe(200)
})


test('user/checkusernameavailability says not available when username is not available', async () => {
    expect.assertions(2);

    const newUser = new User({name: 'seb'});
    await newUser.save();

    const returned = await UserController.checkusernameavailability('seb')

    expect(returned.data.message).toBe('Username is not available')
    expect(returned.statusCode).toBe(200)
})

test('user/checkusernameavailability says not available when lowercase username is queried and uppercase username is in db', async () => {
    expect.assertions(2);
    const newUser = new User({name: 'SEB'});
    await newUser.save();

    const returned = await UserController.checkusernameavailability('seb')

    expect(returned.data.message).toBe('Username is not available')
    expect(returned.statusCode).toBe(200)
})

test('user/checkusernameavailability says not available when uppercase username is queried and uppercase username is in db', async () => {
    expect.assertions(2);

    const newUser = new User({name: 'seb'});
    await newUser.save();

    const returned = await UserController.checkusernameavailability('SEB')

    expect(returned.data.message).toBe(CONSTANTS.VALID_USERNAME_TEST_READABLE_REQUIREMENTS)
    expect(returned.statusCode).toBe(400)
})

test('username is invalid if it is multicase', async () => {   
    expect.assertions(2);

    const newUser = new User({name: 'sEbasTiaN'});
    await newUser.save();

    const returned = await UserController.checkusernameavailability('sebasTiAN')

    expect(returned.data.message).toBe(CONSTANTS.VALID_USERNAME_TEST_READABLE_REQUIREMENTS)
    expect(returned.statusCode).toBe(400)
})

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`user/checknameavailability says username must be string when username is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await UserController.checkusernameavailability(notString);

        expect(returned.data.message).toBe(`username must be a string. Provided type: ${typeof notString}`);
        expect(returned.statusCode).toBe(400);
    })
}

test('user/checknameavailability says username cannot be blank when it is blank', async () => {
    expect.assertions(2);

    const returned = await UserController.checkusernameavailability('');

    expect(returned.data.message).toBe('Username cannot be blank');
    expect(returned.statusCode).toBe(400);
})

test(`user/checknameavailability fails when username is over ${CONSTANTS.MAX_USER_USERNAME_LENGTH} characters long`, async () => {
    expect.assertions(2);

    const returned = await UserController.checkusernameavailability(new Array(CONSTANTS.MAX_USER_USERNAME_LENGTH + 2).join('a'))

    expect(returned.data.message).toBe(`Username must be ${CONSTANTS.MAX_USER_USERNAME_LENGTH} or less characters`)
    expect(returned.statusCode).toBe(400)
})

for (const invalidUsername of failingUsernames) {
    test(`If ${invalidUsername} is an invalid username`, async () => {
        expect.assertions(2);

        const returned = await UserController.checkusernameavailability(invalidUsername);

        expect(returned.data.message).toBe(CONSTANTS.VALID_USERNAME_TEST_READABLE_REQUIREMENTS)
        expect(returned.statusCode).toBe(400)
    })
}