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

jest.setTimeout(20_000); //20 seconds per test

/*
API Tests:
Test if votes work for non-private non-blocked accounts when voter is not the post creator
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

const NOT_STRINGS = [true, false, undefined, null, {}, [], 1, -1];
const invalidPostFormats = ["IMAGE", "POLL", "THREAD", "image", "poll", "thread", "iMage", "pOll", "tHread", 'not a post at all']
const invalidVoteTypes = ["UP", "DOWN", 'up', 'down', 'not a type at all']

for (const format of formats) {
    for (const voteType of votes) {
        const oppositeVoteType = voteType === "Up" ? "Down" : "Up";

        test(`${voteType}vote on ${format} post is successful when post creator account is public and has no blocked accounts`, async () => {
            expect.assertions(5);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postcreatorData = {
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: false
            };

            const voterData = {
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            };

            const postcreator = new User(postcreatorData)

            const voter = new User(voterData)

            await postcreator.save();
            await voter.save();

            const postData = {_id: "6537f617a17d1f6a636e7d39"};
            postData.creatorId = postcreator._id;

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(voterData._id, postData._id, format, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            const vote = votes[0];

            const newVote = {...vote};

            delete newVote._id;
            delete newVote.interactionDate;
            newVote.postId = String(newVote.postId);

            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(200);
            expect(votes).toHaveLength(1);
            expect(vote).toHaveProperty('_id');
            expect(vote.interactionDate < Date.now() && vote.interactionDate > Date.now() - 1000 * 100).toBe(true); //interaction date is between now and 100 seconds before - gives plenty of time for test to run
            expect(newVote).toStrictEqual({
                __v: 0,
                postId: postData._id,
                postFormat: format,
                userPublicId: voter.secondId
            });
        })

        test(`${voteType}vote on ${format} post fails when the voter is the post creator`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const voterData = {
                _id: "6537d7c2519e591b466c198f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431",
                blockedAccounts: [],
                privateAccount: false
            };

            const voter = new User(voterData)

            await voter.save();

            const postData = {
                _id: "6537f617a17d1f6a636e7d39",
                creatorId: voterData._id
            };

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(voterData._id, postData._id, format, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();


            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(403);
            expect(returned.data.message).toBe("You cannot vote on your own post.")
            expect(votes).toHaveLength(0);
        })


        test(`${voteType}vote on ${format} post is successful when post creator account has no blocked accounts and is private, but voter is following post creator account`, async () => {
            expect.assertions(5);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postcreatorData = {
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: true,
                followers: [
                    "c709e918-f43a-4b90-a35a-36d8a6193431"
                ]
            };

            const voterData = {
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            };

            const postcreator = new User(postcreatorData)

            const voter = new User(voterData)

            await postcreator.save();
            await voter.save();

            const postData = {_id: "6537f617a17d1f6a636e7d39"};
            postData.creatorId = postcreatorData._id;

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(voterData._id, postData._id, format, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            const vote = votes[0];

            const newVote = {...vote};

            delete newVote._id;
            delete newVote.interactionDate;
            newVote.postId = String(newVote.postId)

            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(200);
            expect(votes).toHaveLength(1);
            expect(vote).toHaveProperty('_id');
            expect(vote.interactionDate < Date.now() && vote.interactionDate > Date.now() - 1000 * 100).toBe(true); //interaction date is between now and 100 seconds before - gives plenty of time for test to run
            expect(newVote).toStrictEqual({
                __v: 0,
                postId: postData._id,
                postFormat: format,
                userPublicId: voter.secondId
            });
        })

        test(`${voteType}vote on ${format} post fails when voter account could not be found`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const returned = await TempController.voteonpost("6537dd49d1866f60dbf58d1f", '6537f617a17d1f6a636e7d39', format, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find user with provided userId");
            expect(votes).toHaveLength(0);
        })

        test(`${voteType}vote on ${format} post fails if post could not be found`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const voterData = {
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            };

            const voter = new User(voterData)

            await voter.save();

            const returned = await TempController.voteonpost(voterData._id, "6537f617a17d1f6a636e7d39", format, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find post");
            expect(votes).toHaveLength(0);
        })

        test(`${voteType}vote on ${format} post fails when post creator could not be found`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const voterData = {
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            };

            const voter = new User(voterData)

            await voter.save();

            const postData = {
                _id: "6537f617a17d1f6a636e7d39",
                creatorId: "6537d7c2519e591b466c198f"
            };

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(voterData._id, postData._id, format, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find post creator");
            expect(votes).toHaveLength(0);
        })

        test(`${voteType}vote on ${format} post fails when the voter is blocked by the post creator`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postcreatorData = {
                _id: "6537d7c2519e591b466c197f",
                blockedAccounts: ["c709e918-f43a-4b90-a35a-36d8a6193431"],
                privateAccount: false
            };

            const voterData = {
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            };

            const postcreator = new User(postcreatorData)

            const voter = new User(voterData)

            await postcreator.save();
            await voter.save();

            const postData = {
                _id: "6537f617a17d1f6a636e7d39",
                creatorId: postcreatorData._id
            };

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(voterData._id, postData._id, format, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find post");
            expect(votes).toHaveLength(0);
        })

        test(`${voteType}vote on ${format} post fails when the post creator has a private account and the voter is not following them`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postcreatorData = {
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: true,
                followers: []
            };
            
            const voterData = {
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            };

            const postcreator = new User(postcreatorData)

            const voter = new User(voterData)

            await postcreator.save();
            await voter.save();

            const postData = {
                _id: "6537f617a17d1f6a636e7d39",
                creatorId: postcreatorData._id
            };

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const returned = await TempController.voteonpost(voterData._id, postData._id, format, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find post");
            expect(votes).toHaveLength(0);
        })

        test(`${voteType}votes on ${format} post do not get duplicated`, async () => {
            expect.assertions(5);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postcreatorData = {
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: false
            };

            const voterData = {
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            };

            const postcreator = new User(postcreatorData);

            const voter = new User(voterData);

            await postcreator.save();
            await voter.save();

            const postData = {_id: "6537f617a17d1f6a636e7d39"};
            postData.creatorId = postcreator._id;

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const voteData = {
                postId: postData._id,
                postFormat: format,
                interactionDate: 1,
                userPublicId: voter.secondId
            }

            const dbVote = new VOTE_DATABASE_MODELS[voteType](voteData)
            await dbVote.save()

            const returned = await TempController.voteonpost(voterData._id, postData._id, format, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            const vote = votes[0];

            const newVote = {...vote};

            delete newVote._id;
            delete newVote.interactionDate;
            newVote.postId = String(newVote.postId);

            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(200);
            expect(votes).toHaveLength(1);
            expect(vote).toHaveProperty('_id')
            expect(vote.interactionDate < Date.now() && vote.interactionDate > Date.now() - 1000 * 100).toBe(true) //interaction date is between now and 100 seconds before - gives plenty of time for test to run        
            expect(newVote).toStrictEqual({
                __v: 0,
                postId: postData._id,
                postFormat: format,
                userPublicId: voter.secondId
            })
        })

        test(`${oppositeVoteType}votes on ${format} post get deleted when making a ${voteType}vote`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postcreatorData = {
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: false
            };

            const voterData = {
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            };

            const postcreator = new User(postcreatorData)

            const voter = new User(voterData)

            await postcreator.save();
            await voter.save();

            const postData = {_id: "6537f617a17d1f6a636e7d39"};
            postData.creatorId = postcreator._id;

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const voteData = {
                postId: postData._id,
                postFormat: format,
                interactionDate: 1,
                userPublicId: voter.secondId
            }

            const dbVote = new VOTE_DATABASE_MODELS[oppositeVoteType](voteData)
            await dbVote.save()

            const returned = await TempController.voteonpost(voterData._id, postData._id, format, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();
            const oppositeVotes = await VOTE_DATABASE_MODELS[oppositeVoteType].find({}).lean();

            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(200);
            expect(votes).toHaveLength(1);
            expect(oppositeVotes).toHaveLength(0);
        })

        test(`${voteType}vote on ${format} post does not modify other votes in the database`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer()
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const postcreatorData = {
                _id: "6537d7c2519e591b466c198f",
                blockedAccounts: [],
                privateAccount: false
            };

            const voterData = {
                _id: "6537dd49d1866f60dbf58d1f",
                secondId: "c709e918-f43a-4b90-a35a-36d8a6193431"
            };

            const postcreator = new User(postcreatorData)

            const voter = new User(voterData)

            await postcreator.save();
            await voter.save();

            const postData = {_id: "6537f617a17d1f6a636e7d39"};
            postData.creatorId = postcreator._id;

            const post = new POST_DATABASE_MODELS[format](postData)
            await post.save();

            const upvotesToInsert = [
                {
                    postId: "6537f617a17d1f6a636e7d39",
                    postFormat: format,
                    interactionDate: 1,
                    userPublicId: "d709e918-f43a-4b90-a35a-36d8a6193432",
                    __v: 0,
                    _id: "65390ffcae8a0231facea8de"
                },
                {
                    postId: "6537f617a17d1f6a636e7d39",
                    postFormat: format,
                    interactionDate: 2,
                    userPublicId: "e709e918-f43a-4b90-a35a-36d8a6193433",
                    __v: 0,
                    _id: "65390ffcae8a0231facea8df"
                },
                {
                    postId: "6537f617a17d1f6a636e7d39",
                    postFormat: format,
                    interactionDate: 3,
                    userPublicId: "f709e918-f43a-4b90-a35a-36d8a6193434",
                    __v: 0,
                    _id: "65390ffcae8a0231facea8d0"
                },
            ]

            const downvotesToInsert = [
                {
                    postId: "6537f617a17d1f6a636e7d39",
                    postFormat: format,
                    interactionDate: 1,
                    userPublicId: "a709e918-f43a-4b90-a35a-36d8a6193434",
                    __v: 0,
                    _id: "65390ffcae8a0231facea8d1"
                },
                {
                    postId: "6537f617a17d1f6a636e7d39",
                    postFormat: format,
                    interactionDate: 2,
                    userPublicId: "b709e918-f43a-4b90-a35a-36d8a6193435",
                    __v: 0,
                    _id: "65390ffcae8a0231facea8d2"
                },
                {
                    postId: "6537f617a17d1f6a636e7d39",
                    postFormat: format,
                    interactionDate: 3,
                    userPublicId: "c709e918-f43a-4b90-a35a-36d8a6193436",
                    __v: 0,
                    _id: "65390ffcae8a0231facea8d3"
                },
            ]

            await Upvote.insertMany(upvotesToInsert)
            await Downvote.insertMany(downvotesToInsert)

            const returned = await TempController.voteonpost(voterData._id, postData._id, format, voteType)

            const upvotes = await Upvote.find({interactionDate: {$lt: 100}}).sort({interactionDate: 1}).lean();
            const downvotes = await Downvote.find({interactionDate: {$lt: 100}}).sort({interactionDate: 1}).lean();

            objectIdStringifiedUpvotes = upvotes.map(vote => ({...vote, _id: String(vote._id), postId: String(vote.postId)}))
            objectIdStringifiedDownvotes = downvotes.map(vote => ({...vote, _id: String(vote._id), postId: String(vote.postId)}))

            await mongoose.disconnect();
            await DB.stopServer();

            expect(returned.statusCode).toBe(200);
            expect(objectIdStringifiedUpvotes).toStrictEqual(upvotesToInsert);
            expect(objectIdStringifiedDownvotes).toStrictEqual(downvotesToInsert);
        })
    }
}

for (const invalidUserId of NOT_STRINGS) {
    test(`Vote on post should fail when userId is not a string. Testing: ${JSON.stringify(invalidUserId)}`, async () => {
        expect.assertions(4);
    
        const DB = new MockMongoDBServer()
        const uri = await DB.startServer();
    
        await mongoose.connect(uri);
    
        const returned = await TempController.voteonpost(invalidUserId, '', '', '')
    
        const downvotes = await Downvote.find({}).lean();
        const upvotes = await Upvote.find({}).lean();
    
        await mongoose.disconnect();
        await DB.stopServer();
    
        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Provided type: ${typeof invalidUserId}`)
        expect(downvotes).toHaveLength(0);
        expect(upvotes).toHaveLength(0);
    })
}

test(`Vote on post should fail when userId is not an objectId`, async () => {
    expect.assertions(4);

    const DB = new MockMongoDBServer()
    const uri = await DB.startServer();

    await mongoose.connect(uri);
    
    const returned = await TempController.voteonpost('i am not an objectId', '', '', '')

    const downvotes = await Downvote.find({}).lean();
    const upvotes = await Upvote.find({}).lean();

    await mongoose.disconnect();
    await DB.stopServer();

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe(`userId must be an objectId`)
    expect(downvotes).toHaveLength(0);
    expect(upvotes).toHaveLength(0);
})

for (const invalidPostId of NOT_STRINGS) {
    test(`Vote on post should fail when postId is not a string. Testing: ${JSON.stringify(invalidPostId)}`, async () => {
        expect.assertions(4);
    
        const DB = new MockMongoDBServer()
        const uri = await DB.startServer();
    
        await mongoose.connect(uri);
    
        const returned = await TempController.voteonpost("6537f617a17d1f6a636e7d39", invalidPostId, '', '')
    
        const downvotes = await Downvote.find({}).lean();
        const upvotes = await Upvote.find({}).lean();
    
        await mongoose.disconnect();
        await DB.stopServer();
    
        expect(returned.statusCode).toBe(400)
        expect(returned.data.message).toBe(`postId must be a string. Provided type: ${invalidPostId}`)
        expect(downvotes).toHaveLength(0);
        expect(upvotes).toHaveLength(0);
    })
}


test(`Vote on post should fail when postId is not an objectId`, async () => {
    expect.assertions(4);

    const DB = new MockMongoDBServer()
    const uri = await DB.startServer();

    await mongoose.connect(uri);

    const returned = await TempController.voteonpost("6537f617a17d1f6a636e7d39", "i am not an objectId", '', '')

    const downvotes = await Downvote.find({}).lean();
    const upvotes = await Upvote.find({}).lean();

    await mongoose.disconnect();
    await DB.stopServer();

    expect(downvotes).toHaveLength(0);
    expect(upvotes).toHaveLength(0);
    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("postId must be an objectId");
})

for (const invalidFormat of invalidPostFormats) {
    test(`Vote on post should fail when postFormat is invalid. Invalid format: ${invalidFormat}`, async () => {
        expect.assertions(4);

        const DB = new MockMongoDBServer()
        const uri = await DB.startServer();

        await mongoose.connect(uri);

        const returned = await TempController.voteonpost("6537f617a17d1f6a636e7d39", "6537f617a17d1f6a636e7d39", invalidFormat, '')

        const downvotes = await Downvote.find({}).lean();
        const upvotes = await Upvote.find({}).lean();

        await mongoose.disconnect();
        await DB.stopServer();

        expect(downvotes).toHaveLength(0);
        expect(upvotes).toHaveLength(0);
        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`postFormat is invalid. Valid post formats: ${formats.join(', ')}`)
    })
}

for (const invalidVoteType of invalidVoteTypes) {
    test(`Vote on post should fail when voteType is invalid. Invalid type: ${invalidVoteType}`, async () => {
        expect.assertions(4);

        const DB = new MockMongoDBServer()
        const uri = await DB.startServer();

        await mongoose.connect(uri);

        const returned = await TempController.voteonpost("6537f617a17d1f6a636e7d39", "6537f617a17d1f6a636e7d39", "Image", invalidVoteType)

        const downvotes = await Downvote.find({}).lean();
        const upvotes = await Upvote.find({}).lean();

        await mongoose.disconnect();
        await DB.stopServer();


        expect(downvotes).toHaveLength(0);
        expect(upvotes).toHaveLength(0);
        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`voteType is invalid. Valid vote types: ${votes.join(', ')}`)
    })
}