const MockMongoDBServer = require('../../libraries/MockDBServer');
const mongoose = require('mongoose');
const TempController = require('../../controllers/Temp');

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');

const {expect, beforeAll, afterEach, afterAll} = require('@jest/globals');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

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

const validPushToken = "ExponentPushToken[ct-3_HBpE3wB69r5hdtxia]";

for (const invalidUserId of TEST_CONSTANTS.NOT_STRINGS) {
    test (`If upload fails if userId is not a string. Testing: ${JSON.stringify(invalidUserId)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()
        
        const returned = await TempController.sendnotificationkey(invalidUserId, undefined, undefined);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Provided type: ${typeof invalidUserId}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test ('If upload fails if userId is not an objectId', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await TempController.sendnotificationkey('i am not an objectid', undefined, undefined);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe(`userId must be an objectId.`)
    expect(await DB.noChangesMade()).toBe(true)
})

for (const invalidNotificationKey of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If upload fails if notificationKey is not a string. Testing: ${JSON.stringify(invalidNotificationKey)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const returned = await TempController.sendnotificationkey("653bcdd1ab9cf6186dde00cf", invalidNotificationKey, undefined);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`notificationKey must be a string. Provided type: ${typeof invalidNotificationKey}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test ('If upload fails if notificationKey is not a valid Expo push token', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await TempController.sendnotificationkey("653bcdd1ab9cf6186dde00cf", 'i am not an expo push token', undefined);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe(`notificationKey must be a valid Expo push token.`)
    expect(await DB.noChangesMade()).toBe(true)
})

for (const invalidRefreshTokenId of TEST_CONSTANTS.NOT_STRINGS) {
    test (`If upload fails if refreshTokenId is not a string. Testing: ${JSON.stringify(invalidRefreshTokenId)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()
        
        const returned = await TempController.sendnotificationkey("653bcdd1ab9cf6186dde00cf", validPushToken, invalidRefreshTokenId);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`refreshTokenId must be a string. Provided type: ${typeof invalidRefreshTokenId}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test ('If upload fails if refreshTokenId is not an objectId.', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()
    
    const returned = await TempController.sendnotificationkey("653bcdd1ab9cf6186dde00cf", validPushToken, 'i am not an objectid');

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe(`refreshTokenId must be an objectId.`)
    expect(await DB.noChangesMade()).toBe(true)
})

test('If upload fails if user with userId could not be found', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await TempController.sendnotificationkey("653bcdd1ab9cf6186dde00cf", validPushToken, "653bcdd1ab9cf6186dde00cf");

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe("Could not find user with provided userId.")
    expect(await DB.noChangesMade()).toBe(true)
})

test('If upload fails if refresh token with refreshTokenId could not be found', async () => {
    expect.assertions(3);

    const userData = {
        _id: new mongoose.Types.ObjectId("653bcdd1ab9cf6186dde00cf")
    }

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const returned = await TempController.sendnotificationkey(String(userData._id), validPushToken, "653bcdd1ab9cf6186dde00cf");

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe("Could not find refresh token.")
    expect(await DB.noChangesMade()).toBe(true)
})

test('If upload successfully modifies refresh token', async () => {
    expect.assertions(6);

    const userData = {
        _id: new mongoose.Types.ObjectId(),
        __v: 0
    }

    const refreshTokenData = {
        _id: new mongoose.Types.ObjectId(),
        userId: userData._id,
        __v: 0
    }

    await new User(userData).save();
    await new RefreshToken(refreshTokenData).save();

    await DB.takeDBSnapshot()

    const savedUser = await User.findOne({}).lean();

    const returned = await TempController.sendnotificationkey(String(userData._id), validPushToken, String(refreshTokenData._id));

    const tokens = await RefreshToken.find({}).lean();
    const users = await User.find({}).lean();

    const token = {...tokens[0]};
    const user = {...users[0]};

    refreshTokenData.notificationKey = validPushToken;

    expect(returned.statusCode).toBe(200);
    expect(tokens).toHaveLength(1);
    expect(users).toHaveLength(1);
    expect(token).toStrictEqual(refreshTokenData);
    expect(user).toStrictEqual(savedUser);
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

    const userData = {
        _id: new mongoose.Types.ObjectId(),
        __v: 0
    }

    const refreshTokenData = {
        _id: new mongoose.Types.ObjectId(),
        userId: userData._id,
        __v: 0,
        createdAt: Date.now()
    }

    await User.insertMany(users);
    await RefreshToken.insertMany(refreshTokens);
    await new User(userData).save();

    const savedUsers = await User.find({}).lean();
    const savedRefreshTokens = await RefreshToken.find({}).lean();

    await new RefreshToken(refreshTokenData).save();

    await DB.takeDBSnapshot()

    const returned = await TempController.sendnotificationkey(String(userData._id), validPushToken, String(refreshTokenData._id));

    const dbUsers = await User.find({}).lean();
    const dbRefreshTokens = await RefreshToken.find({_id: {$ne: refreshTokenData._id}}).lean();

    expect(returned.statusCode).toBe(200);
    expect(dbUsers).toStrictEqual(savedUsers);
    expect(dbRefreshTokens).toStrictEqual(savedRefreshTokens);
    expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
})