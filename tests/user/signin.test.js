const mongoose = require('mongoose');
const MockMongoDBServer = require('../../libraries/MockDBServer');

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');

const UserController = require('../../controllers/User');

const {expect} = require('@jest/globals');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const validEmail = "john.sullivan@gmail.com";
const validPassword = "securepassword";
const validIP = "127.0.0.1";
const validDeviceName = "GitHub-Actions"

/*
TODO:
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
    - Test if IP is added to RefreshToken ONLY IF THE USER ALLOWS IT
    - Test if IP-derived location is added to RefreshToken ONLY IF THE USER ALLOWS IT
    - Test if device name is added to RefreshToken ONLY IF THE USER ALLOWS IT
    - Test if correct user data gets returned
    - Test if already existing RefreshToken documents do not get modified
    - Test if already existing User documents do not get modified
*/

for (const invalidEmail of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If signin fails if email is not a string. Testing: ${JSON.stringify(invalidEmail)}`, async () => {
        const returned = await UserController.signin(invalidEmail, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`email must be a string. Provided type: ${typeof invalidEmail}`)
    })
}