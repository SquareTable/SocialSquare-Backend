const User = require('../../models/User')
const MockMongoDBServer = require('../../libraries/MockDBServer')
const TempController = require('../../controllers/Temp')

const TEST_CONSTANTS = require('../TEST_CONSTANTS')

const {expect, beforeEach, afterEach, test} = require('@jest/globals');

jest.setTimeout(20_000)

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.stopTest();
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
Tests:
- Test if follow fails if userId is not a string
- Test if follow fails if userId is not an ObjectId
- Test if follow fails if userPubId is not a string
- Test if follow fails if userPubId is not a valid UUID v4
- Test if follow fails if follower user cannot be found
- Test if follow fails if account to be followed cannot be found
- Test if follow fails if user following the account cannot be found
- Test if follow fails if user following is blocked by the account to be followed
- Test that if the user being followed is private that a follow request is added (and follower isn't added)
- Test multiple follow requests from the same user cannot be added
- Test following a user works (and updates both User documents) if the account being followed is public (and no request is made)
- Test following a user multiple times does not make multiple follows
- Test non-related User documents do not get modified when following a public account
- Test non-related User documents do not get modified when following a private account
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

test('If follow fails if user following the account cannot be found', async () => {
    expect.assertions(2);

    await new User(userGettingFollowedData).save();

    const returned = await TempController.followuser(userFollowingData._id, userGettingFollowedData.secondId);

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user with provided userId.')
})

test('If follow fails if account to be followed could not be found', async () => {
    expect.assertions(2);

    await new User(userFollowingData).save();

    const returned = await TempController.followuser(userFollowingData._id, userGettingFollowedData.secondId);

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user.')
})

test('If follow fails if user following is blocked by the account to be followed', async () => {
    expect.assertions(8);

    const userGettingFollowed = {...userGettingFollowedData, blockedAccounts: [userFollowingData.secondId]}

    await new User(userFollowingData).save();
    await new User(userGettingFollowed).save();

    const returned = await TempController.followuser(userFollowingData._id, userGettingFollowed.secondId);

    const followedUserAfter = await User.findOne({_id: userGettingFollowed._id}).lean();
    const followingUserAfter = await User.findOne({_id: userFollowingData._id}).lean();

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user.')
    expect(followedUserAfter.followers).toHaveLength(0)
    expect(followingUserAfter.followers).toHaveLength(0)
    expect(followedUserAfter.accountFollowRequests).toBe(undefined)
    expect(followingUserAfter.accountFollowRequests).toBe(undefined)
    expect(followedUserAfter.following).toHaveLength(0)
    expect(followingUserAfter.following).toHaveLength(0)
})

test('If a private account gets followed, a follow request gets created (and not a follow)', async () => {
    expect.assertions(8);

    const userGettingFollowed = {...userGettingFollowedData, privateAccount: true};

    await new User(userFollowingData).save();
    await new User(userGettingFollowed).save();

    const returned = await TempController.followuser(userFollowingData._id, userGettingFollowed.secondId);

    const followedUserAfter = await User.findOne({_id: userGettingFollowed._id}).lean();
    const followingUserAfter = await User.findOne({_id: userFollowingData._id}).lean();

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Requested To Follow User')
    expect(followedUserAfter.followers).toHaveLength(0)
    expect(followingUserAfter.followers).toHaveLength(0)
    expect(followedUserAfter.accountFollowRequests).toBe([userFollowingData.secondId])
    expect(followingUserAfter.accountFollowRequests).toBe(undefined)
    expect(followedUserAfter.following).toHaveLength(0)
    expect(followingUserAfter.following).toHaveLength(0)
})

test('that multiple account follow requests cannot be made from the same user', async () => {
    expect.assertions(3);

    const userGettingFollowed = {...userGettingFollowedData, privateAccount: true};

    await new User(userFollowingData).save();
    await new User(userGettingFollowed).save();

    for (let i = 0; i < 10; i++) {
        await TempController.followuser(userFollowingData._id, userGettingFollowed.secondId);
    }

    const returned = await TempController.followuser(userFollowingData._id, userGettingFollowed.secondId)

    const followedUserAfter = await User.findOne({_id: userGettingFollowedData._id}).lean();

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Requested To Follow User')
    expect(followedUserAfter.accountFollowRequests).toBe([userFollowingData.secondId])
})

test('If a following a user works and updates both User documents and no account follow requests are made', async () => {
    expect.assertions(8);

    await new User(userFollowingData).save();
    await new User(userGettingFollowedData).save();

    const returned = await TempController.followuser(userFollowingData._id, userGettingFollowed.secondId);

    const followedUserAfter = await User.findOne({_id: userGettingFollowedData._id}).lean();
    const followingUserAfter = await User.findOne({_id: userFollowingData._id}).lean();

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Followed User');
    expect(followedUserAfter.followers).toBe([userFollowingData.secondId])
    expect(followingUserAfter.followers).toHaveLength(0)
    expect(followedUserAfter.accountFollowRequests).toBe(undefined)
    expect(followingUserAfter.accountFollowRequests).toBe(undefined)
    expect(followedUserAfter.following).toHaveLength(0)
    expect(followingUserAfter.following).toBe([userGettingFollowedData.secondId])
})

test('If following a user multiple times does not create multiple follows', async () => {
    expect.assertions(4);

    await new User(userFollowingData).save();
    await new User(userGettingFollowedData).save();

    for (let i = 0; i < 10; i++) {
        await TempController.followuser(userFollowingData._id, userGettingFollowedData.secondId);
    }

    const returned = await TempController.followuser(userFollowingData._id, userGettingFollowedData.secondId);
    
    const followingUserAfter = await User.findOne({_id: userFollowingData._id}).lean();
    const followedUserAfter = await User.findOne({_id: userGettingFollowedData._id}).lean();

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Followed User');
    expect(followingUserAfter.following).toBe([userGettingFollowedData.secondId])
    expect(followedUserAfter.followers).toBe([userFollowingData.secondId])
})


test('that non-related User documents do not get modified when following a public account', async () => {
    expect.assertions(5);
    
    await new User(userFollowingData).save();
    await new User(userGettingFollowedData).save();

    await User.insertMany([...new Array(10)].map((item, index) => {
        return {
            name: `${index}`
        }
    }))

    const beforeNotRelatedUsers = await User.find({$and: [{_id: {$ne: userFollowingData._id}}, {_id: {$ne: userGettingFollowedData._id}}]}).lean()

    const returned = await TempController.followuser(userFollowingData._id, userGettingFollowedData.secondId);

    const afterNotRelatedUsers = await User.find({$and: [{_id: {$ne: userFollowingData._id}}, {_id: {$ne: userGettingFollowedData._id}}]}).lean()

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Followed User')
    expect(afterNotRelatedUsers).toHaveLength(10)
    expect(beforeNotRelatedUsers).toHaveLength(10)
    expect(beforeNotRelatedUsers).toStrictEqual(afterNotRelatedUsers)
})

test('that non-related User documents do not get modified when following a private account', async () => {
    expect.assertions(5);

    const userGettingFollowed = {...userGettingFollowedData, privateAccount: true}
    
    await new User(userFollowingData).save();
    await new User(userGettingFollowed).save();

    await User.insertMany([...new Array(10)].map((item, index) => {
        return {
            name: `${index}`
        }
    }))

    const beforeNotRelatedUsers = await User.find({$and: [{_id: {$ne: userFollowingData._id}}, {_id: {$ne: userGettingFollowed._id}}]}).lean()

    const returned = await TempController.followuser(userFollowingData._id, userGettingFollowed.secondId);

    const afterNotRelatedUsers = await User.find({$and: [{_id: {$ne: userFollowingData._id}}, {_id: {$ne: userGettingFollowed._id}}]}).lean()

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Requested To Follow User')
    expect(afterNotRelatedUsers).toHaveLength(10)
    expect(beforeNotRelatedUsers).toHaveLength(10)
    expect(beforeNotRelatedUsers).toStrictEqual(afterNotRelatedUsers)
})