const User = require('../../models/User');
const Notification = require('../../models/Notification');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const TempController = require('../../controllers/Temp');

const {expect, test, beforeEach, afterEach} = require('@jest/globals');

const DB = new MockMongoDBServer();

beforeEach(async () => {
	await DB.startTest();
})

afterEach(async () => {
	await DB.stopTest();
})

/*
Tests:
- Test if clearing notifications fails if userId is not a string
- Test if clearing notifications fails if userId is not an ObjectId
- Test if clearing notifications fails if user could not be found
- Test if clearing notifications succeeds with correct input
- Test if clearing notifications does not clear other users' notifications
*/

const userData = {
	_id: '6560ae37c116f9ded444d3d7'
}

const userNotifications = [...new Array(100)].map((item, index) => {
	return {
		text: `Notification ${index}`,
		dateCreated: new Date(),
		userId: userData._id
	}
})

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
	test(`If clearing notifications fails if userId is not a string, Testing: ${JSON.stringify(notString)}`, async () => {
		expect.assertions(2);

		const returned = await TempController.clearnotifications(notString);

		expect(returned.statusCode).toBe(400);
		expect(returned.data.message).toBe(`userId must be a string. Provided type: ${typeof notString}`)
	})
}

test('If clearing notifications fails if userId is not an ObjectId', async () => {
	expect.assertions(2);

	const returned = await TempController.clearnotifications('i am not an objectid');

	expect(returned.statusCode).toBe(400);
	expect(returned.data.message).toBe('userId must be an ObjectId.')
})

test('If clearing notifications fails if user could not be found', async () => {
	expect.assertions(2);

	const returned = await TempController.clearnotifications(userData._id);

	expect(returned.statusCode).toBe(404);
	expect(returned.data.message).toBe('Could not find user with provided userId.')
})

test('If clearing notifications succeeds with correct input', async () => {
	expect.assertions(3);

	await new User(userData).save();

	await Notification.insertMany(userNotifications);

	const beforeNotifications = await Notification.find({}).lean();

	const returned = await TempController.clearnotifications(userData._id);

	const afterNotifications = await Notification.find({}).lean();

	expect(returned.statusCode).toBe(200);
	expect(beforeNotifications).toHaveLength(100);
	expect(afterNotifications).toHaveLength(0);
})

test("If clearing notifications do not clear other user's notifications", async () => {
	expect.assertions(4);

	await new User(userData).save();

	const otherUserNotifications = [...new Array(900)].map((item, index) => {
		return {
			text: `Notification ${index}`,
			dateCreated: new Date(),
			userId: TEST_CONSTANTS.RANDOM_OBJECTIDS[index % TEST_CONSTANTS.RANDOM_OBJECTIDS.length]
		}
	})

	await Notification.insertMany(userNotifications);
	await Notification.insertMany(otherUserNotifications);

	const beforeNotifications = await Notification.find({}).lean();
	const before_otherNotifications = await Notification.find({userId: {$ne: userData._id}});

	const returned = await TempController.clearnotifications(userData._id);

	const afterNotifications = await Notification.find({}).lean();
	const after_otherNotifications = await Notification.find({userId: {$ne: userData._id}});

	expect(returned.statusCode).toBe(200);
	expect(beforeNotifications).toHaveLength(1000);
	expect(afterNotifications).toHaveLength(900);
	expect(before_otherNotifications).toStrictEqual(after_otherNotifications);
})