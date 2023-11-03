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

/*
TODO:
- Test that change fails if userId is not a string -- Done
- Test that change fails if userId is not an objectId -- Done
- Test that change fails if desiredUsername does not pass the valid username test
- Test that change fails if desiredUsername is more than 20 characters (CONSTANTS.MAX_USER_USERNAME_LENGTH)
- Test that change fails if desiredUsername is blank
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
}

test('if change fails if userId is not an objectId', async () => {
    expect.assertions(2);

    const returned = await TempController.changeusername('i am not an objectid', validUsername);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userId must be an objectId.');
})