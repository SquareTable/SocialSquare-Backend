const mongoose = require('mongoose')
const {v4: uuidv4} = require('uuid')

const MockMongoDBServer = require('../../libraries/MockDBServer');

const User = require('../../models/User')
const ImagePost = require('../../models/ImagePost')
const Poll = require('../../models/Poll')
const Thread = require('../../models/Thread')

const UserLibrary = require('../../libraries/User')
const userLib = new UserLibrary();

const Upvote = require('../../models/Upvote');
const Downvote = require('../../models/Downvote');

const ArrayLibrary = require('../../libraries/Array');
const arrayHandler = new ArrayLibrary();

const jwt = require('jsonwebtoken')

const POST_DATABASE_MODELS = {
    Image: ImagePost,
    Poll,
    Thread
}

const VOTE_DATABASE_MODELS = {
    Up: Upvote,
    Down: Downvote
}

const {expect, test, beforeAll, afterEach, afterAll} = require('@jest/globals')

const TEST_CONSTANTS = require('../TEST_CONSTANTS')
const CONSTANTS = require('../../constants')

jest.setTimeout(20_000)

const DB = new MockMongoDBServer()

const server = require('../../server')
const supertest = require('supertest')

beforeAll(async () => {
  await DB.startTest();
})

afterEach(async () => {
  await DB.purgeData()
})

afterAll(async () => {
  await DB.stopTest()
})

const userPublicIds = [...new Array(100)].map(() => uuidv4());

/*
Tests:
- Test if request fails if userId is not a string
- Test if reqeust fails if userId is not an ObjectId
- Test if request fails if postId is not a string
- Test if request fails if postId is not an ObjectId
- Test if request fails if postFormat is not supported in constants file
- Test if request fails if lastItemId is not a string or undefined
- Test if request fails if lastItemId is a string and not an ObjectId
- Test if request fails if voteType is not supported in constants file
- Test if request fails if user requesting cannot be found
- Test if request fails if post cannot be found
- Test if request fails if postCreator could not be found
- Test if request with no lastItemId returns correct data
- Test if request with lastItemId returns correct votes
- Test if request fails if user is blocked by post creator
- Test if request fails if user is not following the post creator and the post creator account is private
*/

const userRequestingData = {
    _id: '65a14de87774de8535a9f535',
    secondId: uuidv4(),
    name: 'requester',
    displayName: 'requester'
}

const postCreatorData = {
    _id: '65a14e0efc86634068900719',
    secondId: uuidv4(),
    name: 'creator',
    displayName: 'creator'
}

const postData = {
    _id: '65a14e1d978d62ecd33b3aa6',
    creatorId: postCreatorData._id
}

