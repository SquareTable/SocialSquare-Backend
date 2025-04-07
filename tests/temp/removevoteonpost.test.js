const mongoose = require('mongoose');
const User = require('../../models/User');
const MockMongoDBServer = require('../../libraries/MockDBServer');

const ImagePost = require('../../models/ImagePost')
const Poll = require('../../models/Poll')
const Thread = require('../../models/Thread')
const Comment = require('../../models/Comment');
const Upvote = require('../../models/Upvote');
const Downvote = require('../../models/Downvote');

const {v4: uuidv4} = require('uuid');
const jwt = require('jsonwebtoken')
const supertest = require('supertest')
const server = require('../../server')

const {expect, beforeAll, afterEach, afterAll} = require('@jest/globals');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const POST_DATABASE_MODELS = {
    'Image': ImagePost,
    Poll,
    Thread,
    Comment
}

const VOTE_DATABASE_MODELS = {
    Up: Upvote,
    Down: Downvote
}

const invalidPostFormats = ["IMAGE", "POLL", "THREAD", "image", "poll", "thread", "iMage", "pOll", "tHread", 'not a post at all']
const invalidVoteTypes = ["UP", "DOWN", 'up', 'down', 'not a type at all']

jest.setTimeout(20_000); //20 seconds per test

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

/*
API tests:
Test if removing votes work for non-private non-blocked accounts when voter is not the post creator
Test if removing votes fails if the voter is the post creator
Test if removing votes works for private accounts where the voter is following the private account
Test if removing votes fails if userId is not a string
Test if removing votes fails if userId is not an ObjectId
Test if removing votes fails if postId is not a string
Test if removing votes fails if postId is not an ObjectId
Test if removing votes fails if postFormat is not a valid format
Test if removing votes fails if voteType is not a valid type
Test if removing votes fails if voter's account could not be found
Test if removing votes fails if post could not be found
Test if removing votes fails when post creator could not be found
Test if removing votes fails if the account is blocked
Test if removing votes fails if the post creator account is private and the user is not following them
Test that votes already in the database do not get modified by someone else removing a vote
*/

const formats = ["Image", "Poll", "Thread"]
const votes = ["Up", "Down"]

const voterData = {
    _id: "653947b8cb8b8f978c670cd6",
    secondId: "68b7962e-75f3-4c1f-b457-a112cc62a182",
    name: 'voter'
}

const postCreatorData = {
    _id: "653947e4234a318b50cbde1a",
    privateAccount: false,
    followers: [],
    blockedAccounts: [],
    name: 'postCreator'
}

const postData = {
    _id: "65394836f449781b30a877e3",
    creatorId: "653947e4234a318b50cbde1a"
}

