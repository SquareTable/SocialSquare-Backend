const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {v4: uuidv4} = require('uuid');

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const jwt = require('jsonwebtoken')

const {expect, afterEach, beforeAll, afterAll} = require('@jest/globals');
const { refreshTokenDecryption } = require('../../middleware/TokenHandler');

const server = require('../../server')
const supertest = require('supertest')

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

const validEmail = "john.sullivan@gmail.com";
const validPassword = "securepassword";
const validIP = "127.0.0.1";

const newPassword = 'mynewpassword';

const validHashedPassword = "$2b$10$34gQut./qmo7HoG1aKkQeOQWeZzCjwwMMgk8nsLpwb3snlKK0wRKy";

const userData = {
    _id: new mongoose.Types.ObjectId(),
    secondId: uuidv4(),
    email: validEmail,
    password: validHashedPassword
}

const validToken = 'Bearer ' + jwt.sign({_id: userData._id}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

/*
Tests:
Test if change fails if userId is not a string
Test if change fails if userId is not an objectId
Test if change fails if currentPassword is not a string
Test if change fails if newPassword is not a string
Test if change fails if newPassword is less than 8 characters
Test if change fails if newPassword is more than 17 characters
Test if change fails if user with userId cannot be found
Test if change fails if currentPassword is wrong
Test if change fails if currentPassword is an empty string
Test if change fails if newPassword is an empty string
Test if new token is generated and it is usable
Test if new refreshToken is generated and it is usable
Test if new encryptedRefreshToken is generated and it can be decrypted back to refreshToken
Test RefreshToken document is created with admin set to false
Test if IP is saved to RefreshToken document only if user allows it
Test if IP is not saved to RefreshToken document if user does not allow it
Test if IP-derived location is saved to RefreshToken document only if user allows it
Test if IP-derived location is not saved to RefreshToken document if user does not allow it
Test if IP-derived location is set to "Unknown Location" if the location cannot be found
Test if deviceType is saved to the RefreshToken document only if the user allows it
Test if deviceType is not saved to the RefreshToken document if the user does not allow it
Test if password change is successful with correct inputs
Test if all previous RefreshTokens from the same user are removed when password is changed
Test if other RefreshToken documents not related to the account are not affected
Test if other User documents are not interfered with
*/

async function validChangePassword() {
    return await supertest(server)
    .post('/tempRoute/changepassword')
    .set('auth-web-token', validToken)
    .send({currentPassword: validPassword, newPassword})
}

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If change fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const invalidToken = 'Bearer ' + jwt.sign({_id: notString}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

        const response = await supertest(server)
        .post('/tempRoute/changepassword')
        .set('auth-web-token', invalidToken)
        .send({currentPassword: validPassword, newPassword})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`userId must be a string. Provided type: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })

    test(`If change fails if currentPassword is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/changepassword')
        .set('auth-web-token', validToken)
        .send({currentPassword: notString, newPassword})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`currentPassword must be a string. Provided type: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })

    test(`If change fails if newPassword is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/changepassword')
        .set('auth-web-token', validToken)
        .send({currentPassword: validPassword, newPassword: notString})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`newPassword must be a string. Provided type: ${typeof notString}`);
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test('If change fails if userId is not an ObjectId', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const invalidToken = 'Bearer ' + jwt.sign({_id: 'notanobjectid'}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

    const response = await supertest(server)
    .post('/tempRoute/changepassword')
    .set('auth-web-token', invalidToken)
    .send({currentPassword: validPassword, newPassword})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('userId must be an ObjectId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if newPassword is less than 8 characters', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changepassword')
    .set('auth-web-token', validToken)
    .send({currentPassword: validPassword, newPassword: 'short'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Your new password must be 8 or more characters.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if newPassword is more than 17 characters', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changepassword')
    .set('auth-web-token', validToken)
    .send({currentPassword: validPassword, newPassword: 'thisis18characters'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Your new password cannot be more than 17 characters.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if user with userId could not be found', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changepassword')
    .set('auth-web-token', validToken)
    .send({currentPassword: validPassword, newPassword})

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Could not find user with provided userId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if password is wrong', async () => {
    expect.assertions(3);

    await new User(userData).save();
    
    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changepassword')
    .set('auth-web-token', validToken)
    .send({currentPassword: 'wrongpassword', newPassword})

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Wrong password entered!')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if currentPassword is an empty string', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changepassword')
    .set('auth-web-token', validToken)
    .send({currentPassword: '', newPassword})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Current password cannot be empty.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if newPassword is an empty string', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changepassword')
    .set('auth-web-token', validToken)
    .send({currentPassword: validPassword, newPassword: ''})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('New password cannot be empty.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('tokens', async () => {
    expect.assertions(8);

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const response = await validChangePassword()

    const refreshTokens = await RefreshToken.find({});
    const refreshToken = refreshTokens[0];

    expect(response.statusCode).toBe(200);
    
    //Test if token is generated and is usable
    expect(TEST_CONSTANTS.JWTVerifier(process.env.SECRET_FOR_TOKENS, response.body.token.replace('Bearer ', ''))).resolves.toBe(true);

    //Test if refresh token is generated and is usable
    expect(TEST_CONSTANTS.JWTVerifier(process.env.SECRET_FOR_REFRESH_TOKENS, response.body.refreshToken.replace('Bearer ', ''))).resolves.toBe(true);

    //Test if encryptedRefreshToken can be decrypted to refresh token
    expect(refreshTokenDecryption(refreshToken.encryptedRefreshToken)).toBe(response.body.refreshToken.replace('Bearer ', ''))

    //Test RefreshToken document is created and with admin set to false
    expect(refreshToken.admin).toBe(false);
    expect(refreshToken.createdAt.getTime()).toBeGreaterThan(Date.now() - 100_000) //Gives 100 second leeway for test
    expect(refreshTokens).toHaveLength(1)

    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('If IP is added to RefreshToken document if user allows it', async () => {
    expect.assertions(3);

    await new User({
        ...userData,
        settings: {
            loginActivitySettings: {
                getIP: true
            }
        }
    }).save();

    await DB.takeDBSnapshot()

    const response = await validChangePassword()

    const refreshToken = await RefreshToken.findOne({_id: {$eq: response.body.refreshTokenId}}).lean();

    expect(response.statusCode).toBe(200);
    expect(refreshToken.IP).toBe(validIP);

    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('If IP is not added to RefreshToken document if user does not allow it', async () => {
    expect.assertions(3);

    await new User({
        ...userData,
        settings: {
            loginActivitySettings: {
                getIP: false
            }
        }
    }).save();

    await DB.takeDBSnapshot()

    const response = await validChangePassword()

    const refreshToken = await RefreshToken.findOne({_id: {$eq: response.body.refreshTokenId}}).lean();

    expect(response.statusCode).toBe(200);
    expect(refreshToken.IP).toBe(undefined);

    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('If IP-derived location is added to RefreshToken document if the user allows it', async () => {
    expect.assertions(4);

    await new User({
        ...userData,
        settings: {
            loginActivitySettings: {
                getLocation: true
            }
        }
    }).save();

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changepassword')
    .set('X-Forwarded-For', '1.1.1.1')
    .set('auth-web-token', validToken)
    .send({currentPassword: validPassword, newPassword})

    const refreshToken = await RefreshToken.findOne({}).lean();

    expect(response.statusCode).toBe(200);
    expect(refreshToken.location).toBeTruthy();
    expect(refreshToken.location !== 'Unknown Location').toBe(true)

    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('If IP-derived location is not added to RefreshToken document if the user does not allow it', async () => {
    expect.assertions(3);

    await new User({
        ...userData,
        settings: {
            loginActivitySettings: {
                getLocation: false
            }
        }
    }).save();

    await DB.takeDBSnapshot()

    const response = await validChangePassword()

    const refreshToken = await RefreshToken.findOne({}).lean();

    expect(response.statusCode).toBe(200);
    expect(refreshToken.location).toBe(undefined);

    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('If IP-derived location is "Unknown Location" if a location cannot be found', async () => {
    expect.assertions(3);

    await new User({
        ...userData,
        settings: {
            loginActivitySettings: {
                getLocation: true
            }
        }
    }).save();

    await DB.takeDBSnapshot()

    const response = await validChangePassword()

    const refreshToken = await RefreshToken.findOne({}).lean();

    expect(response.statusCode).toBe(200);
    expect(refreshToken.location).toBe('Unknown Location');

    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('if deviceType is saved to RefreshToken document if the user allows it', async () => {
    expect.assertions(3);

    await new User({
        ...userData,
        settings: {
            loginActivitySettings: {
                getDeviceType: true
            }
        }
    }).save();

    await DB.takeDBSnapshot()

    const response = await validChangePassword()

    const refreshToken = await RefreshToken.findOne({}).lean();

    expect(response.statusCode).toBe(200);
    expect(refreshToken.deviceType).toBeTruthy();

    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('if deviceType is not saved to RefreshToken document if the user does not allow it', async () => {
    expect.assertions(3);

    await new User({
        ...userData,
        settings: {
            loginActivitySettings: {
                getDeviceType: false
            }
        }
    }).save();
    
    await DB.takeDBSnapshot()

    const response = await validChangePassword()

    const refreshToken = await RefreshToken.findOne({}).lean();

    expect(response.statusCode).toBe(200);
    expect(refreshToken.deviceType).toBe(undefined);

    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('If password change is successful with correct inputs', async () => {
    expect.assertions(3);

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const response = await validChangePassword()

    const afterUser = await User.findOne({}).lean();

    expect(response.statusCode).toBe(200);
    expect(bcrypt.compareSync(newPassword, afterUser.password)).toBe(true);
    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('If all RefreshTokens from the user get removed', async () => {
    expect.assertions(4);

    await new User(userData).save();

    const refreshTokens = [...new Array(10)].map((item, index) => {
        return {
            userId: userData._id,
            createdAt: 1 + index,
            admin: false
        }
    })

    await RefreshToken.insertMany(refreshTokens);

    await DB.takeDBSnapshot()

    const response = await validChangePassword()

    const afterRefreshTokens = await RefreshToken.find({}).lean();

    expect(response.statusCode).toBe(200);
    expect(afterRefreshTokens).toHaveLength(1);
    expect(afterRefreshTokens[0].createdAt.getTime()).toBeGreaterThan(Date.now() - 100_000) //Gives 100 second leeway to run test
    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('if other RefreshToken documents not related to the account are not affected', async () => {
    expect.assertions(3);

    await new User(userData).save();

    const refreshTokens = [...new Array(10)].map((item, index) => {
        return {
            userId: new mongoose.Types.ObjectId(),
            createdAt: 1 + index,
            admin: false
        }
    })

    await RefreshToken.insertMany(refreshTokens);

    await DB.takeDBSnapshot()

    const beforeRefreshTokens = await RefreshToken.find({}).lean();

    const response = await validChangePassword()

    const afterRefreshTokens = await RefreshToken.find({userId: {$ne: userData._id}}).lean();

    expect(response.statusCode).toBe(200);
    expect(beforeRefreshTokens).toStrictEqual(afterRefreshTokens);
    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})

test('if other User documents do not get affected from password change', async () => {
    expect.assertions(3);

    const users = [...new Array(10)].map((item, index) => {
        return {
            _id: new mongoose.Types.ObjectId(),
            name: `name${index}`,
            password: 'password' + index
        }
    })

    await User.insertMany(users);

    const beforeUsers = await User.find({}).lean();

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const response = await validChangePassword()

    const afterUsers = await User.find({_id: {$ne: userData._id}}).lean();

    expect(response.statusCode).toBe(200);
    expect(beforeUsers).toStrictEqual(afterUsers);
    expect(await DB.changedCollections()).toIncludeSameMembers(['User', 'RefreshToken'])
})