const MockMongoDBServer = require('../../libraries/MockDBServer');
const mongoose = require('mongoose');

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');

const {expect, beforeAll, afterEach, afterAll} = require('@jest/globals');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const supertest = require('supertest')
const server = require('../../server')
const jwt = require('jsonwebtoken')

jest.setTimeout(20_000); //20 seconds per test

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

/*
Tests:
Test if upload fails if notification key is not a string
Test if upload fails if notification key is not an expo push token
Test if upload fails if refreshTokenId is not a string
Test if upload fails if refreshTokenId is not an objectId
Test if upload fails if userId is not a string
Test if upload fails if userId is not an objectId
Test if upload fails if user could not be found
Test if upload fails if refresh token could not be found
Test upload successfully modifies refresh token
Test upload does not modify other refresh tokens
*/

const validPushToken = "ExponentPushToken[ct-3_HBpE3wB69r5hdtxib]";

const userData = {
    _id: String(new mongoose.Types.ObjectId())
}

const refreshTokenData = {
    _id: String(new mongoose.Types.ObjectId()),
    userId: userData._id,
    __v: 0
}

const validToken = 'Bearer ' + jwt.sign({_id: userData._id}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

async function validSend() {
    return await supertest(server)
    .post('/tempRoute/sendnotificationkey')
    .set('auth-web-token', validToken)
    .send({notificationKey: validPushToken, refreshTokenId: refreshTokenData._id})
}

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test (`If upload fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const invalidToken = 'Bearer ' + jwt.sign({_id: notString}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

        const response = await supertest(server)
        .post('/tempRoute/sendnotificationkey')
        .set('auth-web-token', invalidToken)
        .send({notificationKey: validPushToken, refreshTokenId: refreshTokenData._id})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`userId must be a string. Provided type: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })

    test(`If upload fails if notificationKey is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/sendnotificationkey')
        .set('auth-web-token', validToken)
        .send({notificationKey: notString, refreshTokenId: refreshTokenData._id})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`notificationKey must be a string. Provided type: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })

    test (`If upload fails if refreshTokenId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/sendnotificationkey')
        .set('auth-web-token', validToken)
        .send({notificationKey: validPushToken, refreshTokenId: notString})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`refreshTokenId must be a string. Provided type: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test ('If upload fails if userId is not an objectId', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const invalidToken = 'Bearer ' + jwt.sign({_id: 'iamnotanobjectid'}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

    const response = await supertest(server)
    .post('/tempRoute/sendnotificationkey')
    .set('auth-web-token', invalidToken)
    .send({notificationKey: validPushToken, refreshTokenId: refreshTokenData._id})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(`userId must be an objectId.`)
    expect(await DB.noChangesMade()).toBe(true)
})

test ('If upload fails if notificationKey is not a valid Expo push token', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/sendnotificationkey')
    .set('auth-web-token', validToken)
    .send({notificationKey: 'i am not an expo push token', refreshTokenId: refreshTokenData._id})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(`notificationKey must be a valid Expo push token.`)
    expect(await DB.noChangesMade()).toBe(true)
})

test ('If upload fails if refreshTokenId is not an objectId.', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/sendnotificationkey')
    .set('auth-web-token', validToken)
    .send({notificationKey: validPushToken, refreshTokenId: 'iamnotanobjectid'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(`refreshTokenId must be an objectId.`)
    expect(await DB.noChangesMade()).toBe(true)
})

test('If upload fails if user with userId could not be found', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await validSend()

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Could not find user with provided userId.")
    expect(await DB.noChangesMade()).toBe(true)
})

test('If upload fails if refresh token with refreshTokenId could not be found', async () => {
    expect.assertions(3);

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const response = await validSend()

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Could not find refresh token.")
    expect(await DB.noChangesMade()).toBe(true)
})

test('If upload successfully modifies refresh token', async () => {
    expect.assertions(6);

    await new User(userData).save();
    await new RefreshToken(refreshTokenData).save();

    await DB.takeDBSnapshot()

    const beforeUsers = await User.find({}).lean();
    const beforeTokens = await RefreshToken.find({}).lean();

    const expectedTokens = [...beforeTokens];
    expectedTokens[0].notificationKey = validPushToken

    const response = await validSend()

    const afterUsers = await User.find({}).lean();
    const afterTokens = await RefreshToken.find({}).lean();

    const tokens = await RefreshToken.find({}).lean();
    const users = await User.find({}).lean();

    expect(response.statusCode).toBe(200);
    expect(tokens).toHaveLength(1);
    expect(users).toHaveLength(1);
    expect(afterUsers).toStrictEqual(beforeUsers);
    expect(afterTokens).toStrictEqual(expectedTokens);
    expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
})

test('If successful upload does not modify other refresh tokens in the database', async () => {
    expect.assertions(4);

    const users = [...new Array(10)].map((item, index) => {
        return {
            _id: new mongoose.Types.ObjectId(),
            __v: 0,
            name: `name${index}`
        }
    })

    const refreshTokens = [...new Array(10)].map((item, index) => {
        return {
            _id: new mongoose.Types.ObjectId(),
            userId: users[index].userId,
            notificationKey: 'i am totally valid token ' + index,
            createdAt: Date.now() - 10_000,
            __v: 0
        }
    })

    await User.insertMany(users);
    await RefreshToken.insertMany(refreshTokens);
    await new User(userData).save();

    const savedUsers = await User.find({}).lean();
    const savedRefreshTokens = await RefreshToken.find({}).lean();

    await new RefreshToken(refreshTokenData).save();

    await DB.takeDBSnapshot()

    const response = await validSend()

    const dbUsers = await User.find({}).lean();
    const dbRefreshTokens = await RefreshToken.find({_id: {$ne: refreshTokenData._id}}).lean();

    expect(response.statusCode).toBe(200);
    expect(dbUsers).toStrictEqual(savedUsers);
    expect(dbRefreshTokens).toStrictEqual(savedRefreshTokens);
    expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
})