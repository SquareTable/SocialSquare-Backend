const mongoose = require('mongoose');
const User = require('../../models/User');
const MockMongoDBServer = require('../../libraries/MockDBServer');
const TempController = require('../../controllers/Temp')

const ImagePost = require('../../models/ImagePost')
const Poll = require('../../models/Poll')
const Thread = require('../../models/Thread')
const Comment = require('../../models/Comment');
const Upvote = require('../../models/Upvote');
const Downvote = require('../../models/Downvote');

const {expect} = require('@jest/globals')

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

/*
API Tests:
Test if votes work for non-private non-blocked accounts
Test if votes work for private accounts where the voter is following the private account
Test if voting fails if userId is not a string
Test if voting fails if userId is not an objectId
Test if voting fails if postId is not a string
Test if voting fails if postId is not an objectId
Test if voting fails if postFormat is not a valid format
Test if voting fails if voteType is not a valid type
Test if voting fails if voter's account could not be found
Test if voting fails if post could not be found
Test if voting fails when post owner could not be found
Test if voting fails if the account is blocked
Test if voting fails if the post owner account is private and the user is not following them
Test votes do not get duplicated in database
Test opposite vote types get removed from database when making a vote (upvote gets deleted when making a downvote and vice versa)
*/

const formats = ["Image", "Poll", "Thread"]
const votes = ["Up", "Down"]

