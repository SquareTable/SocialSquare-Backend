const mongoose = require('mongoose')
const {v4: uuidv4} = require('uuid')

const TempController = require('../../controllers/Temp');
const MockMongoDBServer = require('../../libraries/MockDBServer');

const User = require('../../models/User')
const ImagePost = require('../../models/ImagePost')
const Poll = require('../../models/Poll')
const Thread = require('../../models/Thread')

const {expect, test, beforeEach, afterEach} = require('@jest/globals')

const TEST_CONSTANTS = require('../TEST_CONSTANTS')
const CONSTANTS = require('../../constants')

jest.setTimeout(20_000)

const DB = new MockMongoDBServer()

beforeEach(async () => {
    await DB.startTest()
})

afterEach(async () => {
    await DB.stopTest()
})

/*
TODO:
- Test if request fails if userId is not a string -- Done
- Test if reqeust fails if userId is not an ObjectId -- Done
- Test if request fails if postId is not a string -- Done
- Test if request fails if postId is not an ObjectId -- Done
- Test if request fails if postFormat is not supported in constants file
- Test if request fails if lastVoteId is not a string or undefined -- Done
- Test if request fails if lastVoteId is a string and not an ObjectId
- Test if request fails if voteType is not supported in constants file
- Test if request fails if user requesting cannot be found
- Test if request fails if post cannot be found
- Test if request fails if postCreator could not be found
- Test if request with no lastVoteId returns correct votes
- Test if request with lastVoteId returns correct votes
*/

const userRequestingData = {
    _id: new mongoose.Types.ObjectId(),
    secondId: uuidv4()
}

const postData = {
    _id: new mongoose.Types.ObjectId(),
    creatorId: userRequestingData._id
}

const postCreatorData = {
    _id: new mongoose.Types.ObjectId(),
    secondId: uuidv4()
}

for (const voteType of CONSTANTS.VOTED_USERS_API_ALLOWED_VOTE_TYPES) {
    describe(`Vote type: ${voteType}`, () => {
        for (const postFormat of CONSTANTS.VOTE_API_ALLOWED_POST_FORMATS) {
            describe(`postFormat: ${postFormat}`, () => {
                for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
                    describe(`notString: ${JSON.stringify(notString)}`, () => {
                        test(`If request fails if userId is not a string.`, async () => {
                            expect.assertions(2);
                    
                            const returned = await TempController.getvotedusersofpost(notString, postData._id, postFormat, undefined, voteType);
            
                            expect(returned.statusCode).toBe(400);
                            expect(returned.data.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
                        })
            
                        test(`If request fails if postId is not a string.`, async () => {
                            expect.assertions(2);
            
                            const returned = await TempController.getvotedusersofpost(userRequestingData._id, notString, postFormat, undefined, voteType);
            
                            expect(returned.statusCode).toBe(400);
                            expect(returned.data.message).toBe(`postId must be a string. Type provided: ${typeof notString}`)
                        })
            
                        if (notString !== undefined) {
                            test(`If request fails if lastVoteId is not a string or undefined.`, async () => {
                                expect.assertions(2);
            
                                const returned = await TempController.getvotedusersofpost(userRequestingData._id, postData._id, postFormat, notString, voteType);
            
                                expect(returned.statusCode).toBe(400);
                                expect(returned.data.message).toBe('lastVoteId must be either a string or undefined.')
                            })
                        }
                    })
                }
        
                test('If request fails if userId is not an ObjectId', async () => {
                    expect.assertions(2);
        
                    const returned = await TempController.getvotedusersofpost('i am not an objectid', postData._id, postFormat, undefined, voteType);
        
                    expect(returned.statusCode).toBe(400);
                    expect(returned.data.message).toBe('userId must be an ObjectId.')
                })

                test('If request fails if postId is not an ObjectId', async () => {
                    expect.assertions(2);

                    const returned = await TempController.getvotedusersofpost(userRequestingData._id, 'i am not an objectid', postFormat, undefined, voteType);

                    expect(returned.statusCode).toBe(400);
                    expect(returned.data.message).toBe('postId must be an ObjectId.')
                })
            })
        }
    })
}