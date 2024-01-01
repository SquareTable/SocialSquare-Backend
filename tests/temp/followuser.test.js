const User = require('../../libraries/User')
const MockMongoDBServer = require('../../libraries/MockDBServer')
const TempController = require('../../controllers/Temp')

const TEST_CONSTANTS = require('../TEST_CONSTANTS')

const {expect, beforeEach, afterEach, test} = require('@jest/globals');

jest.setTimeout(20_000)

const DB = new MockMongoDBServer();

beforeEach(async () => {
    DB.startTest();
})

afterEach(async () => {
    DB.stopTest();
})

const userGettingFollowedData = {
    _id: '6592d55957dea9ccea3afe20',
    secondId: '6e3147a2-0381-4bad-b89c-f5edfa767fc2'
}

const userFollowingData = {
    _id: '6592d56b1e5dac985aa2e919',
    secondId: '367f3a1e-7ae0-4885-b9b9-2471f90faf53'
}

/*
TODO:
- Test if follow fails if userId is not a string -- Done
- Test if follow fails if userId is not an ObjectId -- Done
- Test if follow fails if userPubId is not a string -- Done
- Test if follow fails if userPubId is not a valid UUID v4
- Test if follow fails if follower user cannot be found -- Done
- Test if follow fails if account to be followed cannot be found -- Done
- Test if follow fails if user following is blocked by the account to be followed
- Test that if the user being followed is private that a follow request is added (and follower isn't added)
- Test multiple follow requests from the same user cannot be added
- Test following a user works (and updates both User documents) if the account being followed is public (and no request is made)
- Test following a user multiple times does not make multiple follows
*/

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If follow fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.followuser(notString, userGettingFollowedData.secondId);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
    })

    test(`Of fopllow fails if userPubId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.followuser(userFollowingData._id, notString);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userPubId must be a string. Type provided: ${typeof notString}`);
    })
}

test('If follow fails if userId is not an ObjectId', async () => {
    expect.assertions(2);

    const returned = await TempController.followuser('i am not an objectid', userGettingFollowedData.secondId);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userId must be an ObjectId.')
})

test('If follow fails if userPubId is not a valid UUID v4', async () => {
    expect.assertions(2);

    const returned = await TempController.followuser(userFollowingData._id, 'i am not a UUID')

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userPubId must be a valid version 4 UUID')
})

test('If follow fails if account to be followed could not be found', async () => {
    expect.assertions(2);

    const returned = await TempController.followuser(userFollowingData._id, userGettingFollowedData.secondId);

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user with provided userId.')
})