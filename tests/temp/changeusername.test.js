const mongoose = require('mongoose');
const {v4: uuidv4} = require('uuid');

const User = require('../../models/User');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const TempController = require('../../controllers/Temp');

const {expect, beforeEach, afterEach, test} = require('@jest/globals');

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.stopTest();
})

const validUsername = 'sebastian';

const invalidUsernames = ["$", "$%^&*(", "seb_1", "hello!", `hi\n`, "~~~", 'seb.seb']

const userData = {
    _id: new mongoose.Types.ObjectId(),
    secondId: uuidv4(),
    name: 'myname',
    displayName: 'Sebastian'
}

/*
Tests:
- Test that change fails if userId is not a string
- Test that change fails if userId is not an objectId
- Test that change fails if desiredUsername is not a string
- Test that change fails if desiredUsername is 
- Test that change fails if desiredUsername does not pass the valid username test
- Test that change fails if desiredUsername is more than 20 characters (CONSTANTS.MAX_USER_USERNAME_LENGTH)
- Test that change fails if user with userId could not be found
- Test that change fails if user with current desiredUsername could be found
- Test that change is successful with correct inputs
- Test that successful change does not interfere with already existing User documents in the database
*/

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If change fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.changeusername(notString, validUsername);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Provided type: ${typeof notString}`)
    })

    test(`If change fails if desiredUsername is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.changeusername(String(userData._id), notString);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`desiredUsername must be a string. Provided type: ${typeof notString}`)
    })
}

test('if change fails if userId is not an objectId', async () => {
    expect.assertions(2);

    const returned = await TempController.changeusername('i am not an objectid', validUsername);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userId must be an objectId.');
})

test('If change fails if desiredUsername is blank', async () => {
    expect.assertions(2);

    const returned = await TempController.changeusername(String(userData._id), '');

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Desired username cannot be blank.')
})

for (const invalidUsername of invalidUsernames) {
    test(`If change fails if desiredUsername does not pass the valid username test. Testing: ${invalidUsername}`, async () => {
        expect.assertions(2);

        const returned = await TempController.changeusername(String(userData._id), invalidUsername);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe('Invalid username entered (username can only have numbers and lowercase a - z characters)')
    })
}

test('If change fails if desiredUsername is more than 20 characters', async () => {
    expect.assertions(2);

    const returned = await TempController.changeusername(String(userData._id), 'thisis21characterssss');

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Your new username cannot be more than 20 characters.')
})

test('If change fails if user with userId could not be found', async () => {
    expect.assertions(2);

    const returned = await TempController.changeusername(String(userData._id), 'newname');

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user with provided userId.')
})

test('If change fails when user with desiredUsername already exists', async () => {
    expect.assertions(2);

    await new User(userData).save();
    await new User({
        name: 'newname'
    }).save();

    const returned = await TempController.changeusername(String(userData._id), 'newname');

    expect(returned.statusCode).toBe(409);
    expect(returned.data.message).toBe('User with the provided username already exists')
})

test('If change is successful with correct inputs', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const returned = await TempController.changeusername(String(userData._id), 'newname');

    const afterUser = await User.findOne({}).lean();

    expect(returned.statusCode).toBe(200);
    expect(afterUser.name).toBe('newname');
})

test('that successful change of username does not interfere with other User documents', async () => {
    expect.assertions(2);

    const users = [...new Array(10)].map((item, index) => {
        return {
            _id: new mongoose.Types.ObjectId(),
            secondId: uuidv4(),
            name: 'name' + index
        }
    })

    await User.insertMany(users);
    
    const beforeUsers = await User.find({}).lean();

    await new User(userData).save();

    const returned = await TempController.changeusername(String(userData._id), 'newname');

    const afterUsers = await User.find({_id: {$ne: userData._id}}).lean();

    expect(returned.statusCode).toBe(200);
    expect(beforeUsers).toStrictEqual(afterUsers);
})