for (const format of formats) {
    for (const voteType of votes) {
        const oppositeVoteType = voteType === "Up" ? "Down" : "Up";

        test(`${voteType}vote on ${format} post is successful when post owner account is public and has no blocked accounts`, async () => {
            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postOwner = new User({
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: false
            })

            const requester = new User({
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            })

            await postOwner.save();
            await requester.save();

            const postData = {_id: "6537f617a17d1f6a636e7d39"};
            postData.creatorId = postOwner._id;

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(requester._id, postData._id, format, voteType)

            expect(returned.statusCode).toBe(200);

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(votes).toHaveLength(1)

            const vote = votes[0];

            expect(vote).toHaveProperty('_id')
            expect(vote.interactionDate < Date.now() && vote.interactionDate > Date.now() - 1000 * 100).toBe(true) //interaction date is between now and 100 seconds before - gives plenty of time for test to run

            delete vote._id;
            delete vote.interactionDate;

            
            expect(vote).toBe({
                __v: 0,
                postId: postData._id,
                postFormat: format,
                userPublicId: requester.secondId
            })

            await mongoose.disconnect();
            await DB.stopServer();
        })


        test(`${voteType}vote on ${format} post is successful when post owner account has no blocked accounts and is private, but voter is following post owner account`, async () => {
            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postOwner = new User({
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: true,
                followers: [
                    "c709e918-f43a-4b90-a35a-36d8a6193431"
                ]
            })

            const requester = new User({
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            })

            await postOwner.save();
            await requester.save();

            const postData = {_id: "6537f617a17d1f6a636e7d39"};
            postData.creatorId = postOwner._id;

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(requester._id, postData._id, format, voteType)

            expect(returned.statusCode).toBe(200);

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(votes).toHaveLength(1)

            const vote = votes[0];

            expect(vote).toHaveProperty('_id')
            expect(vote.interactionDate < Date.now() && vote.interactionDate > Date.now() - 1000 * 100).toBe(true) //interaction date is between now and 100 seconds before - gives plenty of time for test to run

            delete vote._id;
            delete vote.interactionDate;

            
            expect(vote).toBe({
                __v: 0,
                postId: postData._id,
                postFormat: format,
                userPublicId: requester.secondId
            })

            await mongoose.disconnect();
            await DB.stopServer();
        })

        test(`${voteType}vote on ${format} post fails when voter account could not be found`, async () => {
            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const returned = await TempController.voteonpost("6537dd49d1866f60dbf58d1f", '', '', '')

            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find user with provided userId")

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(votes).toHaveLength(0)

            await mongoose.disconnect();
            await DB.stopServer();
        })

        test(`${voteType}vote on ${format} post fails if post could not be found`, async () => {
            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const requester = new User({
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            })

            await requester.save();

            const returned = await TempController.voteonpost("6537dd49d1866f60dbf58d1f", "6537f617a17d1f6a636e7d39", format, voteType)

            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find post")

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(votes).toHaveLength(0)

            await mongoose.disconnect();
            await DB.stopServer();
        })

        test(`${voteType}vote on ${format} post fails when post owner could not be found`, async () => {
            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const requester = new User({
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            })

            await postOwner.save();
            await requester.save();

            const postData = {
                _id: "6537f617a17d1f6a636e7d39",
                creatorId: "6537d7c2519e591b466c198f"
            };

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(requester._id, postData._id, format, voteType)

            expect(returned.statusCode).toBe(200);
            expect(returned.data.message).toBe("Could not find post owner")

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(votes).toHaveLength(0)

            await mongoose.disconnect();
            await DB.stopServer();
        })

        test(`${voteType}vote on ${format} post fails when the voter is blocked by the post owner`, async () => {
            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postOwner = new User({
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: ["c709e918-f43a-4b90-a35a-36d8a6193431"],
                privateAccount: false
            })

            const requester = new User({
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            })

            await postOwner.save();
            await requester.save();

            const postData = {
                _id: "6537f617a17d1f6a636e7d39",
                creatorId: postOwner._id
            };

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(requester._id, postData._id, format, voteType)

            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find post")

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(votes).toHaveLength(0)

            await mongoose.disconnect();
            await DB.stopServer();
        })

        test(`${voteType}vote on ${format} post fails when the post owner has a private account and the voter is not following them`, async () => {
            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postOwner = new User({
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: true,
                followers: []
            })

            const requester = new User({
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            })

            await postOwner.save();
            await requester.save();

            const postData = {
                _id: "6537f617a17d1f6a636e7d39",
                creatorId: postOwner._id
            };

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(requester._id, postData._id, format, voteType)

            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find post")

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(votes).toHaveLength(0)

            await mongoose.disconnect();
            await DB.stopServer();
        })

        test(`${voteType}votes on ${format} post do not get duplicated`, async () => {
            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postOwner = new User({
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: false
            })

            const requester = new User({
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            })

            await postOwner.save();
            await requester.save();

            const postData = {_id: "6537f617a17d1f6a636e7d39"};
            postData.creatorId = postOwner._id;

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const voteData = {
                postId: postData._id,
                postFormat: format,
                interactionDate: 1,
                userPublicId: requester.secondId
            }

            const dbVote = new VOTE_DATABASE_MODELS[voteType](voteData)
            await dbVote.save()

            const returned = await TempController.voteonpost(requester._id, postData._id, format, voteType)

            expect(returned.statusCode).toBe(200);

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(votes).toHaveLength(1)

            const vote = votes[0];

            expect(vote).toHaveProperty('_id')
            expect(vote.interactionDate < Date.now() && vote.interactionDate > Date.now() - 1000 * 100).toBe(true) //interaction date is between now and 100 seconds before - gives plenty of time for test to run

            delete vote._id;
            delete vote.interactionDate;

            
            expect(vote).toBe({
                __v: 0,
                postId: postData._id,
                postFormat: format,
                userPublicId: requester.secondId
            })

            await mongoose.disconnect();
            await DB.stopServer();
        })

        test(`${oppositeVoteType}votes on ${format} post get deleted when making a ${voteType}vote`, async () => {
            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postOwner = new User({
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: false
            })

            const requester = new User({
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            })

            await postOwner.save();
            await requester.save();

            const postData = {_id: "6537f617a17d1f6a636e7d39"};
            postData.creatorId = postOwner._id;

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const voteData = {
                postId: postData._id,
                postFormat: format,
                interactionDate: 1,
                userPublicId: requester.secondId
            }

            const dbVote = new VOTE_DATABASE_MODELS[oppositeVoteType](voteData)
            await dbVote.save()

            const returned = await TempController.voteonpost(requester._id, postData._id, format, voteType)

            expect(returned.statusCode).toBe(200);

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();
            const oppositeVotes = await VOTE_DATABASE_MODELS[oppositeVoteType].find({}).lean();

            expect(votes).toHaveLength(1)
            expect(oppositeVotes).toHaveLength(0)

            await mongoose.disconnect();
            await DB.stopServer();
        })
    }
}

