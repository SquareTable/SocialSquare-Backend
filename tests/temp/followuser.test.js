const User = require('../../models/User')
const MockMongoDBServer = require('../../libraries/MockDBServer')
const supertest = require('supertest')
const server = require('../../server')
const jwt = require('jsonwebtoken')

const TEST_CONSTANTS = require('../TEST_CONSTANTS')

const {expect, afterEach, beforeAll, afterAll} = require('@jest/globals');

jest.setTimeout(20_000)

const DB = new MockMongoDBServer();

beforeAll(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.purgeData()
})

afterAll(async () => {
    await DB.stopTest()
})

const userGettingFollowedData = {
    _id: '6592d55957dea9ccea3afe20',
    secondId: '6e3147a2-0381-4bad-b89c-f5edfa767fc2',
    name: 'userGettingFollowed'
}

const userFollowingData = {
    _id: '6592d56b1e5dac985aa2e919',
    secondId: '367f3a1e-7ae0-4885-b9b9-2471f90faf53',
    name: 'userFollowing'
}

const validToken = 'Bearer ' + jwt.sign({_id: userFollowingData._id}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

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
- Test following yourself fails
*/

async function validFollow() {
    return await supertest(server)
    .post('/tempRoute/followuser')
    .set('auth-web-token', validToken)
    .send({userPubId: userGettingFollowedData.secondId})
}

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If follow fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const invalidToken = 'Bearer ' + jwt.sign({_id: notString}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

        const response = await supertest(server)
        .post('/tempRoute/followuser')
        .set('auth-web-token', invalidToken)
        .send({userPubId: userGettingFollowedData.secondId})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })

    test(`If follow fails if userPubId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/followuser')
        .set('auth-web-token', validToken)
        .send({userPubId: notString})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`userPubId must be a string. Type provided: ${typeof notString}`);
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test('If follow fails if userId is not an ObjectId', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const invalidToken = 'Bearer ' + jwt.sign({_id: 'notanobjectid'}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

    const response = await supertest(server)
    .post('/tempRoute/followuser')
    .set('auth-web-token', invalidToken)
    .send({userPubId: userGettingFollowedData.secondId})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('userId must be an ObjectId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If follow fails if userPubId is not a valid UUID v4', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/followuser')
    .set('auth-web-token', validToken)
    .send({userPubId: 'i am not a UUID'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('userPubId must be a valid version 4 UUID')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If follow fails if user following the account cannot be found', async () => {
    expect.assertions(3);

    await new User(userGettingFollowedData).save();

    await DB.takeDBSnapshot()

    const response = await validFollow()

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Could not find user with provided userId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If follow fails if account to be followed could not be found', async () => {
    expect.assertions(3);

    await new User(userFollowingData).save();

    await DB.takeDBSnapshot()

    const response = await validFollow()

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Could not find user.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If follow fails if user following is blocked by the account to be followed', async () => {
    expect.assertions(9);

    const userGettingFollowed = {...userGettingFollowedData, blockedAccounts: [userFollowingData.secondId]}

    await new User(userFollowingData).save();
    await new User(userGettingFollowed).save();

    await DB.takeDBSnapshot()

    const response = await validFollow()

    const followedUserAfter = await User.findOne({_id: userGettingFollowed._id}).lean();
    const followingUserAfter = await User.findOne({_id: userFollowingData._id}).lean();

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Could not find user.')
    expect(followedUserAfter.followers).toHaveLength(0)
    expect(followingUserAfter.followers).toHaveLength(0)
    expect(followedUserAfter.accountFollowRequests).toStrictEqual([])
    expect(followingUserAfter.accountFollowRequests).toStrictEqual([])
    expect(followedUserAfter.following).toHaveLength(0)
    expect(followingUserAfter.following).toHaveLength(0)
    expect(await DB.noChangesMade()).toBe(true)
})

test('If a private account gets followed, a follow request gets created (and not a follow)', async () => {
    expect.assertions(9);

    const userGettingFollowed = {...userGettingFollowedData, privateAccount: true};

    await new User(userFollowingData).save();
    await new User(userGettingFollowed).save();

    await DB.takeDBSnapshot()

    const response = await validFollow()

    const followedUserAfter = await User.findOne({_id: userGettingFollowed._id}).lean();
    const followingUserAfter = await User.findOne({_id: userFollowingData._id}).lean();

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Requested To Follow User')
    expect(followedUserAfter.followers).toHaveLength(0)
    expect(followingUserAfter.followers).toHaveLength(0)
    expect(followedUserAfter.accountFollowRequests).toStrictEqual([userFollowingData.secondId])
    expect(followingUserAfter.accountFollowRequests).toStrictEqual([])
    expect(followedUserAfter.following).toHaveLength(0)
    expect(followingUserAfter.following).toHaveLength(0)
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})

test('that multiple account follow requests cannot be made from the same user', async () => {
    expect.assertions(4);

    const userGettingFollowed = {...userGettingFollowedData, privateAccount: true};

    await new User(userFollowingData).save();
    await new User(userGettingFollowed).save();

    await DB.takeDBSnapshot()

    //First follow
    await validFollow()

    const response = await validFollow()

    const followedUserAfter = await User.findOne({_id: userGettingFollowedData._id}).lean();

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Requested To Follow User')
    expect(followedUserAfter.accountFollowRequests).toStrictEqual([userFollowingData.secondId])
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})

test('If a following a user works and updates both User documents and no account follow requests are made', async () => {
    expect.assertions(9);

    await new User(userFollowingData).save();
    await new User(userGettingFollowedData).save();

    await DB.takeDBSnapshot()

    const response = await validFollow()

    const followedUserAfter = await User.findOne({_id: userGettingFollowedData._id}).lean();
    const followingUserAfter = await User.findOne({_id: userFollowingData._id}).lean();

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Followed User');
    expect(followedUserAfter.followers).toStrictEqual([userFollowingData.secondId])
    expect(followingUserAfter.followers).toHaveLength(0)
    expect(followedUserAfter.accountFollowRequests).toStrictEqual([])
    expect(followingUserAfter.accountFollowRequests).toStrictEqual([])
    expect(followedUserAfter.following).toHaveLength(0)
    expect(followingUserAfter.following).toStrictEqual([userGettingFollowedData.secondId])
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})

test('If following a user multiple times does not create multiple follows', async () => {
    expect.assertions(5);

    await new User(userFollowingData).save();
    await new User(userGettingFollowedData).save();

    await DB.takeDBSnapshot()

    await validFollow()

    const response = await validFollow()
    
    const followingUserAfter = await User.findOne({_id: userFollowingData._id}).lean();
    const followedUserAfter = await User.findOne({_id: userGettingFollowedData._id}).lean();

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Followed User');
    expect(followingUserAfter.following).toStrictEqual([userGettingFollowedData.secondId])
    expect(followedUserAfter.followers).toStrictEqual([userFollowingData.secondId])
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})


test('that non-related User documents do not get modified when following a public account', async () => {
    expect.assertions(6);
    
    await new User(userFollowingData).save();
    await new User(userGettingFollowedData).save();

    await User.insertMany([...new Array(10)].map((item, index) => {
        return {
            name: `name${index}`
        }
    }))

    await DB.takeDBSnapshot()

    const beforeNotRelatedUsers = await User.find({$and: [{_id: {$ne: userFollowingData._id}}, {_id: {$ne: userGettingFollowedData._id}}]}).lean()

    const response = await validFollow()

    const afterNotRelatedUsers = await User.find({$and: [{_id: {$ne: userFollowingData._id}}, {_id: {$ne: userGettingFollowedData._id}}]}).lean()

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Followed User')
    expect(afterNotRelatedUsers).toHaveLength(10)
    expect(beforeNotRelatedUsers).toHaveLength(10)
    expect(beforeNotRelatedUsers).toStrictEqual(afterNotRelatedUsers)
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})

test('that non-related User documents do not get modified when following a private account', async () => {
    expect.assertions(6);

    const userGettingFollowed = {...userGettingFollowedData, privateAccount: true}
    
    await new User(userFollowingData).save();
    await new User(userGettingFollowed).save();

    await User.insertMany([...new Array(10)].map((item, index) => {
        return {
            name: `name${index}`
        }
    }))

    await DB.takeDBSnapshot()

    const beforeNotRelatedUsers = await User.find({$and: [{_id: {$ne: userFollowingData._id}}, {_id: {$ne: userGettingFollowed._id}}]}).lean()

    const response = await validFollow()

    const afterNotRelatedUsers = await User.find({$and: [{_id: {$ne: userFollowingData._id}}, {_id: {$ne: userGettingFollowed._id}}]}).lean()

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Requested To Follow User')
    expect(afterNotRelatedUsers).toHaveLength(10)
    expect(beforeNotRelatedUsers).toHaveLength(10)
    expect(beforeNotRelatedUsers).toStrictEqual(afterNotRelatedUsers)
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})

test('Following yourself fails', async () => {
    expect.assertions(4);

    await new User(userFollowingData).save();

    await DB.takeDBSnapshot()

    const beforeUsers = await User.find({}).lean();

    const response = await supertest(server)
    .post('/tempRoute/followuser')
    .set('auth-web-token', validToken)
    .send({userPubId: userFollowingData.secondId})

    const afterUsers = await User.find({}).lean();

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('You cannot follow yourself.');
    expect(beforeUsers).toStrictEqual(afterUsers);
    expect(await DB.noChangesMade()).toBe(true)
})