//This is the OneTimeExecuteCode for moving comments from being an array inside of a post document to being its own collection

const ImagePost = require('../models/ImagePost');
const Poll = require('../models/Poll');
const Thread = require('../models/Thread');
const Comment = require('../models/Comment');
const mongoose = require('mongoose');

//Usually we would have to implement functionality for comment replies, but as of writing this code, no comment replies have been made.
//For the sake of simplicity, comment reply transfers will be ignored (since there are none)

Promise.all([
    ImagePost.find({"comments.0": {$exists: true}}).lean(),
    Poll.find({"comments.0": {$exists: true}}).lean(),
    Thread.find({"comments.0": {$exists: true}}).lean()
]).then(([images, polls, threads]) => {
    const updates = [];

    for (const image of images) {
        for (const comment of image.comments) {
            updates.push({
                commenterId: comment.commenterId,
                text: comment.commentsText,
                datePosted: comment.datePosted,
                postId: image._id,
                postFormat: "Image",
                replies: 0
            })
        }
    }

    for (const poll of polls) {
        for (const comment of poll.comments) {
            updates.push({
                commenterId: comment.commenterId,
                text: comment.commentsText,
                datePosted: comment.datePosted,
                postId: poll._id,
                postFormat: "Poll",
                replies: 0
            })
        }
    }

    for (const thread of threads) {
        for (const comment of thread.comments) {
            updates.push({
                commenterId: comment.commenterId,
                text: comment.commentsText,
                datePosted: comment.datePosted,
                postId: thread._id,
                postFormat: "Thread",
                replies: 0
            })
        }
    }

    mongoose.startSession().then(session => {
        session.startTransaction();

        Promise.all([
            Comment.insertMany(updates, {session}),
            ImagePost.findOneAndUpdate({}, {$unset: {comments: ""}}, {session}),
            Poll.findOneAndUpdate({}, {$unset: {comments: ""}}, {session}),
            Thread.findOneAndUpdate({}, {$unset: {comments: ""}}, {session})
        ]).then(() => {
            session.commitTransaction().then(() => {
                session.endSession().then(() => {
                    console.log('Successfully transferred', updates.length, 'comments into the Comment collection!')
                }).catch(error => {
                    console.error('An erorr occurred while ending Mongoose session:', error)
                })
            }).catch(error => {
                console.error('An error occurred while committing comment transfer transaction:', error)
                session.endSession().catch(error => {
                    console.error('An error occurred while ending Mongoose session:', error)
                })
            })
        }).catch(error => {
            console.error('An error occurred while making comment transfer database operations:', error)
            session.endSession().catch(error => {
                console.error('An error occurred while ending Mongoose session:', error)
            })
        })
    }).catch(error => {
        console.error('An error occurred while starting Mongoose session:', error)
    })
}).catch(error => {
    console.error('An error occurred while getting images, polls, and threads:', error)
})