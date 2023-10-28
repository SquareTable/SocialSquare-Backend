require('dotenv').config({path: '../.env'})
const MockMongoDBServer = require('../../libraries/MockDBServer');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {v4: uuidv4} = require('uuid');
const jwt = require('jsonwebtoken');


const User = require('../../models/User');
const UserController = require('../../controllers/User');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const {expect} = require('@jest/globals');
const { refreshTokenDecryption } = require('../../middleware/TokenHandler');
const RefreshToken = require('../../models/RefreshToken');

const INVALID_NAMES = ["abc12!", "abc._.abc", "abc!@#$%^&*()", "(", ")", "$%^&*wegyf"]
const INVALID_EMAILS = ["notanemail", "notanemail@gmail.notanemail"]

const VALID_EMAILS = ["john.sullivan@gmail.com", "john.sullivan@hotmail.com", "john.sullivan123@gmail.com", "mytestemail@gmail.com", "mytestemail@hotmail.com", "myyahooemail@yahoo.com"];

const validName = "sebastian";
const validEmail = "johnsullivan@gmail.com";
const validPassword = "password";
const validIP = "127.0.0.1";
const validDeviceName = "GitHub-Actions"

jest.setTimeout(20_000); //20 seconds per test


/*
Tests:
Test if signup fails if name is not a string
Test if signup fails if name is an empty string
Test if signup fails if name is not only alphanumeric characters
Test if signup fails if name is more than 20 characters
test if signup fails if email is not a string
Test if signup fails if email is an empty string
Test if signup fails when email is not valid
Test if signup fails when password is not a string
Test if signup fails when password is an empty string
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

    const returned = await UserController.signup('', validEmail, validPassword, validIP, validDeviceName);

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
    expect(returned.data.message).toBe("Password input field cannot be empty!")
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

    const returned = await UserController.signup('thisis21characters111', validEmail, validPassword, validIP, validDeviceName);

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

for (const validUserEmail of VALID_EMAILS) {
    test(`if user account creation is successful with correct inputs. Email tested: ${validUserEmail}`, async () => {
        expect.assertions(18);
    
        const DB = new MockMongoDBServer();
        const uri = await DB.startServer();
    
        await mongoose.connect(uri);
    
        const benchmarkUserData = {
            name: validName,
            email: validUserEmail,
            password: 'nonsecurepassword',
            _id: new mongoose.Types.ObjectId(),
            __v: 0
        }
    
        await new User(benchmarkUserData).save();
    
        const benchmarkUser = {...await User.findOne({}).lean()};
        await User.deleteMany({});
    
        const returned = await UserController.signup(validName, validUserEmail, benchmarkUserData.password, validIP, validDeviceName);
    
        const savedUsers = await User.find({}).lean();
        const savedRefreshTokens = await RefreshToken.find({}).lean();
    
        const savedUser = savedUsers[0];
        const savedRefreshToken = savedRefreshTokens[0];
    
        benchmarkUser.password = savedUser;
    
        const JWTVerifier = (secret, token) => {
            return new Promise(resolve => {
                jwt.verify(token, secret, (err, decoded) => {
                    if (err) return resolve(false);
                    if (decoded) return resolve(true);
                    resolve(false);
                })
            })
        }
    
        const notIncludedKeys = [
            'notificationKeys',
            'password',
            'refreshTokens',
            'algorithmData',
            'accountFollowRequests',
            'blockedAccounts',
            'authenticationFactorsEnabled',
            'MFAEmail',
            'followers',
            'following'
        ]
        let includesNotIncludedKey = false;
        const returnedUserDataKeys = Object.keys(returned.data.data)
    
        for (const key of notIncludedKeys) {
            if (returnedUserDataKeys.includes(key)) {
                includesNotIncludedKey = true;
                break;
            }
        }
    
        await mongoose.disconnect();
        await DB.stopServer();
    
        expect(returned.statusCode).toBe(200);
        expect(bcrypt.compareSync(benchmarkUserData.password, savedUser.password)).toBe(true);
        expect(savedUser.badges).toHaveLength(1);
        expect(savedUser.badges[0].badgeName).toBe("onSignUpBadge")
        expect(savedUser.badges[0].dateRecieved).toBeGreaterThan(Date.now() - 100_000) //Gives 100 second range for test
        expect(JWTVerifier(process.env.SECRET_FOR_TOKENS, returned.data.token.replace('Bearer ', ''))).resolves.toBe(true);
        expect(JWTVerifier(process.env.SECRET_FOR_REFRESH_TOKENS, returned.data.refreshToken.replace('Bearer ', ''))).resolves.toBe(true)
        expect(savedUser).toStrictEqual(benchmarkUser);
        expect(savedUsers).toHaveLength(1);
        expect(savedRefreshTokens).toHaveLength(1);
        expect(savedRefreshToken.userId).toBe(benchmarkUserData._id)
        expect(savedRefreshToken.admin).toBe(false)
        expect(refreshTokenDecryption(savedRefreshToken.encryptedRefreshToken)).toBe(returned.refreshToken)
        expect(returned.refreshTokenId).toBe(String(savedRefreshToken._id))
        expect(includesNotIncludedKey).toBe(false);
        expect(typeof returned.data.data.followers).toBe("number");
        expect(typeof returned.data.data.following).toBe("number");
        expect(typeof returned.data.data._id).toBe("string");
    })
}

test('user creation does not modify other users in the database', async () => {
    expect.assertions(2);

    const DB = new MockMongoDBServer();
    const uri = await DB.startServer();

    await mongoose.connect(uri);

    const users = [...new Array(10)].map((item, index) => {
        return {
            _id: new mongoose.Types.ObjectId(),
            name: 'name' + index,
            displayName: 'displayname' + index,
            secondId: uuidv4()
        }
    })

    await User.insertMany(users);

    const dbUsers = await User.find({}).lean();

    const returned = await UserController.signup(validName, validEmail, validPassword, validIP, validDeviceName);

    const savedUsers = await User.find({email: {$ne: validEmail}}).lean();

    await mongoose.disconnect();
    await DB.stopServer();

    expect(returned.statusCode).toBe(200);
    expect(dbUsers).toStrictEqual(savedUsers);
})