const validToken = 'Bearer ' + jwt.sign({_id: userData._id}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

for (const voteType of CONSTANTS.VOTED_USERS_API_ALLOWED_VOTE_TYPES) {
    describe(`Vote type: ${voteType}`, () => {
        for (const postFormat of CONSTANTS.VOTE_API_ALLOWED_POST_FORMATS) {
            describe(`postFormat: ${postFormat}`, () => {
                for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
                    describe(`notString: ${JSON.stringify(notString)}`, () => {
                        test(`If request fails if userId is not a string.`, async () => {
                            expect.assertions(3);

                            await DB.takeDBSnapshot()

                            const invalidToken = 'Bearer ' + jwt.sign({_id: notString}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

                            const response = await supertest(server)
                            .post('/tempRoute/getvotedusersofpost')
                            .set('auth-web-token', invalidToken)
                            .send({postId: postData._id, postFormat, lastItemId: undefined, voteType})
            
                            expect(response.body.message).toBe(`userId must be a string. Type provided: ${typeof notString}`)
                            expect(response.statusCode).toBe(400);
                            expect(await DB.noChangesMade()).toBe(true)
                        })
            
                        test(`If request fails if postId is not a string.`, async () => {
                            expect.assertions(3);

                            await DB.takeDBSnapshot()

                            const response = await supertest(server)
                            .post('/tempRoute/getvotedusersofpost')
                            .set('auth-web-token', validToken)
                            .send({postId: notString, postFormat, lastItemId: undefined, voteType})
            
                            expect(response.statusCode).toBe(400);
                            expect(response.body.message).toBe(`postId must be a string. Type provided: ${typeof notString}`)
                            expect(await DB.noChangesMade()).toBe(true)
                        })
            
                        if (notString !== undefined) {
                            test(`If request fails if lastItemId is not a string or undefined.`, async () => {
                                expect.assertions(3);

                                await DB.takeDBSnapshot()

                                const response = await supertest(server)
                                .post('/tempRoute/getvotedusersofpost')
                                .set('auth-web-token', validToken)
                                .send({postId: postData._id, postFormat, lastItemId: notString, voteType})
            
                                expect(response.body.message).toBe('lastItemId must be either a string or undefined.')
                                expect(response.statusCode).toBe(400);
                                expect(await DB.noChangesMade()).toBe(true)
                            })
                        }
                    })
                }

                test('If request fails if user requesting cannot be found', async () => {
                    expect.assertions(3);

                    const response = await supertest(server)
                    .post('/tempRoute/getvotedusersofpost')
                    .set('auth-web-token', validToken)
                    .send({postId: postData._id, postFormat, lastItemId: undefined, voteType})

                    expect(response.statusCode).toBe(404);
                    expect(response.body.message).toBe('Could not find user with provided userId.')
                    expect(await DB.noChangesMade()).toBe(true)
                })

                test('If request fails if post cannot be found', async () => {
                    expect.assertions(3);

                    await new User(userRequestingData).save();

                    await DB.takeDBSnapshot()

                    const response = await supertest(server)
                    .post('/tempRoute/getvotedusersofpost')
                    .set('auth-web-token', validToken)
                    .send({postId: postData._id, postFormat, lastItemId: undefined, voteType})

                    expect(response.statusCode).toBe(404);
                    expect(response.body.message).toBe('Could not find post.')
                    expect(await DB.noChangesMade()).toBe(true)
                })

                test('If request fails if post creator cannot be found', async () => {
                    expect.assertions(3);

                    await new User(userRequestingData).save();
                    await new POST_DATABASE_MODELS[postFormat](postData).save();

                    await DB.takeDBSnapshot()

                    const response = await supertest(server)
                    .post('/tempRoute/getvotedusersofpost')
                    .set('auth-web-token', validToken)
                    .send({postId: postData._id, postFormat, lastItemId: undefined, voteType})

                    expect(response.statusCode).toBe(404);
                    expect(response.body.message).toBe('Could not find post creator')
                    expect(await DB.noChangesMade()).toBe(true)
                })

                test('If request sends correct data with lastItemId undefined', async () => {
                    expect.assertions(3);

                    await new User(userRequestingData).save();
                    await new POST_DATABASE_MODELS[postFormat](postData).save();
                    await new User(postCreatorData).save();

                    await User.insertMany(userPublicIds.map((pubId, index) => {
                        return {
                            secondId: pubId,
                            name: `${index}name`,
                            displayName: `${index}displayname`,
                            profileImageKey: '',
                            bio: 'bio'
                        }
                    }))

                    await VOTE_DATABASE_MODELS[voteType].insertMany(userPublicIds.map(pubId => {
                        return {
                            _id: new mongoose.Types.ObjectId(),
                            postId: postData._id,
                            postFormat,
                            interactionDate: Date.now(),
                            userPublicId: pubId
                        }
                    }))

                    await DB.takeDBSnapshot()

                    const response = await supertest(server)
                    .post('/tempRoute/getvotedusersofpost')
                    .set('auth-web-token', validToken)
                    .send({postId: postData._id, postFormat, lastItemId: undefined, voteType})

                    const votes = await VOTE_DATABASE_MODELS[voteType].find({}).sort({_id: -1}).lean();

                    const expectedUserIds = votes.splice(0, 10).map(vote => vote.userPublicId);

                    const users = await User.find({secondId: {$in: expectedUserIds}}).lean();

                    const {foundDocuments} = arrayHandler.returnDocumentsFromIdArray(expectedUserIds, users, 'secondId')

                    const userRequesting = await User.findOne({_id: userRequestingData._id}).lean();

                    const expectedUserDocuments = foundDocuments.map(user => userLib.returnPublicInformation(user, userRequesting))

                    expect(response.statusCode).toBe(200);
                    expect(response.body.data.items).toStrictEqual(expectedUserDocuments);
                    expect(await DB.noChangesMade()).toBe(true)
                })

                test('If request sends correct data when lastItemId is a UUIDv4', async () => {
                    expect.assertions(4);

                    await new User(userRequestingData).save();
                    await new POST_DATABASE_MODELS[postFormat](postData).save();
                    await new User(postCreatorData).save();

                    await User.insertMany(userPublicIds.map((pubId, index) => {
                        return {
                            secondId: pubId,
                            name: `${index}name`,
                            displayName: `${index}displayname`,
                            profileImageKey: '',
                            bio: 'bio'
                        }
                    }))

                    const rawVoteData = userPublicIds.map(pubId => {
                        return {
                            _id: new mongoose.Types.ObjectId(),
                            postId: postData._id,
                            postFormat,
                            interactionDate: Date.now(),
                            userPublicId: pubId
                        }
                    })

                    await VOTE_DATABASE_MODELS[voteType].insertMany(rawVoteData)

                    await DB.takeDBSnapshot()

                    const lastItemId = rawVoteData[89].secondId;

                    const response = await supertest(server)
                    .post('/tempRoute/getvotedusersofpost')
                    .set('auth-web-token', validToken)
                    .send({postId: postData._id, postFormat, lastItemId, voteType})

                    const allVotes = await VOTE_DATABASE_MODELS[voteType].find({}).sort({_id: 1}).lean();

                    const expectedUserIds = allVotes.splice(90, 10).map(vote => vote.userPublicId).reverse(); //Returns item number 100, 99, ... 90

                    const users = await User.find({secondId: {$in: expectedUserIds}}).lean();

                    const {foundDocuments} = arrayHandler.returnDocumentsFromIdArray(expectedUserIds, users, 'secondId')

                    const userRequesting = await User.findOne({_id: userRequestingData._id}).lean();

                    const expectedUserDocuments = foundDocuments.map(user => userLib.returnPublicInformation(user, userRequesting))

                    expect(response.statusCode).toBe(200);
                    expect(response.body.data.items).toStrictEqual(expectedUserDocuments);
                    expect(response.body.data.noMoreItems).toBe(false);
                    expect(await DB.noChangesMade()).toBe(true)
                })

                test('If request fails if user is blocked by post creator', async () => {
                    expect.assertions(4);

                    const postCreator = {
                        ...postCreatorData,
                        blockedAccounts: [userRequestingData.secondId]
                    }

                    await new User(userRequestingData).save();
                    await new User(postCreator).save();
                    await new POST_DATABASE_MODELS[postFormat](postData).save();
                    await new VOTE_DATABASE_MODELS[voteType]({_id: new mongoose.Types.ObjectId}).save();

                    await DB.takeDBSnapshot()

                    const response = await supertest(server)
                    .post('/tempRoute/getvotedusersofpost')
                    .set('auth-web-token', validToken)
                    .send({postId: postData._id, postFormat, lastItemId: undefined, voteType})

                    expect(response.statusCode).toBe(404);
                    expect(response.body.message).toBe('Could not find post.')
                    expect(response.body.data).toBe(undefined)
                    expect(await DB.noChangesMade()).toBe(true)
                })

                test('If request fails if user is not following the post creator and the post creator account is private', async () => {
                    expect.assertions(4);

                    const postCreator = {
                        ...postCreatorData,
                        privateAccount: true
                    }

                    await new User(userRequestingData).save();
                    await new User(postCreator).save();
                    await new POST_DATABASE_MODELS[postFormat](postData).save();
                    await new VOTE_DATABASE_MODELS[voteType]({_id: new mongoose.Types.ObjectId}).save();

                    await DB.takeDBSnapshot()

                    const response = await supertest(server)
                    .post('/tempRoute/getvotedusersofpost')
                    .set('auth-web-token', validToken)
                    .send({postId: postData._id, postFormat, lastItemId: undefined, voteType})

                    expect(response.statusCode).toBe(404);
                    expect(response.body.message).toBe('Could not find post.')
                    expect(response.body.data).toBe(undefined)
                    expect(await DB.noChangesMade()).toBe(true)
                })
            })
        }
    })
}

test('If request fails if userId is not an ObjectId', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const invalidToken = 'Bearer ' + jwt.sign({_id: 'notanobjectid'}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

    const response = await supertest(server)
    .post('/tempRoute/getvotedusersofpost')
    .set('auth-web-token', invalidToken)
    .send({postId: postData._id, postFormat: 'Image', lastItemId: undefined, voteType: 'Up'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('userId must be an ObjectId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If request fails if postId is not an ObjectId', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/getvotedusersofpost')
    .set('auth-web-token', validToken)
    .send({postId: 'notanobjectid', postFormat: 'Image', lastItemId: undefined, voteType: 'Up'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('postId must be an ObjectId.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If request fails if postFormat is not supported in constants file', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/getvotedusersofpost')
    .set('auth-web-token', validToken)
    .send({postId: postData._id, postFormat: 'invalid', lastItemId: undefined, voteType: 'Up'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(`postFormat is invalid. Must be one of these values: ${CONSTANTS.VOTED_USERS_API_ALLOWED_POST_FORMATS.join(', ')}`)
    expect(await DB.noChangesMade()).toBe(true)
})

test('If request fails if lastItemId is a string and not a UUIDv4', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/getvotedusersofpost')
    .set('auth-web-token', validToken)
    .send({postId: postData._id, postFormat: 'Image', lastItemId: 'iamnotauuidv4', voteType: 'Up'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('lastItemId must be a valid UUIDv4 if it is going to be a string.')
    expect(await DB.noChangesMade()).toBe(true)
})

test('If request fails if voteType is not supported in constants file', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/getvotedusersofpost')
    .set('auth-web-token', validToken)
    .send({postId: postData._id, postFormat: 'Image', lastItemId: undefined, voteType: 'Middle'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(`voteType must be one of these values: ${CONSTANTS.VOTED_USERS_API_ALLOWED_VOTE_TYPES.join(', ')}`)
    expect(await DB.noChangesMade()).toBe(true)
})