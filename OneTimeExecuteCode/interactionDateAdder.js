/*
const mongodb = require('mongodb');

const { generateTwoDigitDate } = require('./../generateTwoDigitDate')

//Schemas
const User = require('./../models/User');
const Poll = require('./../models/Poll');
const ImagePost = require('./../models/ImagePost');
const Category = require('./../models/Category');
const Thread = require('./../models/Thread')

// Get the objectID type
var ObjectID = require('mongodb').ObjectID;

function interactionDateAdder() {
    const currentDate = generateTwoDigitDate()
    /*
        ImagePost.find({}).then(imagePosts => {
            if (imagePosts.length) {
                imagePosts.forEach(function(item, index) {
                    //console.log(imagePosts[index])
                    //const idIncase = new ObjectID(imagePosts[index].imageCreatorId)
                    //console.log(idIncase + " " + imagePosts[index].imageCreatorId)
                    
                    //const imagePostsUpVotesWithDates = imagePosts[index].imageUpVotes.map((i) => { return {"userId": i, interactionDate: currentDate} })
                    //const imagePostsDownVotesWithDates = imagePosts[index].imageDownVotes.map((i) => { return {"userId": i, interactionDate: currentDate}})
                    //console.log(imagePostsUpVotesWithDates)
                    ImagePost.findOneAndUpdate({_id: imagePosts[index]._id}, {$set: { comments: [] }}).then(function() {
                        console.log(`image interactions updated for ${imagePosts[index]._id} / ${imagePosts[index].imageTitle}.`)
                    })
                    
                    ImagePost.findOneAndUpdate({_id: imagePosts[index]._id}, {$unset: { imageUpVotes: "", imageDownVotes: "", imageComments: "", imageCreatorId: "" }}).then(function() {
                        ImagePost.findOneAndUpdate({_id: imagePosts[index]._id}, {$set: { upVotes: imagePostsUpVotesWithDates, downVotes: imagePostsDownVotesWithDates, comments: [], creatorId: idIncase }}).then(function() {
                            console.log(`image interactions updated for ${imagePosts[index]._id} / ${imagePosts[index].imageTitle}.`)
                        })
                    })
                    
                })
            } else {
                console.log("No imageposts?")
            }
        }).catch(err => {
            console.log("Oopsies")
            console.log(err)
        })
    */
    /*
    Poll.find({}).then(pollPosts => {
        if (pollPosts.length) {
            pollPosts.forEach(function(item, index) {
                //console.log(pollPosts[index])
                const idIncase = new ObjectID(pollPosts[index].pollCreatorId)
                //console.log(idIncase + " " + pollPosts[index].pollCreatorId)
                
                const pollPostsUpVotesWithDates = pollPosts[index].pollUpVotes.map((i) => { return {"userId": i, interactionDate: currentDate} })
                const pollPostsDownVotesWithDates = pollPosts[index].pollDownVotes.map((i) => { return {"userId": i, interactionDate: currentDate}})

                
                Poll.findOneAndUpdate({_id: pollPosts[index]._id}, {$unset: { pollUpVotes: "", pollDownVotes: "", pollComments: "", pollCreatorId: "" }}).then(function() {
                    Poll.findOneAndUpdate({_id: pollPosts[index]._id}, {$set: { upVotes: pollPostsUpVotesWithDates, downVotes: pollPostsDownVotesWithDates, comments: [], creatorId: idIncase }}).then(function() {
                        console.log(`poll interactions updated for ${pollPosts[index]._id} / ${pollPosts[index].pollTitle}.`)
                    })
                })
                
            })
        } else {
            console.log("No pollposts?")
        }
    }).catch(err => {
        console.log("Oopsies")
        console.log(err)
    })
    */
   /*
    Thread.find({}).then(threadPosts => {
        if (threadPosts.length) {
            threadPosts.forEach(function(item, index) {
                //console.log(threadPosts[index])
                
                const threadPostsUpVotesWithDates = threadPosts[index].threadUpVotes.map((i) => { return {"userId": i, interactionDate: currentDate} })
                const threadPostsDownVotesWithDates = threadPosts[index].threadDownVotes.map((i) => { return {"userId": i, interactionDate: currentDate}})

                
                Thread.findOneAndUpdate({_id: threadPosts[index]._id}, {$unset: { threadUpVotes: "", threadDownVotes: "", threadComments: ""}}).then(function() {
                    Thread.findOneAndUpdate({_id: threadPosts[index]._id}, {$set: { upVotes: threadPostsUpVotesWithDates, downVotes: threadPostsDownVotesWithDates, comments: []}}).then(function() {
                        console.log(`thread interactions updated for ${threadPosts[index]._id} / ${threadPosts[index].threadTitle}.`)
                    })
                })
                
            })
        } else {
            console.log("No threadposts?")
        }
    }).catch(err => {
        console.log("Oopsies")
        console.log(err)
    })
    */
/*
}

exports.interactionDateAdder = interactionDateAdder
*/