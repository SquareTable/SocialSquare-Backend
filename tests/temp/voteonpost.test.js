const User = require('../../models/User');
const MockMongoDBServer = require('../../libraries/MockDBServer');

const ImagePost = require('../../models/ImagePost')
const Poll = require('../../models/Poll')
const Thread = require('../../models/Thread')
const Comment = require('../../models/Comment');
const Upvote = require('../../models/Upvote');
const Downvote = require('../../models/Downvote');

const {expect, beforeAll, afterEach, afterAll} = require('@jest/globals');
const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const server = require('../../server')
const supertest = require('supertest')
const jwt = require('jsonwebtoken');
const crypto = require('crypto')

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
API Tests:
Test if votes work for non-private non-blocked accounts when voter is not the post creator
Test if votes work when the post creator does not have a blockedAccounts array in their User document
Test if voting fails if the voter is the post creator
Test if votes work for private accounts where the voter is following the private account
Test if voting fails if userId is not a string
Test if voting fails if userId is not an objectId
Test if voting fails if postId is not a string
Test if voting fails if postId is not an objectId
Test if voting fails if postFormat is not a valid format
Test if voting fails if voteType is not a valid type
Test if voting fails if voter's account could not be found
Test if voting fails if post could not be found
Test if voting fails when post creator could not be found
Test if voting fails if the account is blocked
Test if voting fails if the post creator account is private and the user is not following them
Test votes do not get duplicated in database
Test opposite vote types get removed from database when making a vote (upvote gets deleted when making a downvote and vice versa)
Test that votes already in the database do not get modified by someone else adding a vote
*/

const formats = ["Image", "Poll", "Thread"]
const votes = ["Up", "Down"]

const invalidPostFormats = ["IMAGE", "POLL", "THREAD", "image", "poll", "thread", "iMage", "pOll", "tHread", 'not a post at all']
const invalidVoteTypes = ["UP", "DOWN", 'up', 'down', 'not a type at all']

const postCreatorData = {
    _id: "6537d7c2519e591b466c198f",
    blockedAccounts: [],
    privateAccount: false,
    name: 'postcreator'
};

const voterData = {
    _id: "6537dd49d1866f60dbf58d1f",
    secondId: "c709e918-f43a-4b90-a35a-36d8a6193431",
    name: 'voter'
};

const postData = {
    _id: "67f4e15340c399f5663ffe29",
    creatorId: postCreatorData._id
}

