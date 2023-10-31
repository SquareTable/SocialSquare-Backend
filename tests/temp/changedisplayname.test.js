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
TODO:
Test if change fails if userId is not a string -- Done
Test if change fails if userId is not an objectId
Test if change fails if desiredDisplayName is not a string
Test if change fails if desiredDisplayName is more than 20 characters
Test if change fails if user could not be found
Test if change successfully changes display name and only changes display name
Test if change does not interfere with already existing user documents
*/

const userData = {
    name: 'sebastian',
    displayName: 'Sebastian',
    _id: new mongoose.Types.ObjectId()
}

for (const notString of TEST_CONSTANTS) {
    test(`If change fails if userId is not a string. Testing: ${typeof notString}`, async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await TempController.changedisplayname(String(userData._id), notString);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`desiredDisplayName must be a string. Provided type: ${typeof notString}`);
    })
}