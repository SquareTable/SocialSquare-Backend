const Upvote = require('../models/Upvote')
const Downvote = require('../models/Downvote')
const Poll = require('../models/Poll')
const PollVote = require('../models/PollVote')
const Comment = require('../models/Comment')

class PollPost {
    processMultiplePostDataFromOneOwner(posts, postOwner, userRequesting) {
        return new Promise((resolve, reject) => {

            Promise.all(
                posts.map(post => {
                    delete post.creatorId
                    delete post.viewedBy
                    return new Promise((resolve, reject) => {
                        Promise.all([
                            Upvote.countDocuments({postId: {$eq: post._id}, postFormat: "Poll"}),
                            Downvote.countDocuments({postId: {$eq: post._id}, postFormat: "Poll"}),
                            Upvote.findOne({postId: {$eq: post._id}, postFormat: "Poll", userPublicId: userRequesting.secondId}).lean(),
                            Downvote.findOne({postId: {$eq: post._id}, postFormat: "Poll", userPublicId: userRequesting.secondId}).lean(),
                            PollVote.findOne({pollId: {$eq: post._id}, userId: {$eq: userRequesting._id}}, 'vote').lean(),
                            PollVote.countDocuments({pollId: {$eq: post._id}, vote: 1}),
                            PollVote.countDocuments({pollId: {$eq: post._id}, vote: 2}),
                            PollVote.countDocuments({pollId: {$eq: post._id}, vote: 3}),
                            PollVote.countDocuments({pollId: {$eq: post._id}, vote: 4}),
                            PollVote.countDocuments({pollId: {$eq: post._id}, vote: 5}),
                            PollVote.countDocuments({pollId: {$eq: post._id}, vote: 6}),
                            Comment.countDocuments({postId: {$eq: post._id}, postFormat: "Poll"})
                        ]).then(([upvotes, downvotes, isUpvoted, isDownvoted, pollVote, optionOnesVotes, optionTwosVotes, optionThreesVotes, optionFoursVotes, optionFivesVotes, optionSixesVotes, comments]) => {
                            const postObject = {
                                ...post,
                                optionOnesVotes,
                                optionTwosVotes,
                                optionThreesVotes,
                                optionFoursVotes,
                                optionFivesVotes,
                                optionSixesVotes,
                                _id: post._id.toString(),
                                votes: upvotes - downvotes,
                                creatorName: postOwner.name,
                                creatorDisplayName: postOwner.displayName,
                                creatorPfpKey: postOwner.profileImageKey,
                                upvoted: !!isUpvoted,
                                downvoted: !!isDownvoted,
                                isOwner: postOwner._id.toString() === userRequesting._id.toString(),
                                interacted: !!isUpvoted || !!isDownvoted,
                                votedFor: pollVote?.vote || "None",
                                comments,
                                creatorPublicId: postOwner.secondId
                            }

                            if (isUpvoted) {
                                postObject.voteId = isUpvoted._id.toString()
                            }

                            if (isDownvoted) {
                                postObject.voteId = isDownvoted._id.toString()
                            }
                                
                            resolve(postObject)
                        }).catch(error => {
                            reject(`An error occured while executing Promise.all in PollPostLibrary.processMultiplePostDataFromOneOwner: ${error}`)
                        })
                    })
                })
            ).then(images => {
                resolve(images)
            }).catch(error => {
                reject(`An error occured in the final Promise.all in PollPostLibrary.processMultiplePostDataFromOneOwner: ${error}`)
            })
        })
    }

