const MockMongoDBServer = require('../../libraries/MockDBServer');
const User = require('../../models/User');
const server = require('../../server')
const supertest = require('supertest')
const jwt = require('jsonwebtoken')

const uuid = require('uuid')

const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const {beforeAll, afterEach, afterAll, test, expect} = require('@jest/globals');

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

const userUnfollowingData = {
    _id: '659420149d67e23dd69f8865',
    secondId: '07bd0de1-5d0e-45d7-9121-7e45963fa46e',
    name: 'unfollowing'
}

const userGettingUnfollowedData = {
    _id: '6594201f37b2503c787edec3',
    secondId: '3a37d41b-8bf2-4ed5-be0b-e975b52a3f16',
    name: 'gettingunfollowed'
}

const randomTestUsers = [...new Array(20)].map((item, index) => {
    if (Math.random() > 0.5) {
        return {
            privateAccount: true,
            accountFollowRequests: [...new Array(10)].map(() => uuid.v4()),
            name: `${index}name`,
            displayName: 'testuser'
        }
    }

    return {
        followers: [...new Array(10)].map(() => uuid.v4()),
        name: `${index}name`,
        displayName: 'testuser'
    }
})

/*
Tests:
- Test unfollow fails if userId is not a string
- Test unfollow fails if userId is not an ObjectId
- Test unfollow fails if userPubId is not a string
- Test unfollow fails if userPubId is not a valid UUID v4
- Test unfollow fails if follower user cannot be found
- Test unfollow fails if account that is getting unfollowed cannot be found
- Test unfollow fails if the follower is blocked
- Test if follow request gets removed if the account is private (and not follow)
- Test if follow gets removed if the account is public (and following item gets removed from the account following)
- Test if non-related User accounts do not get modified during request removal
- Test if non-related User accounts do not get modified during follow removal
*/

