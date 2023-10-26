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

const {v4: uuidv4} = require('uuid');

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

const NOT_STRINGS = [true, false, undefined, null, {}, [], 1, -1];
const invalidPostFormats = ["IMAGE", "POLL", "THREAD", "image", "poll", "thread", "iMage", "pOll", "tHread", 'not a post at all']
const invalidVoteTypes = ["UP", "DOWN", 'up', 'down', 'not a type at all']

jest.setTimeout(20_000); //20 seconds per test

/*
TODO:
Test if removing votes work for non-private non-blocked accounts when voter is not the post creator -- Done
Test if removing votes fails if the voter is the post creator -- Done
Test if removing votes works for private accounts where the voter is following the private account -- Done
Test if removing votes fails if userId is not a string -- Done
Test if removing votes fails if userId is not an objectId -- Done
Test if removing votes fails if postId is not a string -- Done
Test if removing votes fails if postId is not an objectId -- Done
Test if removing votes fails if postFormat is not a valid format -- Done
Test if removing votes fails if voteType is not a valid type -- Done
Test if removing votes fails if voter's account could not be found -- Done
Test if removing votes fails if post could not be found -- Done
Test if removing votes fails when post creator could not be found
Test if removing votes fails if the account is blocked
Test if removing votes fails if the post creator account is private and the user is not following them
Test that votes already in the database do not get modified by someone else removing a vote
*/

const formats = ["Image", "Poll", "Thread"]
const votes = ["Up", "Down"]

for (const postFormat of formats) {
    for (const voteType of votes) {
        test(`Removing ${voteType}vote on ${postFormat} post works for non-private accounts with no blocked accounts when voter is not the post creator`, async () => {
            expect.assertions(2);

            const DB = new MockMongoDBServer();
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const voterData = {
                _id: new mongoose.Types.ObjectId("653947b8cb8b8f978c670cd6"),
                secondId: "68b7962e-75f3-4c1f-b457-a112cc62a182"
            }

            const postCreator = {
                _id: new mongoose.Types.ObjectId("653947e4234a318b50cbde1a"),
                privateAccount: false,
                blockedAccounts: []
            }

            const postData = {
                _id: new mongoose.Types.ObjectId("65394836f449781b30a877e3"),
                creatorId: new mongoose.Types.ObjectId("653947e4234a318b50cbde1a")
            }

            const voteData = {
                postId: postData._id,
                postFormat: postFormat,
                interactionDate: Date.now(),
                userPublicId: voterData.secondId
            }

            await new User(voterData).save();
            await new User(postCreator).save();
            await new POST_DATABASE_MODELS[postFormat](postData).save();
            await new VOTE_DATABASE_MODELS[voteType](voteData).save();

            const returned = await TempController.removevoteonpost(String(voterData._id), String(postData._id), postFormat, voteType);

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(returned.statusCode).toBe(200);
            expect(votes).toHaveLength(0)
        })

        test(`Removing ${voteType}vote on ${postFormat} post fails if the voter is the post creator`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer();
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const voterData = {
                _id: new mongoose.Types.ObjectId("653a04087908fd746253de70"),
                secondId: "8ca634f8-9948-4188-99c5-bb1c3bdf52be",
                privateAccount: false,
                blockedAccounts: []
            }

            const postData = {
                _id: new mongoose.Types.ObjectId("653a04586cf2189ea9ec3a15"),
                creatorId: voterData._id
            }

            const voteData = { //People should not be able to make votes on their own posts, but this is just to check that the API does terminate when the post creator tries to remove a vote from their own post and it doesn't delete any votes
                postId: postData._id,
                postFormat: postFormat,
                interactionDate: Date.now(),
                userPublicId: voterData.secondId
            }

            await new User(voterData).save();
            await new POST_DATABASE_MODELS[postFormat](postData).save();
            await new VOTE_DATABASE_MODELS[voteType](voteData).save();

            const returned = await TempController.removevoteonpost(String(voterData._id), String(postData._id), postFormat, voteType);

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(returned.statusCode).toBe(403);
            expect(returned.data.message).toBe("You cannot remove a vote on your own post.")
            expect(votes).toHaveLength(1)
        })

        test(`Removing ${voteType}vote on ${postFormat} works for private accounts where the voter is following the private account`, async () => {
            expect.assertions(2);

            const DB = new MockMongoDBServer();
            const uri = DB.startServer();

            await mongoose.connect(uri);

            const voterData = {
                _id: new mongoose.Types.ObjectId("653a08018cb8adba90f4f270"),
                secondId: "d9f69b61-6f2f-4781-8802-47585b40b4da",
            };

            const postCreatorData = {
                _id: new mongoose.Types.ObjectId("653a0869ea622e157144a667"),
                privateAccount: true,
                followers: [voterData.secondId],
                blockedAccounts: []
            }

            const postData = {
                _id: new mongoose.Types.ObjectId("653a08ad8ac7e9f6315ca6ab"),
                creatorId: postCreatorData._id
            }

            const voteData = {
                postId: postData._id,
                postFormat,
                interactionDate: Date.now(),
                userPublicId: voterData.secondId
            }

            await new User(voterData).save();
            await new User(postCreatorData).save();
            await new POST_DATABASE_MODELS[postFormat](postData).save();
            await new VOTE_DATABASE_MODELS[voteType](voteData).save();

            const returned = await TempController.removevoteonpost(String(voterData._id), String(postData._id), postFormat, voteType);

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(returned.statusCode).toBe(200);
            expect(votes).toHaveLength(0);
        })

        test(`Removing ${voteType}vote on ${postFormat} post fails if voter's account could not be found`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer();
            const uri = await DB.startServer();
        
            await mongoose.connect(uri);
        
            const postCreatorData = {
                _id: new mongoose.Types.ObjectId("653a15bcc5114d375f7c3c7b"),
                secondId: "5a6c7c44-935a-430d-879e-9d71dbd32be7",
                privateAccount: false,
                blockedAccounts: []
            }
        
            const postData = {
                _id: new mongoose.Types.ObjectId("653a15f22331c3474a868bcd"),
                creatorId: postCreator._id
            }
        
            const voteData = {
                postId: postData._id,
                postFormat,
                interactionDate: Date.now(),
                userPublicId: "784f2944-82d5-4f43-ae3d-7cb250895271"
            }
        
            await new User(postCreatorData).save();
            await new POST_DATABASE_MODELS[postFormat](postData).save();
            await new VOTE_DATABASE_MODELS[voteType](voteData).save();
        
            const returned = await TempController.removevoteonpost("653a170faba7fac4c14dad8d", String(postData._id), postFormat, voteType);

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(votes).toHaveLength(1);
            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find user with provided userId.")
        })

        test(`If removing ${voteType}vote on ${postFormat} post fails if post could not be found`, async () => {
            expect.assertions(3);

            const DB = new MockMongoDBServer();
            const uri = await DB.startServer();

            await mongoose.connect(uri);

            const voterData = {
                _id: new mongoose.Types.ObjectId(),
                secondId: uuidv4()
            }

            const postCreatorData = {
                _id: new mongoose.Types.ObjectId(),
                secondId: uuidv4(),
                privateAccount: false,
                blockedAccounts: []
            }

            const voteData = {
                postId: new mongoose.Types.ObjectId(),
                postFormat,
                interactionDate: Date.now(),
                userPublicId: voterData.secondId
            }

            await new User(voterData).save();
            await new User(postCreatorData).save();
            await new VOTE_DATABASE_MODELS[voteType](voteData);

            const returned = await TempController.removevoteonpost(String(voterData._id), String(voteData.postId), postFormat, voteType)

            const votes = await VOTE_DATABASE_MODELS[voteType].find({}).lean();

            expect(returned.statusCode).toBe(404);
            expect(returned.data.message).toBe("Could not find post with postId.");
            expect(votes).toHaveLength(1);
        })

        test(`If removing ${voteType}vote on ${postFormat} post fails if post creator could not be found`, async () => {
            
        })
    }
}