test(`Vote on post should fail when userId is not a string`, async () => {
    const DB = new MockMongoDBServer()
    const uri = await DB.startServer();

    await mongoose.connect(uri);

    const returned = await TempController.voteonpost(true, '', '', '')

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe(`userId must be a string. Provided type: boolean`)

    const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

    expect(votes).toHaveLength(0)

    await mongoose.disconnect();
    await DB.stopServer();
})

test(`Vote on post should fail when userId is not an objectId`, async () => {
    const DB = new MockMongoDBServer()
    const uri = await DB.startServer();

    await mongoose.connect(uri);
    
    const returned = await TempController.voteonpost('i am not an objectId', '', '', '')

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe(`userId must be an objectId`)

    const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

    expect(votes).toHaveLength(0)

    await mongoose.disconnect();
    await DB.stopServer();
})

test(`Vote on post should fail when postId is not a string`, async () => {
    const DB = new MockMongoDBServer()
    const uri = await DB.startServer();

    await mongoose.connect(uri);

    const returned = await TempController.voteonpost("6537f617a17d1f6a636e7d39", true, '', '')

    expect(returned.statusCode).toBe(400)
    expect(returned.data.message).toBe(`postId must be a string. Provided type: boolean`)

    const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

    expect(votes).toHaveLength(0)

    await mongoose.disconnect();
    await DB.stopServer();
})


test(`Vote on post should fail when postId is not an objectId`, async () => {
    const DB = new MockMongoDBServer()
    const uri = await DB.startServer();

    await mongoose.connect(uri);

    const returned = await TempController.voteonpost("6537f617a17d1f6a636e7d39", "i am not an objectId", '', '')

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("postId must be an objectId")

    const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

    expect(votes).toHaveLength(0)

    await mongoose.disconnect();
    await DB.stopServer();
})

for (const invalidFormat of ["image", "poll", "thread", "non-existent-post", "IMAGE", 'POLL', 'THREAD']) {
    test(`Vote on post should fail when postFormat is invalid. Invalid format: ${invalidFormat}`, async () => {
        const DB = new MockMongoDBServer()
        const uri = await DB.startServer();

        await mongoose.connect(uri);

        const returned = await TempController.voteonpost("6537f617a17d1f6a636e7d39", "6537f617a17d1f6a636e7d39", invalidFormat, '')

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`postFormat is invalid. Valid post formats: ${formats.join(', ')}`)

        const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

        expect(votes).toHaveLength(0)

        await mongoose.disconnect();
        await DB.stopServer();
    })
}

for (const invalidVoteType of ["UP", "DOWN", "up", "down", "invalidtype"]) {
    test(`Vote on post should fail when voteType is invalid. Invalid type: ${invalidVoteType}`, async () => {
        const DB = new MockMongoDBServer()
        const uri = await DB.startServer();

        await mongoose.connect(uri);

        const returned = await TempController.voteonpost("6537f617a17d1f6a636e7d39", "6537f617a17d1f6a636e7d39", "Image", invalidVoteType)

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`voteType is invalid. Valid post formats: ${votes.join(', ')}`)

        const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

        expect(votes).toHaveLength(0)

        await mongoose.disconnect();
        await DB.stopServer();
    })
}