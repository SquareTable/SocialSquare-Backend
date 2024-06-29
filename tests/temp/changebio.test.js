const User = require('../../models/User');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const TempController = require('../../controllers/Temp')

const {beforeEach, afterEach, test, expect} = require('@jest/globals');

const DB = new MockMongoDBServer();

beforeAll(async () => {
  DB.startTest();
})

afterEach(async () => {
    await DB.purgeData()
})

afterAll(async () => {
  await DB.stopTest()
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
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const returned = await TempController.changebio(notString, VALID_BIO);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })

    test(`If change fails if bio is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const returned = await TempController.changebio(validUser._id, notString);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`bio must be a string. Provided type: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test('If change fails if userId is not an ObjectId', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await TempController.changebio('this is not an objectid', VALID_BIO);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userId must be an ObjectId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if bio is longer than 250 characters', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await TempController.changebio(validUser._id, new Array(252).join('a'));

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Bio must be 250 or less characters')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if bio has more than 4 lines', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await TempController.changebio(validUser._id, `

        this is more than 4 lines here

    `);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('Bio must have 4 or less lines')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change fails if user could not be found', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const returned = await TempController.changebio(validUser._id, VALID_BIO);

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('User with provided userId could not be found')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If change is successful with correct inputs', async () => {
    expect.assertions(4);

    await new User(validUser).save();

    await DB.takeDBSnapshot()

    const beforeUser = await User.findOne({_id: validUser._id}).lean();

    const returned = await TempController.changebio(validUser._id, VALID_BIO);

    const afterUser = await User.findOne({_id: validUser._id}).lean();

    beforeUser.bio = VALID_BIO;

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Change Successful');
    expect(beforeUser).toStrictEqual(afterUser)
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})

test('If change does not interfere with other User documents', async () => {
    expect.assertions(4);

    const newUsers = [...new Array(10)].map((item, index) => {
        return {
            bio: `Bio: ${index}`
        }
    })

    await new User.insertMany(newUsers)

    await DB.takeDBSnapshot()

    const beforeUsers = await User.find({}).lean();

    await new User(validUser).save();

    const returned = await TempController.changebio(validUser._id, VALID_BIO);

    const afterUsers = await User.find({_id: {$ne: validUser._id}}).lean();

    expect(returned.statusCode).toBe(200);
    expect(returned.data.message).toBe('Change Successful');
    expect(beforeUsers).toStrictEqual(afterUsers);
    expect(await DB.changedCollections()).toIncludeSameMembers(['User'])
})