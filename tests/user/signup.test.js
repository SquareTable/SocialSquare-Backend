require('dotenv').config({path: '../.env'})
const MockMongoDBServer = require('../../libraries/MockDBServer');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {v4: uuidv4} = require('uuid');
const jwt = require('jsonwebtoken');


const User = require('../../models/User');
const UserController = require('../../controllers/User');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const {expect, beforeEach, afterEach} = require('@jest/globals');
const { refreshTokenDecryption } = require('../../middleware/TokenHandler');
const RefreshToken = require('../../models/RefreshToken');
const CONSTANTS = require('../../constants');

const INVALID_NAMES = ["abc12!", "abc._.abc", "abc!@#$%^&*()", "(", ")", "$%^&*wegyf"]

const VALID_EMAILS = ["john.sullivan@gmail.com", "john.sullivan@hotmail.com", "john.sullivan123@gmail.com", "mytestemail@gmail.com", "mytestemail@hotmail.com", "myyahooemail@yahoo.com"];

const validName = "sebastian";
const validEmail = "johnsullivan@gmail.com";
const validPassword = "password";
const validIP = "127.0.0.1";
const validDeviceName = "GitHub-Actions"

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
        expect.assertions(3);

        await DB.takeDBSnapshot();

        const returned = await UserController.signup(invalidName, validEmail, validPassword, validIP, validDeviceName);
        
        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`name must be a string. Provided type: ${typeof invalidName}`);
        expect(DB.noChangesMade).resolves.toBe(true)
    })
}

for (const invalidEmail of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If signup fails if email is not a string. Testing: ${JSON.stringify(invalidEmail)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const returned = await UserController.signup(validName, invalidEmail, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`email must be a string. Provided type: ${typeof invalidEmail}`);
        expect(DB.noChangesMade).resolves.toBe(true)
    })
}

for (const invalidPassword of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If signup fails if password is not a string. Testing: ${JSON.stringify(invalidPassword)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const returned = await UserController.signup(validName, validEmail, invalidPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`password must be a string. Provided type: ${typeof invalidPassword}`);
        expect(DB.noChangesMade).resolves.toBe(true)
    })
}

test('If signup fails if name is an empty string', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await UserController.signup('', validEmail, validPassword, validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Name input field cannot be empty!");
    expect(DB.noChangesMade).resolves.toBe(true)
})

test('If signup fails if email is an empty string', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await UserController.signup(validName, '', validPassword, validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Email input field cannot be empty!");
    expect(DB.noChangesMade).resolves.toBe(true)
})

test('If signup fails if password is an empty string', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await UserController.signup(validName, validEmail, '', validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Password input field cannot be empty!")
    expect(DB.noChangesMade).resolves.toBe(true)
})

for (const invalidName of INVALID_NAMES) {
    test(`If signup fails when username is an invalid username. Testing: ${JSON.stringify(invalidName)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const returned = await UserController.signup(invalidName, validEmail, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(CONSTANTS.VALID_USERNAME_TEST_READABLE_REQUIREMENTS)
        expect(DB.noChangesMade).resolves.toBe(true)
    })
}

for (const invalidEmail of TEST_CONSTANTS.INVALID_EMAILS) {
    test(`If signup fails when email is an invalid email. Testing: ${invalidEmail}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const returned = await UserController.signup(validName, invalidEmail, validPassword, validIP, validDeviceName);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe("Invalid email entered")
        expect(DB.noChangesMade).resolves.toBe(true)
    })
}

test('If signup fails if password is less than 8 characters long', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await UserController.signup(validName, validEmail, '6chars', validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Password is too short! Password must be 8 characters or longer")
    expect(DB.noChangesMade).resolves.toBe(true)
})

test('if signup fails if name is longer than 20 characters', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await UserController.signup('thisis21characters111', validEmail, validPassword, validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Username is too long! Please keep your username at 20 characters or less.")
    expect(DB.noChangesMade).resolves.toBe(true)
})

test('if signup fails if password is longer than 17 characters (due to bcrypt limitations)', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await UserController.signup(validName, validEmail, 'this is 18 chars..', validIP, validDeviceName);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("Password is too long! Due to current limitations, please keep your password at 17 or less characters.")
    expect(DB.noChangesMade).resolves.toBe(true)
})

test('if signup fails if a user with the same email already exists', async () => {
    expect.assertions(4);

    const existingUserData = {
        _id: new mongoose.Types.ObjectId(),
        email: 'myemail@email.com'
    }

    await new User(existingUserData).save();

    await DB.takeDBSnapshot();

    const returned = await UserController.signup(validName, existingUserData.email, validPassword, validIP, validDeviceName);

    const users = await User.find({}).lean();

    expect(users).toHaveLength(1);
    expect(returned.statusCode).toBe(409);
    expect(returned.data.message).toBe("User with the provided email already exists.")
    expect(DB.noChangesMade).resolves.toBe(true)
})

