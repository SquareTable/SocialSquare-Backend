const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const TempController = require('../../controllers/Temp');
const User = require('../../models/User');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const {expect, test, beforeEach, afterEach} = require('@jest/globals');
const {v4: uuidv4} = require('uuid');

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
TODO:
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
}