const validToken = 'Bearer ' + jwt.sign({_id: voterData._id}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

for (const postFormat of formats) {
    const voteData = {
        postId: postData._id,
        postFormat: postFormat,
        interactionDate: Date.now(),
        userPublicId: voterData.secondId
    }

    for (const voteType of votes) {
        test(`Removing ${voteType}vote on ${postFormat} post works for non-private accounts with no blocked accounts when voter is not the post creator`, async () => {
            expect.assertions(3);

            await new User(voterData).save();
            await new User(postCreatorData).save();
            await new POST_DATABASE_MODELS[postFormat](postData).save();
            await new VOTE_DATABASE_MODELS[voteType](voteData).save();

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/removevoteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(response.statusCode).toBe(200);
            expect(votes).toHaveLength(0)
            expect(await DB.changedCollections()).toIncludeSameMembers([`${voteType}vote`])
        })

        test(`Removing ${voteType}vote on ${postFormat} works for private accounts where the voter is following the private account`, async () => {
            expect.assertions(3);

            const postCreator = {
                ...postCreatorData,
                privateAccount: true,
                followers: [voterData.secondId]
            }

            await new User(voterData).save();
            await new User(postCreator).save();
            await new POST_DATABASE_MODELS[postFormat](postData).save();
            await new VOTE_DATABASE_MODELS[voteType](voteData).save();

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/removevoteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(response.statusCode).toBe(200);
            expect(votes).toHaveLength(0);
            expect(await DB.changedCollections()).toIncludeSameMembers([`${voteType}vote`])
        })

        test(`Removing ${voteType}vote on ${postFormat} post fails if voter's account could not be found`, async () => {
            expect.assertions(4);
        
            await new User(postCreatorData).save();
            await new POST_DATABASE_MODELS[postFormat](postData).save();
            await new VOTE_DATABASE_MODELS[voteType](voteData).save();

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/removevoteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(votes).toHaveLength(1);
            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe("Could not find user with provided userId.")
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`If removing ${voteType}vote on ${postFormat} post fails if post could not be found`, async () => {
            expect.assertions(4);

            await new User(voterData).save();
            await new User(postCreatorData).save();
            await new VOTE_DATABASE_MODELS[voteType](voteData).save();

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/removevoteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();
            
            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe("Could not find post with postId.");
            expect(votes).toHaveLength(1);
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`If removing ${voteType}vote on ${postFormat} post fails if post creator could not be found`, async () => {
            expect.assertions(4);

            await new User(voterData).save();
            await new POST_DATABASE_MODELS[postFormat](postData).save();
            await new VOTE_DATABASE_MODELS[voteType](voteData).save();

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/removevoteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe("Could not find post creator.");
            expect(votes).toHaveLength(1);
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`If removing ${voteType}vote on ${postFormat} post fails if the voter account is blocked by the post creator's account`, async () => {
            expect.assertions(4);

            const postCreator = {
                ...postCreatorData,
                blockedAccounts: [voterData.secondId]
            }

            await new User(voterData).save();
            await new User(postCreator).save();
            await POST_DATABASE_MODELS[postFormat](postData).save();
            await VOTE_DATABASE_MODELS[voteType](voteData).save();

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/removevoteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe("Post could not be found.");
            expect(votes).toHaveLength(1);
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`If removing ${voteType}vote on ${postFormat} post fails if the post creator account is private and the voter is not following the post creator`, async () => {
            expect.assertions(4);

            const postCreator = {
                ...postCreatorData,
                privateAccount: true
            }

            await new User(voterData).save();
            await new User(postCreator).save();
            await POST_DATABASE_MODELS[postFormat](postData).save();
            await VOTE_DATABASE_MODELS[voteType](voteData).save();

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/removevoteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe("Post could not be found.");
            expect(votes).toHaveLength(1);
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`If removing ${voteType}vote on ${postFormat} posts do not modify votes made by other users other than the voter`, async () => {
            expect.assertions(4);

            //Creates 10 votes - 5 upvotes, 5 downvotes
            const votesToInsert = [...new Array(10)].map(() => {
                return {
                    _id: String(new mongoose.Types.ObjectId()),
                    __v: 0,
                    postId: postData._id,
                    postFormat,
                    interactionDate: Date.now(),
                    userPublicId: uuidv4()
                }
            })

            const upvotesToInsert = votesToInsert.splice(0, 5);
            const downvotesToInsert = votesToInsert.splice(0, 5);

            await new User(voterData).save();
            await new User(postCreatorData).save();
            await POST_DATABASE_MODELS[postFormat](postData).save();
            await Upvote.insertMany(upvotesToInsert);
            await Downvote.insertMany(downvotesToInsert);

            const beforeUpvotes = await Upvote.find({}).lean();
            const beforeDownvotes = await Downvote.find({}).lean();

            //Add voters vote after original upvotes and downvotes are added
            await VOTE_DATABASE_MODELS[voteType](voteData).save();

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/removevoteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const afterUpvotes = await Upvote.find({}).lean();
            const afterDownvotes = await Downvote.find({}).lean();

            expect(response.statusCode).toBe(200);
            expect(afterUpvotes).toStrictEqual(beforeUpvotes);
            expect(afterDownvotes).toStrictEqual(beforeDownvotes);
            expect(await DB.changedCollections()).toIncludeSameMembers([`${voteType}vote`])
        })
    }
}

for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
    test(`if removing votes fails if userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const invalidToken = 'Bearer ' + jwt.sign({_id: notString}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

        const response = await supertest(server)
        .post('/tempRoute/removevoteonpost')
        .set('auth-web-token', invalidToken)
        .send({postId: postData._id, postFormat: 'Image', voteType: 'Up'})
    
        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`userId must be a string. Provided type: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })

    test(`if removing votes fails if postId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/removevoteonpost')
        .set('auth-web-token', validToken)
        .send({postId: notString, postFormat: 'Image', voteType: 'Up'})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`postId must be a string. Provided type: ${typeof notString}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}

test('if removing votes fails if userId is not an ObjectId', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const invalidToken = 'Bearer ' + jwt.sign({_id: 'iamnotanobjectid'}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

    const response = await supertest(server)
    .post('/tempRoute/removevoteonpost')
    .set('auth-web-token', invalidToken)
    .send({postId: postData._id, postFormat: 'Image', voteType: 'Up'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("userId must be an ObjectId.")
    expect(await DB.noChangesMade()).toBe(true)
})

test('if removing votes fails if postId is not an ObjectId', async () => {
    expect.assertions(3);

    await DB.takeDBSnapshot()

    const response = await supertest(server)
    .post('/tempRoute/removevoteonpost')
    .set('auth-web-token', validToken)
    .send({postId: 'iamnotanobjectid', postFormat: 'Image', voteType: 'Up'})

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("postId must be an ObjectId.")
    expect(await DB.noChangesMade()).toBe(true)
})

for (const invalidFormat of invalidPostFormats) {
    test(`if removing votes fails if postFormat is invalid. Testing ${invalidFormat}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/removevoteonpost')
        .set('auth-web-token', validToken)
        .send({postId: postData._id, postFormat: invalidFormat, voteType: 'Up'})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`Invalid post format provided. Valid post formats: ${formats.join(', ')}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}

for (const invalidVoteType of invalidVoteTypes) {
    test(`if removing votes fails if voteType is invalid. Testing ${invalidVoteType}`, async () => {
        expect.assertions(3);

        await DB.takeDBSnapshot()

        const response = await supertest(server)
        .post('/tempRoute/removevoteonpost')
        .set('auth-web-token', validToken)
        .send({postId: postData._id, postFormat: 'Image', voteType: invalidVoteType})

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(`Invalid vote type provided. Valid vote types: ${votes.join(', ')}`)
        expect(await DB.noChangesMade()).toBe(true)
    })
}