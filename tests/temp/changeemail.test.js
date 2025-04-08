const mongoose = require('mongoose');
const User = require('../../models/User');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const {expect, afterEach, beforeAll, afterAll} = require('@jest/globals');
const {v4: uuidv4} = require('uuid');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const server = require('../../server')
const supertest = require('supertest')
const jwt = require('jsonwebtoken')

const DB = new MockMongoDBServer();

beforeAll(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.purgeData()
})

afterAll(async () => {
    await DB.stopTest()
})

const validEmail = 'john.sullivan@gmail.com';
const validPassword = 'securepassword';
const validHashedPassword = '$2b$10$ozCqAdz.IJrSpmEQ8FLn6e3JNytSmfMmU8sU9nk.WhobtLoX6mMf2';

const userData = {
    _id: new mongoose.Types.ObjectId(),
    secondId: uuidv4(),
    name: 'sebastian',
    displayName: 'Sebastian',
    email: 'myemail@gmail.com',
    password: validHashedPassword
}

const validToken = 'Bearer ' + jwt.sign({_id: userData._id}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

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

async function validChangeEmail() {
    return await supertest(server)
    .post('/tempRoute/changeemail')
    .set('auth-web-token', validToken)
    .send({desiredEmail: validEmail, password: validPassword})
}

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If change fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await new User(userData).save();

        await DB.takeDBSnapshot()

        const invalidToken = 'Bearer ' + jwt.sign({_id: notString}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

        const response = await supertest(server)
        .post('/tempRoute/changeemail')
        .set('auth-web-token', invalidToken)
        .send({desiredEmail: validEmail, password: validPassword})
        
        expect(response.body.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
        expect(response.statusCode).toBe(400);
        expect(await DB.noChangesMade()).toBe(true)
    })

    test(`If change fails if password is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await new User(userData).save();

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/changeemail')
        .set('auth-web-token', validToken)
        .send({desiredEmail: validEmail, password: notString})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`password must be a string. Type provided: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })

    test(`If change fails if desiredEmail is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await new User(userData).save();

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/changeemail')
        .set('auth-web-token', validToken)
        .send({desiredEmail: notString, password: validPassword})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`desiredEmail must be a string. Type provided: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test('If change fails if userId is not an ObjectId', async () => {
    expect.assertions(3);

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const invalidToken = 'Bearer ' + jwt.sign({_id: 'notanobjectid'}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

    const response = await supertest(server)
    .post('/tempRoute/changeemail')
    .set('auth-web-token', invalidToken)
    .send({desiredEmail: validEmail, password: validPassword})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('userId must be an ObjectId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if password is an empty string', async () => {
    expect.assertions(3);

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changeemail')
    .set('auth-web-token', validToken)
    .send({password: '', desiredEmail: validEmail})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Password cannot be blank.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('if change fails if desiredEmail is an empty string', async () => {
    expect.assertions(3);

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changeemail')
    .set('auth-web-token', validToken)
    .send({desiredEmail: '', password: validPassword})
    
    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Desired email cannot be blank.')
    expect(await DB.noChangesMade()).toBe(true)
})

for (const invalidEmail of TEST_CONSTANTS.INVALID_EMAILS) {
    test(`If change fails if desiredEmail does not pass the email validity test. Testing: ${invalidEmail}`, async () => {
        expect.assertions(3);

        await new User(userData).save();

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/changeemail')
        .set('auth-web-token', validToken)
        .send({desiredEmail: invalidEmail, password: validPassword})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe('Invalid desired email entered')
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test('If change fails if user with userId cannot be found', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changeemail')
    .set('auth-web-token', validToken)
    .send({desiredEmail: validEmail, password: validPassword})

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Could not find user with provided userId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if user with desired email already exists', async () => {
    expect.assertions(3);

    const newUserData = {
        _id: new mongoose.Types.ObjectId(),
        secondId: uuidv4(),
        name: 'sebastian2',
        displayName: 'SebastianTwo',
        email: 'alreadytaken@gmail.com'
    }

    await new User(userData).save();
    await new User(newUserData).save();

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changeemail')
    .set('auth-web-token', validToken)
    .send({desiredEmail: newUserData.email, password: validPassword})

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('User with the desired email already exists')
    expect(await DB.noChangesMade()).toBe(true)
})

test('if change fails if password is wrong', async () => {
    expect.assertions(3);

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/changeemail')
    .set('auth-web-token', validToken)
    .send({desiredEmail: validEmail, password: 'notmypassword'})

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Wrong password entered!')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change is successful when inputs are correct', async () => {
    expect.assertions(3);

    await new User(userData).save();

    await DB.takeDBSnapshot()

    const beforeUser = await User.findOne({}).lean();

    const response = await validChangeEmail()

    const afterUser = await User.findOne({}).lean();

    beforeUser.email = validEmail

    expect(response.statusCode).toBe(200);
    expect(afterUser).toStrictEqual(beforeUser)
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})

test('If change does not modify other User documents', async () => {
    expect.assertions(3);

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

    await DB.takeDBSnapshot()

    const response = await validChangeEmail()

    const afterUsers = await User.find({_id: {$ne: userData._id}}).lean();

    expect(response.statusCode).toBe(200);
    expect(beforeUsers).toStrictEqual(afterUsers);
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})