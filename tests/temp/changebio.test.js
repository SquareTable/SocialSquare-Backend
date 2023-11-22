const User = require('../../models/User');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const TempController = require('../../controllers/Temp')

const {beforeEach, afterEach, test, expect} = require('@jest/globals');

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest();
})

afterEach(async () => {
    await DB.stopTest();
})

const validUser = {
    _id: '655e091738d16dd48778d1df',
    bio: 'Old bio'
}

const VALID_BIO = "my bio here";

/*
Tests:
- Test if change fails if userId is not a string
- Test if change fails if userId is not an ObjectId
- Test if change fails if bio is not a string
- Test if change fails if bio is longer than 250 characters
- Test if change fails if bio has more than 4 lines
- Test if change fails if user could not be found
- Test if change is successful with correct inputs
- Test if change does not interfere with other User documents
*/

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If change fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.changebio(notString, VALID_BIO);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
    })

    test(`If change fails if bio is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.changebio(validUser._id, notString);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`bio must be a string. Provided type: ${typeof notString}`)
    })
}

test('If change fails if userId is not an ObjectId', async () => {
    expect.assertions(2);

    const returned = await TempController.changebio('this is not an objectid', VALID_BIO);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userId must be an ObjectId.')
})

test('If change fails if bio is longer than 250 characters', async () => {
    expect.assertions(2);

    const returned = await TempController.changebio(validUser._id, new Array(252).join('a'));

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Bio must be 250 or less characters')
})

test('If change fails if bio has more than 4 lines', async () => {
    expect.assertions(2);

    const returned = await TempController.changebio(validUser._id, `

        this is more than 4 lines here

    `);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Bio must have 4 or less lines')
})

test('If change fails if user could not be found', async () => {
    expect.assertions(2);

    const returned = await TempController.changebio(validUser._id, VALID_BIO);

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('User with provided userId could not be found')
})

test('If change is successful with correct inputs', async () => {
    expect.assertions(3);

    await new User(validUser).save();

    const beforeUser = await User.findOne({_id: validUser._id});

    const returned = await TempController.changebio(validUser._id, VALID_BIO);

    const afterUser = await User.findOne({_id: validUser._id});

    beforeUser.bio = VALID_BIO;

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Change Successful');
    expect(beforeUser).toStrictEqual(afterUser)
})

test('If change does not interfere with other User documents', async () => {
    expect.assertions(3);

    const newUsers = [...new Array(10)].map((itme, index) => {
        return {
            bio: `Bio: ${index}`
        }
    })

    const beforeUsers = await User.find({});

    await new User(validUser).save();

    const returned = await TempController.changebio(validUser._id, VALID_BIO);

    const afterUsers = await User.find({_id: {$ne: validUser._id}});

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Change Successful');
    expect(beforeUsers).toStrictEqual(afterUsers);
})