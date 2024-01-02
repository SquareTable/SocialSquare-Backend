const TempController = require('../../controllers/Temp');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const User = require('../../models/User');

const uuid = require('uuid')

const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const {beforeEach, afterEach, test, expect} = require('@jest/globals');

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.stopTest();
})

const userUnfollowingData = {
    _id: '659420149d67e23dd69f8865',
    secondId: '07bd0de1-5d0e-45d7-9121-7e45963fa46e'
}

const userGettingUnfollowedData = {
    _id: '6594201f37b2503c787edec3',
    secondId: '3a37d41b-8bf2-4ed5-be0b-e975b52a3f16'
}

/*
TODO:
- Test unfollow fails if userId is not a string -- Done
- Test unfollow fails if userId is not an ObjectId -- Done
- Test unfollow fails if userPubId is not a string -- Done
- Test unfollow fails if userPubId is not a valid UUID v4 -- Done
- Test unfollow fails if follower user cannot be found -- Done
- Test unfollow fails if account that is getting unfollowed cannot be found -- Done
- Test unfollow fails if the follower is blocked -- Done
- Test if follow request gets removed if the account is private (and not follow) -- Done
- Test if follow gets removed if the account is public (and following item gets removed from the account following)
- Test if non-related User accounts do not get modified during request removal
- Test if non-related User accounts do not get modified during follow removal
*/

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`Unfollow fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.unfollowuser(notString, userGettingUnfollowedData.secondId);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
    })

    test(`Unfollow fails if userPubId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.unfollowuser(userUnfollowingData._id, notString);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userPubId must be a string. Type provided: ${typeof notString}`)
    })
}

test('Unfollow fails if userId is not an ObjectId', async () => {
    expect.assertions(2);

    const returned = await TempController.unfollowuser('i am not an objectid', userGettingUnfollowedData.secondId);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userId must be an ObjectId.')
})

test('Unfollow fails if userPubId is not a valid v4 UUID', async () => {
    expect.assertions(2);

    const returned = await TempController.unfollowuser(userUnfollowingData._id, 'i am not a valid v4 uuid')

    expect(returned.statusCode).toBe(400)
    expect(returned.data.message).toBe('userPubId must be a valid version 4 UUID')
})

test('Unfollow fails if follower user cannot be found', async () => {
    expect.assertions(2);

    await new User(userGettingUnfollowedData).save();

    const returned = await TempController.unfollowuser(userUnfollowingData._id, userGettingUnfollowedData.secondId);

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user with provided userId.')
})

test('Unfollow fails if account getting unfollowed cannot be found', async () => {
    expect.assertions(2);

    await new User(userUnfollowingData).save();

    const returned = await TempController.unfollowuser(userUnfollowingData._id, userGettingUnfollowedData.secondId);

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user.')
})

test('Unfollow fails if follower is blocked', async () => {
    expect.assertions(2);

    const userGettingUnfollowed = {...userGettingUnfollowedData, blockedAccounts: [userUnfollowingData.secondId]}

    await new User(userUnfollowingData).save();
    await new User(userGettingUnfollowed).save();

    const returned = await TempController.unfollowuser(userUnfollowingData._id, userGettingUnfollowed.secondId);

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user.')
})

test('Unfollow removes follow request if account is private', async () => {
    expect.assertions(3);

    const randomUUID = uuid.v4()

    const userGettingUnfollowed = {
        ...userGettingUnfollowedData,
        privateAccount: true,
        followers: [...new Array(10)].map(() => uuid.v4()),
        accountFollowRequests: [userUnfollowingData.secondId, randomUUID]
    }

    await new User(userGettingUnfollowed).save();
    await new User(userUnfollowingData).save();

    const beforeUser = await User.findOne({_id: {$eq: userGettingUnfollowed._id}}).lean();

    const returned = await TempController.unfollowuser(userUnfollowingData._id, userGettingUnfollowed.secondId);

    const afterUser = await User.findOne({_id: {$eq: userGettingUnfollowed._id}}).lean();

    beforeUser.accountFollowRequests = [randomUUID];

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Removed Request To Follow User');
    expect(beforeUser).toStrictEqual(afterUser);
})