const MockMongoDBServer = require('../../libraries/MockDBServer');
const mongoose = require('mongoose');


const User = require('../../models/User');
const UserController = require('../../controllers/User');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const {expect} = require('@jest/globals');

const INVALID_NAMES = ["abc12!", "abc._.abc", "abc!@#$%^&*()", "(", ")", "$%^&*wegyf"]
const INVALID_EMAILS = ["notanemail", "notanemail@gmail.com.com", "notanemail@gmail.notanemail"]

const VALID_EMAILS = ["john.sullivan@gmail.com", "john.sullivan@hotmail.com", "john.sullivan123@gmail.com", "mytestemail@gmail.com", "mytestemail@hotmail.com", "myyahooemail@yahoo.com"];

const validName = "sebastian";
const validEmail = "johnsullivan@gmail.com";
const validPassword = "password";
const validIP = "127.0.0.1";
const validDeviceName = "GitHub-Actions"


/*
TODO:
Test if signup fails if name is not a string -- Done
Test if signup fails if name is an empty string -- Done
Test if signup fails if name is not only alphanumeric characters -- Done
Test if signup fails if name is more than 20 characters -- Done
test if signup fails if email is not a string -- Done
Test if signup fails if email is an empty string -- Done
Test if signup fails when email is not valid -- Done
Test if signup fails when password is not a string -- Done
Test if signup fails when password is an empty string -- Done
Test if signup fails if password is less than 8 characters -- Done
Test if signup fails if password is more than 17 characters -- Done
Test if signup fails if a user with the same email already exists -- Done
Test if signup fails if a user with the same username already exists -- Done



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

for (const invalidName of INVALID_NAMES) {
    test(`If signup fails when username is an invalid username. Testing: ${JSON.stringify(invalidName)}`, async () => {
        expect.assertions(2);

        const returned = await UserController.signup(invalidName, validEmail, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe("Invalid name entered")
    })
}

for (const invalidEmail of INVALID_EMAILS) {
    test(`If signup fails when email is an invalid email. Testing: ${invalidEmail}`, async () => {
        expect.assertions(2);

        const returned = await UserController.signup(validName, invalidEmail, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe("Invalid email entered")
    })
}

test('If signup fails if password is less than 8 characters long', async () => {
    expect.assertions(2);

    const returned = await UserController.signup(validName, validEmail, '6chars', validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Password is too short! Password must be 8 characters or longer")
})

test('if signup fails if name is longer than 20 characters', async () => {
    expect.assertions(2);

    const returned = await UserController.signup('this is 21 characters', validEmail, validPassword, validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Username is too long! Please keep your username at 20 characters or less.")
})

test('if signup fails if password is longer than 17 characters (due to bcrypt limitations)', async () => {
    expect.assertions(2);

    const returned = await UserController.signup(validName, validEmail, 'this is 18 chars..', validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Password is too long! Due to current limitations, please keep your password at 17 or less characters.")
})

test('if signup fails if a user with the same email already exists', async () => {
    expect.assertions(3);

    const DB = new MockMongoDBServer();
    const uri = await DB.startServer();

    await mongoose.connect(uri);

    const existingUserData = {
        _id: new mongoose.Types.ObjectId(),
        email: 'myemail@email.com'
    }

    await new User(existingUserData).save();

    const returned = await UserController.signup(validName, existingUserData.email, validPassword, validIP, validDeviceName);

    const users = await User.find({}).lean();

    await mongoose.disconnect();
    await DB.stopServer();

    expect(users).toHaveLength(1);
    expect(returned.statusCode).toBe(409);
    expect(returned.data.message).toBe("User with the provided email already exists.")
})

test('if signup fails if a user with the same name already exists', async () => {
    expect.assertions(3);

    const DB = new MockMongoDBServer();
    const uri = await DB.startServer();

    await mongoose.connect(uri);

    const existingUserData = {
        _id: new mongoose.Types.ObjectId(),
        name: validName
    }

    await new User(existingUserData).save();

    const returned = await UserController.signup(existingUserData.name, validEmail, validPassword, validIP, validDeviceName);

    const users = await User.find({}).lean();

    await mongoose.disconnect();
    await DB.stopServer();

    expect(users).toHaveLength(1);
    expect(returned.statusCode).toBe(409);
    expect(returned.data.message).toBe("User with the provided username already exists")
})