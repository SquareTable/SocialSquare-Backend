const MockMongoDBServer = require('../../libraries/MockDBServer');
const TempController = require('../../controllers/Temp');

const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const {expect, beforeEach, afterEach} = require('@jest/globals')

jest.setTimeout(20_000);

/*
TODO:
- Test if notification retrieval fails if userId is not a string -- Done
- Test if notification retrieval fails if userId is not an ObjectId
- Test if notification retrieval fails if lastNotificationId is not a string and not undefined
- Test if notification retrieval fails if user could not be found
- Test if notification retrieval works with lastNotificationId
- Test if notification retrieval works with lastNotificationId as undefined
*/

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest()
})

afterEach(async () => {
    await DB.stopTest()
})

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If retrieval fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.getnotifications(notString, undefined);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Provided type: ${typeof notString}`)
    })
}