test('if signup fails if a user with the same name already exists', async () => {
    expect.assertions(4);

    const existingUserData = {
        _id: new mongoose.Types.ObjectId(),
        name: validName
    }

    await new User(existingUserData).save();

    await DB.takeDBSnapshot();

    const returned = await UserController.signup(existingUserData.name, validEmail, validPassword, validIP, validDeviceName);

    const users = await User.find({}).lean();

    expect(users).toHaveLength(1);
    expect(returned.statusCode).toBe(409);
    expect(returned.data.message).toBe("User with the provided username already exists")
    expect(DB.noChangesMade).resolves.toBe(true)
})

for (const validUserEmail of VALID_EMAILS) {
    test(`if user account creation is successful with correct inputs. Email tested: ${validUserEmail}`, async () => {
        expect.assertions(24);
    
        const benchmarkUserData = {
            name: validName,
            email: validUserEmail,
            password: 'nonsecurepassword',
            _id: new mongoose.Types.ObjectId(),
            __v: 0,
            profileImageKey: "",
            displayName: ""
        }
    
        await new User(benchmarkUserData).save();
    
        const benchmarkUser = await User.findOne({}).lean();
        await User.deleteMany({});
    
        const returned = await UserController.signup(validName, validUserEmail, benchmarkUserData.password, validIP, validDeviceName);
    
        const savedUsers = await User.find({}).lean();
        const savedRefreshTokens = await RefreshToken.find({}).lean();
    
        const savedUser = savedUsers[0];
        const savedRefreshToken = savedRefreshTokens[0];

        const userIdIsObjectId = mongoose.isObjectIdOrHexString(savedUser._id)
        const splitSecondId = savedUser.secondId.split('-');
        const savedUserBadges = savedUser.badges;
        const savedUserId = savedUser._id;

        delete savedUser._id;
        delete savedUser.secondId;
        delete savedUser.badges;

        delete benchmarkUser.badges;
        delete benchmarkUser._id;
    
        benchmarkUser.password = savedUser.password;
    
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
        const returnedUserDataKeys = Object.keys(returned.data.data)
    
        for (const key of notIncludedKeys) {
            if (returnedUserDataKeys.includes(key)) {
                includesNotIncludedKey = true;
                break;
            }
        }
    
        expect(returned.statusCode).toBe(200);
        expect(bcrypt.compareSync(benchmarkUserData.password, savedUser.password)).toBe(true);
        expect(savedUserBadges).toHaveLength(1);
        expect(savedUserBadges[0].badgeName).toBe("onSignUpBadge")
        expect(savedUserBadges[0].dateRecieved).toBeGreaterThan(Date.now() - 100_000) //Gives 100 second range for test
        expect(TEST_CONSTANTS.JWTVerifier(process.env.SECRET_FOR_TOKENS, returned.data.token.replace('Bearer ', ''))).resolves.toBe(true);
        expect(TEST_CONSTANTS.JWTVerifier(process.env.SECRET_FOR_REFRESH_TOKENS, returned.data.refreshToken.replace('Bearer ', ''))).resolves.toBe(true)
        expect(userIdIsObjectId).toBe(true);

        //Make sure secondId (uuidv4) follows UUID format 8-4-4-4-12
        expect(splitSecondId[0]).toHaveLength(8);
        expect(splitSecondId[1]).toHaveLength(4);
        expect(splitSecondId[2]).toHaveLength(4);
        expect(splitSecondId[3]).toHaveLength(4);
        expect(splitSecondId[4]).toHaveLength(12);

        expect(savedUser).toStrictEqual(benchmarkUser);
        expect(savedUsers).toHaveLength(1);
        expect(savedRefreshTokens).toHaveLength(1);
        expect(String(savedRefreshToken.userId)).toBe(String(savedUserId));
        expect(savedRefreshToken.admin).toBe(false)
        expect(refreshTokenDecryption(savedRefreshToken.encryptedRefreshToken)).toBe(returned.data.refreshToken.replace('Bearer ', ''))
        expect(returned.data.refreshTokenId).toBe(String(savedRefreshToken._id))
        expect(includesNotIncludedKey).toBe(false);
        expect(typeof returned.data.data.followers).toBe("number");
        expect(typeof returned.data.data.following).toBe("number");
        expect(typeof returned.data.data._id).toBe("string");
    })
}

test('user creation does not modify other users in the database', async () => {
    expect.assertions(2);

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

    expect(returned.statusCode).toBe(200);
    expect(dbUsers).toStrictEqual(savedUsers);
})