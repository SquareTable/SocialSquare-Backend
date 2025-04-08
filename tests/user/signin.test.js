const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {v4: uuidv4} = require('uuid');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const server = require('../../server')
const supertest = require('supertest')

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const EmailVerificationCode = require('../../models/EmailVerificationCode');

const {expect, describe, afterEach, beforeAll, afterAll} = require('@jest/globals');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const { refreshTokenDecryption } = require('../../middleware/TokenHandler');

const validEmail = "john.sullivan@gmail.com";
const validPassword = "securepassword";

const validHashedPassword = "$2b$10$34gQut./qmo7HoG1aKkQeOQWeZzCjwwMMgk8nsLpwb3snlKK0wRKy";

jest.setTimeout(20_000); //20 seconds per test

const DB = new MockMongoDBServer();

beforeAll(async () => {
  await DB.startTest();
})

afterEach(async () => {
  await DB.purgeData();
})

afterAll(async () => {
  await DB.stopTest();
})

/*
Tests:
Test if signin fails if email is not a string
Test if signin fails if password is not a string
Test if signin fails if email is an empty string
Test if signin fails if password is an empty string
Test if signin fails if user with specified email could not be found
Test if signin fails if password is wrong (testing if user/signin carries out correct authentication)

Tests if email 2FA is enabled:
    - Test if email gets blurred
    - Test fromAddress is the value of process.env.SMTP_EMAIL
    - Test secondId is the user's secondId
    - Test EmailVerificationCode gets created
    - Test login does not interfere with other EmailVerificationCodes in the database
    - Test that there can only be one EmailVerificationCode per user and that the code gets updated
    - Test that a refresh token is not made
    - Test that user document does not get modified


Tests if email 2FA is not enabled:
    - Test if token gets created and is correct and usable
    - Test if refreshToken gets created and is correct and usable
    - Test if encryptedRefreshToken gets created and can be decrypted back to refreshToken
    - Test if RefreshToken document gets created (and admin is set to false)
    - Test if IP is not added to RefreshToken when the user does not allow it
    - Test if IP is added to RefreshToken when the user allows it
    - Test if IP-derived location is not added to RefreshToken when the user does not allow it
    - Test if IP-derived location is added to RefreshToken when the user allows it
    - Test if location is set to "Unknown Location" if location returned was null
    - Test if device name is not added to RefreshToken when the user does not allow it
    - Test if device name is added to RefreshToken when the user allows it
    - Test if correct user data gets returned
    - Test if already existing RefreshToken documents do not get modified
    - Test if already existing User documents do not get modified
    - Test that user document does not get modified
*/

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If signin fails if email is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: notString, password: validPassword})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`email must be a string. Provided type: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })

    test(`If signin fails if password is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: validEmail, password: notString})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`password must be a string. Provided type: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test(`If signin fails if email is an empty string`, async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/user/signin')
    .send({email: '', password: validPassword})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Email cannot be blank')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If signin fails if password is an empty string', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/user/signin')
    .send({email: validEmail, password: ''})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Password cannot be blank")
    expect(await DB.noChangesMade()).toBe(true)
})

test('If signin fails if user with specified email could not be found', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/user/signin')
    .send({email: validEmail, password: validPassword})

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("A user with the specified email does not exist.")
    expect(await DB.noChangesMade()).toBe(true)
})

test('If signin fails if password is wrong', async () => {
    expect.assertions(7);

    const userData = {
        email: validEmail,
        password: bcrypt.hashSync(validPassword, 12)
    }

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/user/signin')
    .send({email: userData.email, password: 'wrongpassword'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Invalid password entered!");
    expect(response.body.data).toBe(undefined);
    expect(response.body.token).toBe(undefined);
    expect(response.body.refreshToken).toBe(undefined);
    expect(response.body.refreshTokenId).toBe(undefined);
    expect(await DB.noChangesMade()).toBe(true)
})

describe('When Email 2FA is enabled', () => {
    const userData = {
        email: validEmail,
        password: validHashedPassword,
        authenticationFactorsEnabled: ["Email"],
        secondId: uuidv4(),
        _id: new mongoose.Types.ObjectId(),
        MFAEmail: validEmail
    }

    test('If email gets blurred', async () => {
        expect.assertions(3);

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        expect(response.statusCode).toBe(200);
        expect(response.body.data.email).toBe("jo**.s**li**n@g**il.com")
        expect(await DB.changedCollections()).toIncludeSameMembers(['EmailVerificationCode'])
    })

    test('if fromAddress is the value of process.env.SMTP_EMAIL', async () => {
        expect.assertions(3);

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        expect(response.statusCode).toBe(200);
        expect(response.body.data.fromAddress).toBe(process.env.SMTP_EMAIL)
        expect(await DB.changedCollections()).toIncludeSameMembers(['EmailVerificationCode'])
    })

    test("if returned secondId is the same as the user's secondId", async () => {
        expect.assertions(3);

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        expect(response.statusCode).toBe(200);
        expect(response.body.data.secondId).toBe(userData.secondId)
        expect(await DB.changedCollections()).toIncludeSameMembers(['EmailVerificationCode'])
    })

    test('that email verification code gets created', async () => {
        expect.assertions(6);

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const EmailVerificationCodes = await EmailVerificationCode.find({}).lean();

        const verificationCode = EmailVerificationCodes[0];

        expect(response.statusCode).toBe(200);
        expect(EmailVerificationCodes).toHaveLength(1);
        expect(String(verificationCode.userId)).toBe(String(userData._id))
        expect(typeof verificationCode.hashedVerificationCode).toBe('string');
        expect(new Date(verificationCode.createdAt).getTime()).toBeGreaterThan(Date.now() - 100_000) //Gives 100 second leeway
        expect(await DB.changedCollections()).toIncludeSameMembers(['EmailVerificationCode'])
    })

    test('that login does not interfere with other email verification codes in the database', async () => {
        expect.assertions(3);

        const codesToInsert = [...new Array(10)].map(() => {
            return {
                createdAt: new Date(Date.now()),
                userId: new mongoose.Types.ObjectId(),
                hashedVerificationCode: 'hashed',
                _id: new mongoose.Types.ObjectId(),
                __v: 0
            }
        })

        await new User(userData).save();
        await EmailVerificationCode.insertMany(codesToInsert);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const codesInDatabase = await EmailVerificationCode.find({hashedVerificationCode: 'hashed'}).lean();

        expect(response.statusCode).toBe(200);
        expect(codesInDatabase).toStrictEqual(codesToInsert);
        expect(await DB.changedCollections()).toIncludeSameMembers(['EmailVerificationCode'])
    })

    test('that there can only be one EmailVerificationCode document per user and the document gets updated for each new code', async () => {
        expect.assertions(6);

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const responseOne = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const codesOne = await EmailVerificationCode.find({}).lean();

        const responseTwo = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const codesTwo = await EmailVerificationCode.find({}).lean();

        expect(responseOne.statusCode).toBe(200);
        expect(responseTwo.statusCode).toBe(200);
        expect(codesOne).toHaveLength(1);
        expect(codesTwo).toHaveLength(1);
        expect(codesOne[0].createdAt !== codesTwo[0].createdAt).toBe(true);
        expect(await DB.changedCollections()).toIncludeSameMembers(['EmailVerificationCode'])
    })
})

describe('When Email 2FA is not enabled', () => {
    const userData = {
        email: validEmail,
        password: validHashedPassword,
        authenticationFactorsEnabled: [],
        secondId: uuidv4(),
        _id: new mongoose.Types.ObjectId()
    }

    test('if login works', async () => {
        expect.assertions(11);

        await new User(userData).save();

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        expect(response.statusCode).toBe(200);
        //Test if token gets created and is usable
        expect(TEST_CONSTANTS.JWTVerifier(process.env.SECRET_FOR_TOKENS, response.body.token.replace('Bearer ', ''))).resolves.toBe(true);

        //Test if refresh token gets created and is usable
        expect(TEST_CONSTANTS.JWTVerifier(process.env.SECRET_FOR_REFRESH_TOKENS, response.body.refreshToken.replace('Bearer ', ''))).resolves.toBe(true);

        //Test if encrypted refresh token gets created and can be decrypted back to refresh token
        const refreshTokens = await RefreshToken.find({}).lean();
        const savedRefreshToken = refreshTokens[0];
        expect(refreshTokens).toHaveLength(1);
        expect(refreshTokenDecryption(savedRefreshToken.encryptedRefreshToken)).toBe(response.body.refreshToken.replace('Bearer ', ''))

        //Test if RefreshToken document admin is set to false
        expect(savedRefreshToken.admin).toBe(false);

        //Test if RefreshToken document createdAt is correct
        expect(savedRefreshToken.createdAt.getTime()).toBeGreaterThan(Date.now() - 100_000) //Gives 100 second leeway for test

        //Start of test if correct user data gets returned
        const notIncludedKeys = [
          'notificationKeys',
          'password',
          'refreshTokens',
          'algorithmData',
          'accountFollowRequests',
          'blockedAccounts',
          'authenticationFactorsEnabled',
          'MFAEmail'
        ]

        let includesNotIncludedKey = false;
        const returnedUserDataKeys = Object.keys(response.body.data);

        for (const key of notIncludedKeys) {
            if (returnedUserDataKeys.includes(key)) {
                includesNotIncludedKey = true;
                break;
            }
        }

        expect(includesNotIncludedKey).toBe(false);
        expect(typeof response.body.data.followers).toBe("number");
        expect(typeof response.body.data.following).toBe("number");
        //End of test if correct user data gets returned


        expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
    })

    test('if IP is not added to the RefreshToken document when the user does not allow it', async () => {
        expect.assertions(3);

        const userData = {
            email: validEmail,
            password: validHashedPassword,
            settings: {
                loginActivitySettings: {
                    getIP: false
                }
            }
        }

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(response.statusCode).toBe(200);
        expect(refreshToken.IP).toBe(undefined);
        expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
    })

    test('if IP is added to the RefreshToken document when the user allows it', async () => {
        expect.assertions(3);

        const userData = {
            email: validEmail,
            password: validHashedPassword,
            settings: {
                loginActivitySettings: {
                    getIP: true
                }
            }
        }

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(response.statusCode).toBe(200);
        expect(typeof refreshToken.IP).toBe('string')
        expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
    })

    test('if IP-derived location is not added to RefreshToken when the user does not allow it', async () => {
        expect.assertions(3);

        const userData = {
            email: validEmail,
            password: validHashedPassword,
            settings: {
                loginActivitySettings: {
                    getLocation: false
                }
            }
        }

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(response.statusCode).toBe(200);
        expect(refreshToken.location).toBe(undefined);
        expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
    })

    test('if IP-derived location is added to RefreshToken when the user allows it', async () => {
        expect.assertions(4);

        const userData = {
            email: validEmail,
            password: validHashedPassword,
            settings: {
                loginActivitySettings: {
                    getLocation: true
                }
            }
        }

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const response = await supertest(server)
        .post('/user/signin')
        .set('X-Forwarded-For', '1.1.1.1')
        .send({email: userData.email, password: validPassword})

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(response.statusCode).toBe(200);
        expect(refreshToken.location).toBeTruthy();
        expect(refreshToken.location).not.toBe('Unknown Location')
        expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
    })

    test('if IP-derived location is set to "Unknown Location" when the location cannot be found', async () => {
        expect.assertions(3);

        const userData = {
            email: validEmail,
            password: validHashedPassword,
            settings: {
                loginActivitySettings: {
                    getLocation: true
                }
            }
        }

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(response.statusCode).toBe(200);
        expect(refreshToken.location).toBe("Unknown Location");
        expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
    })

    test('if deviceType is not added to RefreshToken when the user does not allow it', async () => {
        expect.assertions(3);

        const userData = {
            email: validEmail,
            password: validHashedPassword,
            settings: {
                loginActivitySettings: {
                    getDeviceType: false
                }
            }
        }

        await new User(userData).save();

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(response.statusCode).toBe(200);
        expect(refreshToken.deviceType).toBe(undefined);
        expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
    })

    test('if deviceType is added to RefreshToken when the user allows it', async () => {
        expect.assertions(3);

        const userData = {
            email: validEmail,
            password: validHashedPassword,
            settings: {
                loginActivitySettings: {
                    getDeviceType: true
                }
            }
        }

        await new User(userData).save();

        await DB.takeDBSnapshot();

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(response.statusCode).toBe(200);
        expect(refreshToken.deviceType).toBeTruthy();
        expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
    })

    test('if already existing RefreshToken documents do not get modified', async () => {
        expect.assertions(3);

        const tokensToInsert = [...new Array(10)].map(() => {
            return {
                encryptedRefreshToken: 'encrypted',
                location: 'location',
                deviceType: 'device',
                IP: 'IP',
                createdAt: new Date(),
                userId: new mongoose.Types.ObjectId(),
                admin: Math.random() > 0.5,
                notificationKey: 'notification key',
                __v: 0,
                _id: new mongoose.Types.ObjectId()
            }
        })

        await new User(userData).save();
        await RefreshToken.insertMany(tokensToInsert);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const refreshTokens = await RefreshToken.find({_id: {$ne: response.body.refreshTokenId}}).lean();

        expect(response.statusCode).toBe(200);
        expect(refreshTokens).toStrictEqual(tokensToInsert);
        expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
    })

    test('if already existing User documents do not get modified', async () => {
        expect.assertions(3);

        const usersToInsert = [...new Array(10)].map((itme, index) => {
            return {
                _id: new mongoose.Types.ObjectId(),
                secondId: uuidv4(),
                name: `sebastian${index}`,
                displayName: 'Sebastian',
                __v: 0
            }
        })

        await new User(userData).save();
        await User.insertMany(usersToInsert);

        await DB.takeDBSnapshot()

        const beforeUsers = await User.find({}).lean();

        const response = await supertest(server)
        .post('/user/signin')
        .send({email: userData.email, password: validPassword})

        const afterUsers = await User.find({}).lean();

        expect(response.statusCode).toBe(200);
        expect(beforeUsers).toStrictEqual(afterUsers)
        expect(await DB.changedCollections()).toIncludeSameMembers(['RefreshToken'])
    })
})