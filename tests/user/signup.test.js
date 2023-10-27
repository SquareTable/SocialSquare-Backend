const MockMongoDBServer = require('../../libraries/MockDBServer');
const mongoose = require('mongoose');


const User = require('../../models/User');
const UserController = require('../../controllers/User');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const {expect} = require('@jest/globals');

const INVALID_NAMES = ["abc12!", "abc._.abc", "abc!@#$%^&*()", "(", ")", "$%^&*wegyf"]

const validName = "Sebastian";
const validEmail = "johnsullivan@gmail.com";
const validPassword = "password";
const validIP = "127.0.0.1";
const validDeviceName = "GitHub-Actions"


/*
TODO:
Test if signup fails if name is not a string -- Done
Test if signup fails if name is an empty string -- Done
Test if signup fails if name is not only alphanumeric characters
Test if signup fails if name is more than 20 characters
test if signup fails if email is not a string -- Done
Test if signup fails if email is an empty string -- Done
Test if signup fails when email is not valid (give a list of invalid emails to test against)
Test if signup fails when password is not a string -- Done
Test if signup fails when password is an empty string -- Done
Test if signup fails if password is less than 8 characters
Test if signup fails if password is more than 17 characters
Test if signup fails if a user with the same email already exists
Test if signup fails if a user with the same username already exists



Test if user gets made successfully
    - Badge added
    - Password is hashed
    - Password can be verified with bcrypt
    - Test JWT token gets generated and is correct and usable
    - Test JWT refresh token gets generated and is correct and usable
    - Test encrypted refresh token gets generated and can be turned back into regular refresh tokens
    - Test refresh token gets made successfully (with admin set to false)
    - Test API returns correct token, refresh token, and refreshTokenId
    - Test API returns correct user data

Test that user creation does not modify other users in the database
*/

for (const invalidName of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If signup fails if name is not a string. Testing: ${JSON.stringify(invalidName)}`, async () => {
        expect.assertions(2);

        const returned = await UserController.signup(invalidName, validEmail, validPassword, validIP, validDeviceName);
        
        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`name must be a string. Provided type: ${typeof invalidName}`);
    })
}

for (const invalidEmail of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If signup fails if email is not a string. Testing: ${JSON.stringify(invalidEmail)}`, async () => {
        expect.assertions(2);

        const returned = await UserController.signup(validName, invalidEmail, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`email must be a string. Provided type: ${typeof invalidEmail}`);
    })
}

for (const invalidPassword of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If signup fails if password is not a string. Testing: ${JSON.stringify(invalidPassword)}`, async () => {
        expect.assertions(2);

        const returned = await UserController.signup(validName, validEmail, invalidPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`password must be a string. Provided type: ${typeof invalidPassword}`);
    })
}

test('If signup fails if name is an empty string', async () => {
    expect.assertions(2);

    const returned = await UserController.signup('', validEmail, invalidPassword, validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Name input field cannot be empty!");
})

test('If signup fails if email is an empty string', async () => {
    expect.assertions(2);

    const returned = await UserController.signup(validName, '', validPassword, validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Email input field cannot be empty!");
})

test('If signup fails if password is an empty string', async () => {
    expect.assertions(2);

    const returned = await UserController.signup(validName, validEmail, '', validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Password field cannot be empty!")
})