const validToken = 'Bearer ' + jwt.sign({_id: voterData._id}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

for (const postFormat of formats) {
    for (const voteType of votes) {
        const oppositeVoteType = voteType === "Up" ? "Down" : "Up";

        test(`${voteType}vote on ${postFormat} post is successful when post creator account is public and has no blocked accounts`, async () => {
            expect.assertions(6);

            await new User(postCreatorData).save();
            await new User(voterData).save();
            await new POST_DATABASE_MODELS[postFormat](postData).save()

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            const vote = votes[0];

            const newVote = {...vote};

            delete newVote._id;
            delete newVote.interactionDate;
            newVote.postId = String(newVote.postId);

            expect(response.statusCode).toBe(200);
            expect(votes).toHaveLength(1);
            expect(vote).toHaveProperty('_id');
            expect(vote.interactionDate < Date.now() && vote.interactionDate > Date.now() - 1000 * 100).toBe(true); //interaction date is between now and 100 seconds before - gives plenty of time for test to run
            expect(newVote).toStrictEqual({
                __v: 0,
                postId: postData._id,
                postFormat,
                userPublicId: voterData.secondId
            });
            expect(await DB.changedCollections()).toIncludeSameMembers([`${voteType}vote`])
        })

        test(`${voteType}vote on ${postFormat} post fails when the voter is the post creator`, async () => {
            expect.assertions(4);

            const voter = {
                ...voterData,
                _id: postCreatorData._id
            }

            await new User(voter).save()

            await new POST_DATABASE_MODELS[postFormat](postData).save()

            await DB.takeDBSnapshot()

            const voterAuthToken = 'Bearer ' + jwt.sign({_id: voter._id}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', voterAuthToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(response.body.message).toBe("You cannot vote on your own post.")
            expect(response.statusCode).toBe(403);
            expect(votes).toHaveLength(0);
            expect(await DB.noChangesMade()).toBe(true)
        })


        test(`${voteType}vote on ${postFormat} post is successful when post creator account has no blocked accounts and is private, but voter is following post creator account`, async () => {
            expect.assertions(6);

            const postCreator = {
                ...postCreatorData,
                privateAccount: true,
                followers: [voterData.secondId]
            }

            await new User(postCreator).save()
            await new User(voterData).save()
            await new POST_DATABASE_MODELS[postFormat](postData).save()

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            const vote = votes[0];

            const newVote = {...vote};

            delete newVote._id;
            delete newVote.interactionDate;
            newVote.postId = String(newVote.postId)
            expect(response.statusCode).toBe(200);
            expect(votes).toHaveLength(1);
            expect(vote).toHaveProperty('_id');
            expect(vote.interactionDate < Date.now() && vote.interactionDate > Date.now() - 1000 * 100).toBe(true); //interaction date is between now and 100 seconds before - gives plenty of time for test to run
            expect(newVote).toStrictEqual({
                __v: 0,
                postId: postData._id,
                postFormat: postFormat,
                userPublicId: voterData.secondId
            });
            expect(await DB.changedCollections()).toIncludeSameMembers([`${voteType}vote`])
        })

        test(`${voteType}vote on ${postFormat} post fails when voter account could not be found`, async () => {
            expect.assertions(4);
            
            await new User(postCreatorData).save()
            await new POST_DATABASE_MODELS[postFormat](postData).save()
            
            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe("Could not find user with provided userId");
            expect(votes).toHaveLength(0);
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`${voteType}vote on ${postFormat} post fails if post could not be found`, async () => {
            expect.assertions(4);

            await new User(postCreatorData).save()
            await new User(voterData).save()

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe("Could not find post");
            expect(votes).toHaveLength(0);
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`${voteType}vote on ${postFormat} post fails when post creator could not be found`, async () => {
            expect.assertions(4);

            await new User(voterData).save()
            await new POST_DATABASE_MODELS[postFormat](postData).save()

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();
            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe("Could not find post creator");
            expect(votes).toHaveLength(0);
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`${voteType}vote on ${postFormat} post fails when the voter is blocked by the post creator`, async () => {
            expect.assertions(4);

            const postCreator = {
                ...postCreatorData,
                blockedAccounts: [voterData.secondId]
            }

            await new User(postCreator).save()
            await new User(voterData).save()
            await new POST_DATABASE_MODELS[postFormat](postData).save()

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe("Could not find post");
            expect(votes).toHaveLength(0);
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`${voteType}vote on ${postFormat} post fails when the post creator has a private account and the voter is not following them`, async () => {
            expect.assertions(4);

            const postCreator = {
                ...postCreatorData,
                privateAccount: true
            }

            await new User(postCreator).save()
            await new User(voterData).save()
            await new POST_DATABASE_MODELS[postFormat](postData).save()

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(response.statusCode).toBe(404);
            expect(response.body.message).toBe("Could not find post");
            expect(votes).toHaveLength(0);
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`${voteType}votes on ${postFormat} post do not get duplicated`, async () => {
            expect.assertions(6);

            await new User(postCreatorData).save()
            await new User(voterData).save()
            await new POST_DATABASE_MODELS[postFormat](postData).save()

            const voteData = {
                postId: postData._id,
                postFormat: postFormat,
                interactionDate: 1,
                userPublicId: voterData.secondId
            }

            const dbVote = new VOTE_DATABASE_MODELS[voteType](voteData)
            await dbVote.save()

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            const vote = votes[0];

            const newVote = {...vote};

            delete newVote._id;
            delete newVote.interactionDate;
            newVote.postId = String(newVote.postId);

            expect(response.statusCode).toBe(200);
            expect(votes).toHaveLength(1);
            expect(vote).toHaveProperty('_id')
            expect(vote.interactionDate < Date.now() && vote.interactionDate > Date.now() - 1000 * 100).toBe(true) //interaction date is between now and 100 seconds before - gives plenty of time for test to run        
            expect(newVote).toStrictEqual({
                __v: 0,
                postId: postData._id,
                postFormat: postFormat,
                userPublicId: voterData.secondId
            })
            expect(await DB.changedCollections()).toIncludeSameMembers([`${voteType}vote`])
        })

        test(`${oppositeVoteType}votes on ${postFormat} post get deleted when making a ${voteType}vote`, async () => {
            expect.assertions(4);

            await new User(postCreatorData).save()
            await new User(voterData).save()
            await new POST_DATABASE_MODELS[postFormat](postData).save()

            const voteData = {
                postId: postData._id,
                postFormat: postFormat,
                interactionDate: 1,
                userPublicId: voterData.secondId
            }

            const dbVote = new VOTE_DATABASE_MODELS[oppositeVoteType](voteData)
            await dbVote.save()

            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();
            const oppositeVotes = await VOTE_DATABASE_MODELS[oppositeVoteType].find({}).lean();

            expect(response.statusCode).toBe(200);
            expect(votes).toHaveLength(1);
            expect(oppositeVotes).toHaveLength(0);
            expect(await DB.changedCollections()).toIncludeSameMembers(['Upvote', 'Downvote'])
        })

        test(`${voteType}vote on ${postFormat} post does not modify other votes in the database`, async () => {
            expect.assertions(4);

            await new User(postCreatorData).save()
            await new User(voterData).save()
            await new POST_DATABASE_MODELS[postFormat](postData).save()

            const votes = Array.from(new Array(10)).map((item, index) => {
                return {
                    postFormat,
                    interactionDate: 1,
                    userPublicId: crypto.randomUUID(),
                    postId: postData._id
                }
            })

            const upvotes = votes.slice(0, 5)
            const downvotes = votes.slice(0, 5)

            await Upvote.insertMany(upvotes)
            await Downvote.insertMany(downvotes)

            await DB.takeDBSnapshot()

            const beforeUpvotes = await Upvote.find().lean();
            const beforeDownvotes = await Downvote.find().lean();

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType})

            const afterUpvotes = await Upvote.find({_id: {$in: beforeUpvotes.map(vote => vote._id)}}).lean()
            const afterDownvotes = await Downvote.find({_id: {$in: beforeDownvotes.map(vote => vote._id)}}).lean()

            expect(response.statusCode).toBe(200);
            expect(afterUpvotes).toStrictEqual(beforeUpvotes);
            expect(afterDownvotes).toStrictEqual(beforeDownvotes);
            expect(await DB.changedCollections()).toIncludeSameMembers([`${voteType}vote`])
        })

        for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
            test(`Vote on post should fail when userId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
                expect.assertions(5);
        
                await DB.takeDBSnapshot()
        
                const invalidToken = 'Bearer ' + jwt.sign({_id: notString}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})
        
                const response = await supertest(server)
                .post('/tempRoute/voteonpost')
                .set('auth-web-token', invalidToken)
                .send({postId: postData._id, postFormat, voteType})
            
                const downvotes = await Downvote.find({}).lean();
                const upvotes = await Upvote.find({}).lean();
            
                expect(response.statusCode).toBe(400);
                expect(response.body.message).toBe(`userId must be a string. Provided type: ${typeof notString}`)
                expect(downvotes).toHaveLength(0);
                expect(upvotes).toHaveLength(0);
                expect(await DB.noChangesMade()).toBe(true)
            })

            test(`Vote on post should fail when postId is not a string. Testing: ${JSON.stringify(notString)}`, async () => {
                expect.assertions(5);
        
                await DB.takeDBSnapshot()

                const response = await supertest(server)
                .post('/tempRoute/voteonpost')
                .set('auth-web-token', validToken)
                .send({postId: notString, postFormat, voteType})
            
                const downvotes = await Downvote.find({}).lean();
                const upvotes = await Upvote.find({}).lean();
            
                expect(response.statusCode).toBe(400)
                expect(response.body.message).toBe(`postId must be a string. Provided type: ${typeof notString}`)
                expect(downvotes).toHaveLength(0);
                expect(upvotes).toHaveLength(0);
                expect(await DB.noChangesMade()).toBe(true)
            })
        }

        test(`Vote on post should fail when userId is not an objectId`, async () => {
            expect.assertions(5);
        
            await DB.takeDBSnapshot()

            const invalidToken = 'Bearer ' + jwt.sign({_id: 'iamnotanobjectid'}, process.env.SECRET_FOR_TOKENS, {expiresIn: '2y'})

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', invalidToken)
            .send({postId: postData._id, postFormat, voteType})
        
            const downvotes = await Downvote.find({}).lean();
            const upvotes = await Upvote.find({}).lean();
        
            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe(`userId must be an objectId`)
            expect(downvotes).toHaveLength(0);
            expect(upvotes).toHaveLength(0);
            expect(await DB.noChangesMade()).toBe(true)
        })

        test(`Vote on post should fail when postId is not an objectId`, async () => {
            expect.assertions(5);
        
            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: 'iamnotanobjectid', postFormat, voteType})
        
            const downvotes = await Downvote.find({}).lean();
            const upvotes = await Upvote.find({}).lean();
        
            expect(downvotes).toHaveLength(0);
            expect(upvotes).toHaveLength(0);
            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe("postId must be an objectId");
            expect(await DB.noChangesMade()).toBe(true)
        })
    }
}

for (const invalidFormat of invalidPostFormats) {
    for (const voteType of votes) {
        test(`Vote on post should fail when postFormat is invalid. Invalid format: ${invalidFormat}. voteType: ${voteType}`, async () => {
            expect.assertions(5);
    
            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat: invalidFormat, voteType})
    
            const downvotes = await Downvote.find({}).lean();
            const upvotes = await Upvote.find({}).lean();
    
            expect(downvotes).toHaveLength(0);
            expect(upvotes).toHaveLength(0);
            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe(`postFormat is invalid. Valid post formats: ${formats.join(', ')}`)
            expect(await DB.noChangesMade()).toBe(true)
        })
    }
}

for (const invalidVoteType of invalidVoteTypes) {
    for (const postFormat of formats) {
        test(`Vote on post should fail when voteType is invalid. Invalid type: ${invalidVoteType}. Post format: ${postFormat}`, async () => {
            expect.assertions(5);
    
            await DB.takeDBSnapshot()

            const response = await supertest(server)
            .post('/tempRoute/voteonpost')
            .set('auth-web-token', validToken)
            .send({postId: postData._id, postFormat, voteType: invalidVoteType})
    
            const downvotes = await Downvote.find({}).lean();
            const upvotes = await Upvote.find({}).lean();
    
            expect(downvotes).toHaveLength(0);
            expect(upvotes).toHaveLength(0);
            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe(`voteType is invalid. Valid vote types: ${votes.join(', ')}`)
            expect(await DB.noChangesMade()).toBe(true)
        })
    }
}