const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {v4: uuidv4} = require('uuid');
const jwt = require('jsonwebtoken')
const MockMongoDBServer = require('../../libraries/MockDBServer');

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const EmailVerificationCode = require('../../models/EmailVerificationCode');

const UserController = require('../../controllers/User');

const {expect, describe, beforeEach, afterEach} = require('@jest/globals');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const { refreshTokenDecryption } = require('../../middleware/TokenHandler');

const validEmail = "john.sullivan@gmail.com";
const validPassword = "securepassword";
const validIP = "127.0.0.1";
const validDeviceName = "GitHub-Actions";

const validHashedPassword = "$2b$10$34gQut./qmo7HoG1aKkQeOQWeZzCjwwMMgk8nsLpwb3snlKK0wRKy";

jest.setTimeout(20_000); //20 seconds per test

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest();
})

afterEach(async () => {
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
    - Test if email gets blurred -- Done
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
        expect.assertions(2);

        const returned = await UserController.signin(notString, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`email must be a string. Provided type: ${typeof notString}`)
    })

    test(`If signin fails if password is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await UserController.signin(validEmail, notString, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`password must be a string. Provided type: ${typeof notString}`)
    })
}

test(`If signin fails if email is an empty string`, async () => {
    expect.assertions(2);

    const returned = await UserController.signin('', validPassword, validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Email cannot be blank')
})

test('If signin fails if password is an empty string', async () => {
    expect.assertions(2);

    const returned = await UserController.signin(validEmail, '', validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Password cannot be blank")
})

test('If signin fails if user with specified email could not be found', async () => {
    expect.assertions(2);

    const returned = await UserController.signin(validEmail, validPassword, validIP, validDeviceName);

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe("A user with the specified email does not exist.")
})

test('If signin fails if password is wrong', async () => {
    expect.assertions(6);

    const userData = {
        email: validEmail,
        password: bcrypt.hashSync(validPassword, 12)
    }

    await new User(userData).save();

    const returned = await UserController.signin(userData.email, 'wrongpassword', validIP, validDeviceName);

    expect(returned.statusCode).toBe(401);
    expect(returned.data.message).toBe("Invalid password entered!");
    expect(returned.data.data).toBe(undefined);
    expect(returned.data.token).toBe(undefined);
    expect(returned.data.refreshToken).toBe(undefined);
    expect(returned.data.refreshTokenId).toBe(undefined);
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
        expect.assertions(2);

        await new User(userData).save();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(200);
        expect(returned.data.data.email).toBe("jo**.s**li**n@g**il.com")
    })

    test('if fromAddress is the value of process.env.SMTP_EMAIL', async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(200);
        expect(returned.data.data.fromAddress).toBe(process.env.SMTP_EMAIL)
    })

    test("if returned secondId is the same as the user's secondId", async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(200);
        expect(returned.data.data.secondId).toBe(userData.secondId)
    })

    test('that email verification code gets created', async () => {
        expect.assertions(5);

        await new User(userData).save();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const EmailVerificationCodes = await EmailVerificationCode.find({}).lean();

        const verificationCode = EmailVerificationCodes[0];

        expect(returned.statusCode).toBe(200);
        expect(EmailVerificationCodes).toHaveLength(1);
        expect(String(verificationCode.userId)).toBe(String(userData._id))
        expect(typeof verificationCode.hashedVerificationCode).toBe('string');
        expect(new Date(verificationCode.createdAt).getTime()).toBeGreaterThan(Date.now() - 100_000) //Gives 100 second leeway
    })

    test('that login does not interfere with other email verification codes in the database', async () => {
        expect.assertions(2);

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

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const codesInDatabase = await EmailVerificationCode.find({hashedVerificationCode: 'hashed'}).lean();

        expect(returned.statusCode).toBe(200);
        expect(codesInDatabase).toStrictEqual(codesToInsert);
    })

    test('that there can only be one EmailVerificationCode document per user and the document gets updated for each new code', async () => {
        expect.assertions(5);

        await new User(userData).save();

        const returnedOne = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);
        const codesOne = await EmailVerificationCode.find({}).lean();
        const returnedTwo = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);
        const codesTwo = await EmailVerificationCode.find({}).lean();

        expect(returnedOne.statusCode).toBe(200);
        expect(returnedTwo.statusCode).toBe(200);
        expect(codesOne).toHaveLength(1);
        expect(codesTwo).toHaveLength(1);
        expect(codesOne[0].createdAt !== codesTwo[0].createdAt).toBe(true);
    })

    test('that a RefreshToken document is NOT made', async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const RefreshTokens = await RefreshToken.find({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(RefreshTokens).toHaveLength(0);
    })

    test('that the user document does not get modified', async () => {
        expect.assertions(2);

        await new User(userData).save();

        const user = await User.findOne({}).lean();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const userAfterSignin = await User.findOne({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(user).toStrictEqual(userAfterSignin);
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

    const JWTVerifier = (secret, token) => {
        return new Promise(resolve => {
            jwt.verify(token, secret, (err, decoded) => {
                if (err) return resolve(false);
                if (decoded) return resolve(true);
                resolve(false);
            })
        })
    }

    test('if token gets created and is usable', async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(200);
        expect(JWTVerifier(process.env.SECRET_FOR_TOKENS, returned.data.token.replace('Bearer ', ''))).resolves.toBe(true);
    })

    test('if refresh token gets created and is usable', async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(200);
        expect(JWTVerifier(process.env.SECRET_FOR_REFRESH_TOKENS, returned.data.refreshToken.replace('Bearer ', ''))).resolves.toBe(true);
    })

    test('if encrypted refresh token gets created and can be decrypted back to refresh token', async () => {
        expect.assertions(3);

        await new User(userData).save();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const refreshTokens = await RefreshToken.find({}).lean();

        const savedRefreshToken = refreshTokens[0];

        expect(returned.statusCode).toBe(200);
        expect(refreshTokens).toHaveLength(1);
        expect(refreshTokenDecryption(savedRefreshToken.encryptedRefreshToken)).toBe(returned.data.refreshToken.replace('Bearer ', ''))
    })

    test('if RefreshToken document gets created and admin is set to false', async () => {
        expect.assertions(3);

        await new User(userData).save();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(refreshToken.admin).toBe(false);
        expect(refreshToken.createdAt.getTime()).toBeGreaterThan(Date.now() - 100_000) //Gives 100 second leeway for test
    })

    test('if IP is not added to the RefreshToken document when the user does not allow it', async () => {
        expect.assertions(2);

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

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(refreshToken.IP).toBe(undefined);
    })

    test('if IP is added to the RefreshToken document when the user allows it', async () => {
        expect.assertions(2);

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

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(refreshToken.IP).toBe(validIP);
    })

    test('if IP-derived location is not added to RefreshToken when the user does not allow it', async () => {
        expect.assertions(2);

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

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(refreshToken.location).toBe(undefined);
    })

    test('if IP-derived location is added to RefreshToken when the user allows it', async () => {
        expect.assertions(2);

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

        const returned = await UserController.signin(userData.email, validPassword, '1.1.1.1', validDeviceName);

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(refreshToken.location).toBeTruthy();
    })

    test('if IP-derived location is set to "Unknown Location" when the location cannot be found', async () => {
        expect.assertions(2);

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

        const returned = await UserController.signin(userData.email, validPassword, '127.0.0.1', validDeviceName);

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(refreshToken.location).toBe("Unknown Location");
    })

    test('if deviceType is not added to RefreshToken when the user does not allow it', async () => {
        expect.assertions(2);

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

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(refreshToken.deviceType).toBe(undefined);
    })

    test('if deviceType is not added to RefreshToken when the user does not allow it', async () => {
        expect.assertions(2);

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

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const refreshToken = await RefreshToken.findOne({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(refreshToken.deviceType).toBe(validDeviceName);
    })

    test('if correct user data gets returned', async () => {
        expect.assertions(5);

        await new User(userData).save();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

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
        const returnedUserDataKeys = Object.keys(returned.data.data);

        for (const key of notIncludedKeys) {
            if (returnedUserDataKeys.includes(key)) {
                includesNotIncludedKey = true;
                break;
            }
        }

        expect(returned.statusCode).toBe(200);
        expect(includesNotIncludedKey).toBe(false);
        expect(typeof returned.data.data.followers).toBe("number");
        expect(typeof returned.data.data.following).toBe("number");
        expect(typeof returned.data.data._id).toBe("string");
    })

    test('if already existing RefreshToken documents do not get modified', async () => {
        expect.assertions(2);

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

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const refreshTokens = await RefreshToken.find({_id: {$ne: returned.data.refreshTokenId}}).lean();

        expect(returned.statusCode).toBe(200);
        expect(refreshTokens).toStrictEqual(tokensToInsert);
    })

    test('if already existing User documents do not get modified', async () => {
        expect.assertions(2);

        const usersToInsert = [...new Array(10)].map(() => {
            return {
                _id: new mongoose.Types.ObjectId(),
                secondId: uuidv4(),
                name: 'sebastian',
                displayName: 'Sebastian',
                __v: 0
            }
        })

        await new User(userData).save();
        await User.insertMany(usersToInsert);

        const beforeUsers = await User.find({}).lean();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const afterUsers = await User.find({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(beforeUsers).toStrictEqual(afterUsers)
    })

    test('that user document does not get modified', async () => {
        expect.assertions(2);

        await new User(userData).save();

        const beforeUser = await User.findOne({}).lean();

        const returned = await UserController.signin(userData.email, validPassword, validIP, validDeviceName);

        const afterUser = await User.findOne({}).lean();

        expect(returned.statusCode).toBe(200);
        expect(beforeUser).toStrictEqual(afterUser);
    })
})