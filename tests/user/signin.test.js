const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const MockMongoDBServer = require('../../libraries/MockDBServer');

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');

const UserController = require('../../controllers/User');

const {expect, describe} = require('@jest/globals');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const validEmail = "john.sullivan@gmail.com";
const validPassword = "securepassword";
const validIP = "127.0.0.1";
const validDeviceName = "GitHub-Actions"

/*
TODO:
Test if signin fails if email is not a string -- Done
Test if signin fails if password is not a string -- Done
Test if signin fails if email is an empty string -- Done
Test if signin fails if password is an empty string -- Done
Test if signin fails if user with specified email could not be found -- Done
Test if signin fails if password is wrong (testing if user/signin carries out correct authentication) -- Done

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
    - Test if IP is added to RefreshToken ONLY IF THE USER ALLOWS IT
    - Test if IP-derived location is added to RefreshToken ONLY IF THE USER ALLOWS IT
    - Test if device name is added to RefreshToken ONLY IF THE USER ALLOWS IT
    - Test if correct user data gets returned
    - Test if already existing RefreshToken documents do not get modified
    - Test if already existing User documents do not get modified
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

    const DB = new MockMongoDBServer();
    const uri = await DB.startServer();

    await mongoose.connect(uri);

    const returned = await UserController.signin(validEmail, validPassword, validIP, validDeviceName);

    await mongoose.disconnect();
    await DB.stopServer();

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe("A user with the specified email does not exist.")
})

test('If signin fails if password is wrong', async () => {
    expect.assertions(6);

    const DB = new MockMongoDBServer();
    const uri = await DB.startServer();

    await mongoose.connect(uri);

    const userData = {
        email: validEmail,
        password: bcrypt.hashSync(validPassword, 12)
    }

    await new User(userData).save();

    const returned = await UserController.signin(userData.email, 'wrongpassword', validIP, validDeviceName);

    await mongoose.disconnect();
    await DB.stopServer();

    expect(returned.statusCode).toBe(401);
    expect(returned.data.message).toBe("Invalid password entered!");
    expect(returned.data.data).toBe(undefined);
    expect(returned.data.token).toBe(undefined);
    expect(returned.data.refreshToken).toBe(undefined);
    expect(returned.data.refreshTokenId).toBe(undefined);
})