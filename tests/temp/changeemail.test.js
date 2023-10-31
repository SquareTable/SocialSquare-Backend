const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const TempController = require('../../controllers/Temp');
const User = require('../../models/User');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const {expect, test, beforeEach, afterEach} = require('@jest/globals');
const {v4: uuidv4} = require('uuid');
const MockMongoDBServer = require('../../libraries/MockDBServer');

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.stopTest();
})

const validEmail = 'john.sullivan@gmail.com';
const validPassword = 'mypassword';
const validHashedPassword = '$2y$10$lIUHn3yo0uF05O.RA38QSOdqF270MQboayDZHifGm/jN1iJy.Tvna';

const userData = {
    _id: new mongoose.Types.ObjectId(),
    secondId: uuidv4(),
    name: 'sebastian',
    displayName: 'Sebastian',
    email: 'myemail@gmail.com',
    password: validHashedPassword
}

/*
Tests:
Test if change fails if userId is not a string
Test if change fails if userId is not an objectId
Test if change fails if password is not a string
Test if change fails if password is an empty string
Test if change fails if desiredEmail is not a string
Test if change fails if desiredEmail is an empty string
Test if change fails if desiredEmail does not pass the valid email test
Test if change fails if user with userId could not be found
Test if change fails if there is already a user with the desired email
test if change fails if password is wrong
Test if change is successful when inputs are correct
Test if change does not modify other User documents
*/

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If change fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await TempController.changeemail(notString, validPassword, validEmail);
        
        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
    })

    test(`If change fails if password is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await TempController.changeemail(String(userData._id), notString, validEmail);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`password must be a string. Type provided: ${typeof notString}`)
    })

    test(`If change fails if desiredEmail is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await TempController.changeemail(String(userData._id), validPassword, notString);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`desiredEmail must be a string. Type provided: ${typeof notString}`)
    })
}

test('If change fails if userId is not an objectId', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const returned = await TempController.changeemail('i am not an objectId', validPassword, validEmail);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userId must be an objectId.')
})

test('If change fails if password is an empty string', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const returned = await TempController.changeemail(String(userData._id), '', validEmail);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Password cannot be blank.')
})

test('if change fails if desiredEmail is an empty string', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const returned = await TempController.changeemail(String(userData._id), validPassword, '');
    
    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Desired email cannot be blank.')
})

for (const invalidEmail of TEST_CONSTANTS.INVALID_EMAILS) {
    test(`If change fails if desiredEmail does not pass the email validity test. Testing: ${invalidEmail}`, async () => {
        expect.assertions(2);

        await new User(userData).save();

        const returned = await TempController.changeemail(String(userData._id), validPassword, invalidEmail);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe('Invalid desired email entered')
    })
}

test('If change fails if user with userId cannot be found', async () => {
    expect.assertions(2);

    const returned = await TempController.changeemail(String(userData._id), validPassword, validEmail)

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user with provided userId.')
})

test('If change fails if user with desired email already exists', async () => {
    expect.assertions(2);

    const newUserData = {
        _id: new mongoose.Types.ObjectId(),
        secondId: uuidv4(),
        name: 'sebastian2',
        displayName: 'SebastianTwo',
        email: 'alreadytaken@gmail.com'
    }

    await new User(userData).save();
    await new User(newUserData).save();

    const returned = await TempController.changeemail(String(userData._id), validPassword, newUserData.email);

    expect(returned.statusCode).toBe(403);
    expect(returned.data.message).toBe('User with the desired email already exists')
})

test('if change fails if password is wrong', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const returned = await TempController.changeemail(String(userData._id), 'notmypassword', validEmail);

    expect(returned.stautsCode).toBe(401);
    expect(returned.data.message).toBe('Wrong password entered!')
})

test('If change is successful when inputs are correct', async () => {
    expect.assertions(2);

    await new User(userData).save();

    const returned = await TempController.changeemail(String(userData._id), validPassword, validEmail);

    const afterUser = await User.findOne({}).lean();

    expect(returned.statusCode).toBe(200);
    expect(afterUser.email).toBe(validEmail);
})

test('If change does not modify other User documents', async () => {
    expect.assertions(2);

    const usersToInsert = [...new Array(10)].map((item, index) => {
        return {
            _id: new mongoose.Types.ObjectId(),
            secondId: uuidv4(),
            name: 'name' + index,
            displayName: 'displayname' + index,
            email: `email${index}@gmail.com`
        }
    })

    await User.insertMany(usersToInsert);

    const beforeUsers = await User.find({}).lean();

    await new User(userData).save();

    const returned = await TempController.changeemail(String(userData._id), validPassword, validEmail);

    const afterUsers = await User.find({_id: {$ne: userData._id}}).lean();

    expect(returned.statusCode).toBe(200);
    expect(beforeUsers).toStrictEqual(afterUsers);
})