for (const invalidUserId of NOT_STRINGS) {
    test(`if removing votes fails if userId is not a string. Testing: ${JSON.stringify(invalidUserId)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.removevoteonpost(invalidUserId, undefined, undefined, undefined);
    
        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`userId must be a string. Provided type: ${typeof invalidUserId}`)
    })
}

test('if removing votes fails if userId is not an objectId', async () => {
    expect.assertions(2);

    const returned = await TempController.removevoteonpost('i am not an objectId', undefined, undefined, undefined);

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("userId must be an objectId.")
})

for (const invalidPostId of NOT_STRINGS) {
    test(`if removing votes fails if postId is not a string. Testing: ${JSON.stringify(invalidPostId)}`, async () => {
        expect.assertions(2);

        const returned = await TempController.removevoteonpost("653a0ce6bae75d763b2ca607", invalidPostId, undefined, undefined)

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`postId must be a string. Provided type: ${typeof invalidPostId}`)
    })
}

test('if removing votes fails if postId is not an objectId', async () => {
    expect.assertions(2);

    const returned = await TempController.removevoteonpost("653a0ce6bae75d763b2ca607", 'i am not an objectId', undefined, undefined)

    expect(returned.statusCode).toBe(400);
    expect(returned.data.message).toBe("postId must be an objectId.")
})

for (const invalidFormat of invalidPostFormats) {
    test(`if removing votes fails if postFormat is invalid. Testing ${invalidFormat}`, async () => {
        expect.assertions(2);

        const returned = await TempController.removevoteonpost("653a0ce6bae75d763b2ca607", "653a0ce6bae75d763b2ca607", invalidFormat, undefined)

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`Invalid post format provided. Valid post formats: ${formats.join(', ')}`)
    })
}

for (const invalidVoteType of invalidVoteTypes) {
    test(`if removing votes fails if voteType is invalid. Testing ${invalidVoteType}`, async () => {
        expect.assertions(2);

        const returned = await TempController.removevoteonpost("653a0ce6bae75d763b2ca607", "653a0ce6bae75d763b2ca607", "Image", invalidVoteType)

        expect(returned.statusCode).toBe(400);
        expect(returned.data.message).toBe(`Invalid vote type provided. Valid vote types: ${votes.join(', ')}`)
    })
}