const validToken = 'Bearer ' + jwt.sign({_id: userUnfollowingData._id}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

async function validUnfollow() {
    return await supertest(server)
    .post('/tempRoute/unfollowuser')
    .set('auth-web-token', validToken)
    .send({userPubId: userGettingUnfollowedData.secondId})
}

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`Unfollow fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const invalidToken = 'Bearer ' + jwt.sign({_id: notString}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

        const response = await supertest(server)
        .post('/tempRoute/unfollowuser')
        .set('auth-web-token', invalidToken)
        .send({userPubId: userGettingUnfollowedData.secondId})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })

    test(`Unfollow fails if userPubId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/unfollowuser')
        .set('auth-web-token', validToken)
        .send({userPubId: notString})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`userPubId must be a string. Type provided: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test('Unfollow fails if userId is not an ObjectId', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const invalidToken = 'Bearer ' + jwt.sign({_id: 'iamnotanobjectid'}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

    const response = await supertest(server)
    .post('/tempRoute/unfollowuser')
    .set('auth-web-token', invalidToken)
    .send({userPubId: userGettingUnfollowedData.secondId})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('userId must be an ObjectId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('Unfollow fails if userPubId is not a valid v4 UUID', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/unfollowuser')
    .set('auth-web-token', validToken)
    .send({userPubId: 'iamnotavaliduuidv4'})

    expect(response.statusCode).toBe(400)
    expect(response.body.message).toBe('userPubId must be a valid version 4 UUID')
    expect(await DB.noChangesMade()).toBe(true)
})

test('Unfollow fails if follower user cannot be found', async () => {
    expect.assertions(3);

    await new User(userGettingUnfollowedData).save();

    await DB.takeDBSnapshot()

    const response = await validUnfollow()

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Could not find user with provided userId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('Unfollow fails if account getting unfollowed cannot be found', async () => {
    expect.assertions(3);

    await new User(userUnfollowingData).save();

    await DB.takeDBSnapshot()

    const response = await validUnfollow()

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Could not find user.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('Unfollow fails if follower is blocked', async () => {
    expect.assertions(3);

    const userGettingUnfollowed = {...userGettingUnfollowedData, blockedAccounts: [userUnfollowingData.secondId]}

    await new User(userUnfollowingData).save();
    await new User(userGettingUnfollowed).save();

    await DB.takeDBSnapshot()

    const response = await validUnfollow()

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Could not find user.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('Unfollow removes follow request if account is private', async () => {
    expect.assertions(4);

    const randomUUID = uuid.v4()

    const userGettingUnfollowed = {
        ...userGettingUnfollowedData,
        privateAccount: true,
        followers: [...new Array(10)].map(() => uuid.v4()),
        accountFollowRequests: [userUnfollowingData.secondId, randomUUID]
    }

    await new User(userGettingUnfollowed).save();
    await new User(userUnfollowingData).save();

    await DB.takeDBSnapshot()

    const beforeUser = await User.findOne({_id: {$eq: userGettingUnfollowed._id}}).lean();

    const response = await validUnfollow()

    const afterUser = await User.findOne({_id: {$eq: userGettingUnfollowed._id}}).lean();

    beforeUser.accountFollowRequests = [randomUUID];

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Removed Request To Follow User');
    expect(beforeUser).toStrictEqual(afterUser);
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})

test('Unfollow removes follow and following if account is public', async () => {
    expect.assertions(5);

    const randomUUID = uuid.v4();

    const userGettingUnfollowed = {
        ...userGettingUnfollowedData,
        followers: [userUnfollowingData.secondId, randomUUID]
    }

    const userUnfollowing = {
        ...userUnfollowingData,
        following: [userGettingUnfollowedData.secondId, randomUUID]
    }

    await new User(userGettingUnfollowed).save();
    await new User(userUnfollowing).save();

    await DB.takeDBSnapshot()

    const beforeUnfollowingUser = await User.findOne({_id: {$eq: userUnfollowingData._id}}).lean();
    const beforeUnfollowedUser = await User.findOne({_id: {$eq: userGettingUnfollowedData._id}}).lean();

    const response = await validUnfollow()

    const afterUnfollowingUser = await User.findOne({_id: {$eq: userUnfollowingData._id}}).lean();
    const afterUnfollowedUser = await User.findOne({_id: {$eq: userGettingUnfollowedData._id}}).lean();

    beforeUnfollowingUser.following = [randomUUID];
    beforeUnfollowedUser.followers = [randomUUID];

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('UnFollowed user');
    expect(beforeUnfollowedUser).toStrictEqual(afterUnfollowedUser);
    expect(beforeUnfollowingUser).toStrictEqual(afterUnfollowingUser)
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})

test('that non-related User documents do not get modified when removing an account follow request', async () => {
    expect.assertions(4);

    await User.insertMany(randomTestUsers)

    const userGettingUnfollowed = {
        ...userGettingUnfollowedData,
        privateAccount: true,
        accountFollowRequests: [userUnfollowingData.secondId]
    }

    await new User(userGettingUnfollowed).save();
    await new User(userUnfollowingData).save();

    await DB.takeDBSnapshot()

    const beforeTestUsers = await User.find({displayName: 'testuser'}).lean();

    const response = await validUnfollow()

    const afterTestUsers = await User.find({displayName: 'testuser'}).lean();

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Removed Request To Follow User');
    expect(beforeTestUsers).toStrictEqual(afterTestUsers);
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})

test('that non-related User documents do not get modified when removing an account follow', async () => {
    expect.assertions(4);

    await User.insertMany(randomTestUsers)

    const userGettingUnfollowed = {
        ...userGettingUnfollowedData,
        followers: [userUnfollowingData.secondId]
    }

    const userUnfollowing = {
        ...userUnfollowingData,
        following: [userGettingUnfollowedData.secondId]
    }

    await new User(userGettingUnfollowed).save();
    await new User(userUnfollowing).save();

    await DB.takeDBSnapshot()

    const beforeTestUsers = await User.find({displayName: 'testuser'}).lean();

    const response = await validUnfollow()

    const afterTestUsers = await User.find({displayName: 'testuser'}).lean();

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('UnFollowed user');
    expect(beforeTestUsers).toStrictEqual(afterTestUsers);
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})