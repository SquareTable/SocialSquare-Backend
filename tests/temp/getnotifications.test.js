const MockMongoDBServer = require('../../libraries/MockDBServer');
const TempController = require('../../controllers/Temp');

const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const {expect, beforeEach, afterEach} = require('@jest/globals')

jest.setTimeout(20_000);

/*
TODO:
- Test if notification retrieval fails if userId is not a string
- Test if notification retrieval fails if userId is not an ObjectId
- Test if notification retrieval fails if lastNotificationId is not a string and not undefined
- Test if notification retrieval fails if user could not be found
- Test if notification retrieval works with lastNotificationId
- Test if notification retrieval works with lastNotificationId as undefined
*/