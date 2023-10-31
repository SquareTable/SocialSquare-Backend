const MockMongoDBServer = require('../../libraries/MockDBServer');
const User = require('../../models/User');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const TempController = require('../../controllers/Temp');
const mongoose = require('mongoose');

const DB = new MockMongoDBServer();

const {expect, beforeEach, afterEach} = require('@jest/globals');

jest.setTimeout(20_000) //20s per test

beforeEach(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.stopTest();
})

/*
Tests:
Test if change fails if userId is not a string
Test if change fails if userId is not an objectId
Test if change fails if desiredDisplayName is not a string
Test if change fails if desiredDisplayName is more than 20 characters
Test if change fails if user could not be found
Test if change successfully changes display name and only changes display name
Test if change does not interfere with already existing user documents
Test if change fails if desiredDisplayName is multi-line
Test if change fails if desiredDisplayName has non-alphabetic characters
*/

const userData = {
    name: 'sebastian',
    displayName: 'Sebastian',
    _id: new mongoose.Types.ObjectId()
}

for (const notString of TEST_CONSTANTS) {
    test(`If change fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await TempController.changedisplayname(notString, 'newname');

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Provided type: ${typeof notString}`);
    })

    test(`If change fails if desiredDisplayName is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await TempController.changedisplayname(String(userData._id), notString)

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`desiredDisplayName must be a string. Provided type: ${typeof notString}`)
    })
}

test('If change fails if userId is not an objectId', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const returned = await TempController.changedisplayname('i am not an objectid', 'newname');

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userId must be an objectId.')
})

test('If change fails if desiredDisplayName is longer than 20 characters', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const returned = await TempController.changedisplayname(String(userData._id), "this is 21 characters");

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Desired display name must be 20 characters or less.')
})

test('If change fails if user could not be found', async () => {
    expect.assertions(2);

    const returned = await TempController.changedisplayname(String(new mongoose.Types.ObjectId()), 'helloworld');

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user with provided userId.')
})

test('If change successfully changes display name and only display name', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const beforeUser = await User.findOne({}).lean();

    const returned = await TempController.changedisplayname(String(userData._id), 'newdisplayname');

    const afterUser = await User.findOne({}).lean();

    const beforeDisplayName = beforeUser.displayName;
    const afterDisplayName = afterUser.displayName;

    delete beforeUser.displayName;
    delete afterUser.displayName;

    expect(returned.statusCode).toBe(200);
    expect(beforeUser).toStrictEqual(afterUser);
    expect(beforeDisplayName !== afterDisplayName).toBe(true);
})

test('If change does not modify already existing User documents', async () => {
    expect.assertions(2);

    const usersToInsert = [...new Array(10)].map((item, index) => {
        return {
            name: 'sebastian' + index,
            displayName: 'Sebastian' + index
        }
    })

    await User.insertMany(usersToInsert);
    
    const beforeUsers = await User.find({}).lean();

    await new User(userData).save();

    const returned = await TempController.changedisplayname(String(userData._id), 'newdisplayname');

    const afterUsers = await User.find({_id: {$ne: userData._id}}).lean();

    expect(returned.statusCode).toBe(200);
    expect(beforeUsers).toStrictEqual(afterUsers);
})

test('If change fails if desiredDisplayName is multi-line', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const returned = await TempController.changedisplayname(String(userData._id), `new\ndisplay\nname`);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Display name must only containb characters in the alphabet and must be a single line.")
})

test('If change fails if desiredDisplayName contains non-alphabetic characters', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const returned = await TempController.changedisplayname(String(userData._id), '*&^%$#%^&*()')

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Display name must only containb characters in the alphabet and must be a single line.")
})