    upvote(post, userUpvoting) {
        const postId = post._id;
        const userUpvotingPublicId = userUpvoting.secondId;
        const errorMessage = 'An error occured while upvoting poll post. Please try again later.';

        return new Promise((resolve, reject) => {
            if (post.creatorId.toString() === userUpvoting._id.toString()) {
                return reject({publicError: 'You cannot upvote your own post.'})
            }

            Upvote.findOne({postId: {$eq: postId}, postFormat: "Poll", userPublicId: {$eq: userUpvotingPublicId}}).then(upvote => {
                if (upvote) {
                    Promise.all([
                        Upvote.deleteMany({postId: {$eq: postId}, postFormat: "Poll", userPublicId: {$eq: userUpvotingPublicId}}),
                        Downvote.deleteMany({postId: {$eq: postId}, postFormat: "Poll", userPublicId: {$eq: userUpvotingPublicId}})
                    ]).then(() => {
                        resolve("Post UpVote removed")
                    }).catch(error => {
                        console.error(error)
                        reject({publicError: errorMessage, privateError: 'An error occured (log above) while deleting all upvotes and downvotes for a poll post with id:' + postId + ' and a userPublicId:' + userUpvotingPublicId})
                    })
                } else {
                    Promise.all([
                        new Upvote({
                            postId: String(postId),
                            postFormat: "Poll",
                            interactionDate: Date.now(),
                            userPublicId: String(userUpvotingPublicId)
                        }).save(),
                        Downvote.deleteMany({postId, postFormat: "Poll", userPublicId: {$eq: userUpvotingPublicId}})
                    ]).then(() => {
                        resolve("Post UpVoted")
                    }).catch(error => {
                        console.error(error)
                        reject({publicError: errorMessage, privateError: 'An error occured (log above) while deleting all downvotes and creating a new upvote for a poll post with id:' + postId + ' and a userPublicId:' + userUpvotingPublicId})
                    })
                }
            }).catch(error => {
                console.error(error)
                reject({publicError: errorMessage, privateError: 'An error occured (log above) while finding upvote for poll with id:' + postId + ". The user trying to upvote's public id is:" + userUpvotingPublicId})
            })
        })
    }

    downvote(post, userDownvoting) {
        const postId = post._id;
        const userDownvotingPublicId = userDownvoting.secondId;
        const errorMessage = 'An error occured while downvoting poll post. Please try again later.';

        return new Promise((resolve, reject) => {
            if (post.creatorId.toString() === userDownvoting._id.toString()) {
                return reject({publicError: 'You cannot dowmvote your own post.'})
            }
            
            Downvote.findOne({postId: {$eq: postId}, postFormat: "Poll", userPublicId: {$eq: userDownvotingPublicId}}).then(downvote => {
                if (downvote) {
                    Promise.all([
                        Upvote.deleteMany({postId: {$eq: postId}, postFormat: "Poll", userPublicId: {$eq: userDownvotingPublicId}}),
                        Downvote.deleteMany({postId: {$eq: postId}, postFormat: "Poll", userPublicId: {$eq: userDownvotingPublicId}})
                    ]).then(() => {
                        resolve("Post DownVote removed")
                    }).catch(error => {
                        console.error(error)
                        reject({publicError: errorMessage, privateError: 'An error occured (log above) while deleting all upvotes and downvotes for a poll post with id:' + postId + ' and a userPublicId:' + userDownvotingPublicId})
                    })
                } else {
                    Promise.all([
                        new Downvote({
                            postId: String(postId),
                            postFormat: "Poll",
                            interactionDate: Date.now(),
                            userPublicId: String(userDownvotingPublicId)
                        }).save(),
                        Upvote.deleteMany({postId: {$eq: postId}, postFormat: "Poll", userPublicId: {$eq: userDownvotingPublicId}})
                    ]).then(() => {
                        resolve("Post DownVoted")
                    }).catch(error => {
                        console.error(error)
                        reject({publicError: errorMessage, privateError: 'An error occured (log above) while deleting all upvotes and creating a new downvote for a poll post with id:' + postId + ' and a userPublicId:' + userDownvotingPublicId})
                    })
                }
            }).catch(error => {
                console.error(error)
                reject({publicError: errorMessage, privateError: 'An error occured (log above) while finding downvote for poll with id:' + postId + ". The user trying to upvote's public id is:" + userDownvotingPublicId})
            })
        })
    }

    deleteOnePollPostById(postId, rejectOnPostNotFound) {
        return new Promise((resolve, reject) => {
            Poll.findOne({_id: {$eq: postId}}).lean().then(post => {
                if (post) {
                    Poll.deleteOne({_id: {$eq: postId}}).then(() => {
                        Promise.all([
                            Upvote.deleteMany({postId: {$eq: postId}, postFormat: "Poll"}),
                            Downvote.deleteMany({postId: {$eq: postId}, postFormat: "Poll"})
                        ]).then(() => {
                            resolve()
                        }).catch(error => {
                            console.error('An error occured while deleting votes from poll post with id:', postId)
                            console.error('The error was:', error)
                            reject('An error occured while deleting poll post')
                        })
                    }).catch(error => {
                        console.error('An error occured while deleting poll post with id:', postId)
                        console.error('The error was:', error)
                        reject('An error occured while deleting poll post')
                    })
                } else {
                    if (rejectOnPostNotFound) {
                        reject('Post not found')
                    } else {
                        resolve('Post not found')
                    }
                }
            })
        })
    }
}

module.exports = PollPost;