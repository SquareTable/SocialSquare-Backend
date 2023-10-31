const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {v4: uuidv4} = require('uuid');

const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const TempController = require('../../controllers/Temp');

const {expect, beforeEach, afterEach, test} = require('@jest/globals');

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.stopTest();
})

const validEmail = "john.sullivan@gmail.com";
const validPassword = "securepassword";
const validIP = "127.0.0.1";
const validDeviceName = "GitHub-Actions";

const newPassword = 'mynewpassword';

const validHashedPassword = "$2b$10$34gQut./qmo7HoG1aKkQeOQWeZzCjwwMMgk8nsLpwb3snlKK0wRKy";

const userData = {
    _id: new mongoose.Types.ObjectId(),
    secondId: uuidv4(),
    email: validEmail,
    password: validHashedPassword
}

/*
TODO:
Test if change fails if userId is not a string -- Done
Test if change fails if userId is not an objectId -- Done
Test if change fails if currentPassword is not a string -- Done
Test if change fails if newPassword is not a string -- Done
Test if change fails if confirmNewPassword is not a string -- Done
Test if change fails if newPassword is less than 8 characters -- Done
Test if change fails if newPassword is more than 17 characters -- Done
Test if change fails if newPassword and confirmNewPassword are not the same -- Done
Test if change fails if user with userId cannot be found -- Done
Test if change fails if currentPassword is wrong
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
*/

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If change fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.changepassword(notString, validPassword, newPassword, newPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
    })

    test(`If change fails if currentPassword is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.changepassword(String(userData._id), notString, newPassword, newPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`currentPassword must be a string. Type provided: ${typeof notString}`)
    })

    test(`If change fails if newPassword is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.changepassword(String(userData._id), validPassword, notString, newPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`newPassword must be a string. Type provided: ${typeof notString}`);
    })

    test(`If change fails if confirmNewPassword is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.changepassword(String(userData._id), validPassword, newPassword, notString, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`confirmNewPassword must be a string. Type provided: ${typeof notString}`)
    })
}

test('If change fails if userId is not an objectId', async () => {
    expect.assertions(2);

    const returned = await TempController.changepassword('i am not an objectid', validPassword, newPassword, newPassword, validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userId must be an objectId.')
})

test('If change fails if newPassword is less than 8 characters', async () => {
    expect.assertions(2);

    const returned = await TempController.changepassword(String(userData._id), validPassword, 'short', 'short', validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Your new password must be 8 or more characters.')
})

test('If change fails if newPassword is more than 17 characters', async () => {
    expect.assertions(2);

    const returned = await TempController.changepassword(String(userData._id), validPassword, 'thisis18characters', 'thisis18characters', validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Your new password must be 17 or less characters.')
})

test('If change fails if newPassword and confirmNewPassword are not the same', async () => {
    expect.assertions(2);

    const returned = await TempController.changepassword(String(userData._id), validPassword, 'thesearenot', 'thesamepasswords', validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Passwords do not match')
})

test('If change fails if user with userId could not be found', async () => {
    expect.assertions(2);

    const returned = await TempController.changepassword(String(userData._id), validPassword, newPassword, newPassword, validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('User with provided userId could not be found.')
})