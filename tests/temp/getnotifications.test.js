const MockMongoDBServer = require('../../libraries/MockDBServer');
const TempController = require('../../controllers/Temp');
const Notification = require('../../models/Notification');
const User = require('../../models/User');

const TEST_CONSTANTS = require('../TEST_CONSTANTS');
const CONSTANTS = require('../../constants');

const NotificationLibrary = require('../../libraries/Notifications');
const notificationHelper = new NotificationLibrary();

const {expect, beforeEach, afterEach} = require('@jest/globals')

jest.setTimeout(20_000);

/*
Tests:
- Test if notification retrieval fails if userId is not a string
- Test if notification retrieval fails if userId is not an ObjectId
- Test if notification retrieval fails if lastNotificationId is not a string and not undefined
- Test if notification retrieval fails if lastNotificationid is not an ObjectId and not undefined
- Test if notification retrieval fails if user could not be found
- Test if notification retrieval works with lastNotificationId
- Test if notification retrieval works with lastNotificationId as undefined
*/

const userData = {
    _id: "658ede853d49c73b7571ab76"
}

const DB = new MockMongoDBServer();

beforeEach(async () => {
    await DB.startTest()
})

afterEach(async () => {
    await DB.stopTest()
})

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`If retrieval fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.getnotifications(notString, undefined);

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Provided type: ${typeof notString}`)
    })

    if (notString !== undefined) {
        test(`If retrieval fails if lastNotificationId is not a string or undefined. Testing: ${JSON.stringify(notString)}`, async () => {
            expect.assertions(2);

            const returned = await TempController.getnotifications(userData._id, notString)

            expect(returned.statusCode).toBe(400);
            expect(returned.data.message).toBe(`lastNotificationId must be a string or undefined. Provided type: ${typeof notString}`)
        })
    }
}

test('If retrieval fails if userId is not an ObjectId', async () => {
    expect.assertions(2);

    const returned = await TempController.getnotifications('i am not an objectid', undefined);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('userId must be an ObjectId.')
})

test('If retrieval fails if lastNotificationId is not an ObjectId and not undefined', async () => {
    expect.assertions(2);

    const returned = await TempController.getnotifications(userData._id, 'i am not an objectid')

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe('lastNotificationId must be an ObjectId or undefined.')
})

test('If retrieval fails if user could not be found', async () => {
    expect.assertions(3);

    const returned = await TempController.getnotifications(userData._id, undefined);

    expect(returned.statusCode).toBe(404);
    expect(returned.data.message).toBe('Could not find user with provided userId.')
    expect(returned.data.data).toBe(undefined)
})

test('If retrieval works with lastNotificationId', async () => {
    expect.assertions(2);

    await new User(userData).save();

    await Notification.insertMany([...new Array(1000)].map((item, index) => {
        return {
            text: index,
            userId: userData._id
        }
    }))

    const notifications = await Notification.find({}).sort({_id: -1}).lean();

    const lastNotificationId = notifications[4]._id;

    const processedNotifications = notificationHelper.returnNotificationDataToSend(notifications.splice(5, CONSTANTS.MAX_NOTIFICATIONS_PER_API_CALL))

    const returned = await TempController.getnotifications(userData._id, lastNotificationId);

    expect(returned.statusCode).toBe(200);
    expect(returned.data.data.notifications).toStrictEqual(processedNotifications);
})

test('If retrieval works with lastNotificationId as undefined', async () => {
    expect.assertions(2);

    await new User(userData).save();

    await Notification.insertMany([...new Array(1000)].map((item, index) => {
        return {
            text: index,
            userId: userData._id
        }
    }))

    const notifications = await Notification.find({}).sort({_id: -1}).lean();

    const processedNotifications = notificationHelper.returnNotificationDataToSend(notifications.splice(0, CONSTANTS.MAX_NOTIFICATIONS_PER_API_CALL))

    const returned = await TempController.getnotifications(userData._id, undefined);

    expect(returned.statusCode).toBe(200);
    expect(returned.data.data.notifications).toStrictEqual(processedNotifications);
})