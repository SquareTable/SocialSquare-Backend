const User = require('../../models/User');
const Notification = require('../../models/Notification');
const TempController = require('../../controllers/TempController');
const MockMongoDBServer = require('../../models/MockDBServer');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const {expect, test, beforeEach, afterEach} = require('@jest/globals');

const DB = new MockMongoDBServer();

beforeEach(async () => {
	await DB.startTest();
})

afterEach(async () => {
	await DB.stopTest();
})

const userData = {
	_id: '656196e317bec814f3df76d3'
}

const notificationData = {
	_id: '656196ed5d7c232a0c5f8da1'
}

/*
TODO:
- Test if deletion fails if userId is not a string -- Done
- Test if deletion fails if userId is not an ObjectId -- Done
- Test if deletion fails if notificationId is not a string -- Done
- Test if deletion fails if notificationId is not an ObjectId -- Done
- Test if deletion fails if user could not be found -- Done
- Test if deletion fails if notification could not be found -- Done
- Test if deletion fails if the user is not the notification owner
- Test if deletion succeeds with correct inputs
- Test if deletion does not interfere with other notifications in the database
*/

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
	test(`If deletion fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
		expect.assertions(2);

		const returned = await TempController.deletenotification(notString, notificationData._id);

		expect(returned.statusCode).toBe(400);
		expect(returned.data.message).toBe(`userId must be a string. Provided type: ${typeof notString}`)
	})

	test(`If deletion fails if notificationId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
		expect.assertions(2);

		const returned = await TempController.deletenotification(userData._id, notString);

		expect(returned.statusCode).toBe(400);
		expect(returned.data.message).toBe('notificationId must be an ObjectId.')
	})
}

test('If deletion fails if userId is not an ObjectId', async () => {
	expect.assertions(2);

	const returned = await TempController.deletenotification('i am not an ObjectId', notificationData._id);

	expect(returned.statusCode).toBe(400);
	expect(returned.data.message).toBe('userId must be an ObjectId.')
})

test('If deletion fails if notificationId is not an ObjectId', async () => {
	expect.assertions(2);

	const returned = await TempController.deletenotification(userData._id, 'i am not an ObjectId');

	expect(returned.statusCode).toBe(400);
	expect(returned.data.message).toBe('notificationId must be an ObjectId.')
})

test('If deletion fails if user could not be found', async () => {
	expect.assertions(2);

	const returned = await TempController.deletenotification(userData._id, notificationData._id);

	expect(returned.statusCode).toBe(404);
	expect(returned.data.message).toBe('Could not find user with provided userId.')
})

test('If deletion fails if notification could not be found', async () => {
	expect.assertions(2);

	await new User(userData).save();

	const returned = await TempController.deletenotification(userData._id, notificationData._id);

	expect(returned.statusCode).toBe(404;
	expect(returned.data.message).toBe('Could not find notification.')
})