const Upvote = require('../models/Upvote')
const Downvote = require('../models/Downvote')
const Thread = require('../models/Thread')
const ImageLibrary = require('./Image')
const Category = require('../models/Category')
const Comment = require('../models/Comment')
const imageLib = new ImageLibrary()

class ThreadPost {
    processMultiplePostDataFromOneOwner(posts, postOwner, userRequesting) {
        return new Promise((resolve, reject) => {

            Promise.all(
                posts.map(post => {
                    delete post.creatorId
                    delete post.viewedBy
                    return new Promise((resolve, reject) => {
                        Promise.all([
                            Upvote.countDocuments({postId: {$eq: post._id}, postFormat: "Thread"}),
                            Downvote.countDocuments({postId: {$eq: post._id}, postFormat: "Thread"}),
                            Upvote.findOne({postId: {$eq: post._id}, postFormat: "Thread", userPublicId: {$eq: userRequesting.secondId}}),
                            Downvote.findOne({postId: {$eq: post._id}, postFormat: "Thread", userPublicId: {$eq: userRequesting.secondId}}),
                            Category.findOne({_id: {$eq: post.threadCategoryId}}, {title: 1, imageKey: 1, _id: 1}),
                            Comment.countDocuments({postId: {$eq: post._id}, postFormat: "Thread"})
                        ]).then(([upvotes, downvotes, isUpvoted, isDownvoted, category, comments]) => {
                            const postObject = {
                                ...post,
                                votes: upvotes - downvotes,
                                creatorName: postOwner.name,
                                creatorDisplayName: postOwner.displayName,
                                creatorImageKey: postOwner.profileImageKey,
                                upvoted: !!isUpvoted,
                                downvoted: !!isDownvoted,
                                isOwner: postOwner._id.toString() === userRequesting._id.toString(),
                                interacted: !!isUpvoted || !!isDownvoted,
                                _id: String(post._id),
                                title: category.title,
                                comments,
                                creatorPublicId: postOwner.secondId,
                                categoryImageKey: category.imageKey,
                                categoryId: String(category._id)
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
        const errorMessage = 'An error occured while upvoting thread post. Please try again later.';

        return new Promise((resolve, reject) => {
            if (post.creatorId.toString() === userUpvoting._id.toString()) {
                return reject({publicError: 'You cannot upvote your own post.'})
            }

            Upvote.findOne({postId: {$eq: postId}, postFormat: "Thread", userPublicId: {$eq: userUpvotingPublicId}}).then(upvote => {
                if (upvote) {
                    Promise.all([
                        Upvote.deleteMany({postId: {$eq: postId}, postFormat: "Thread", userPublicId: {$eq: userUpvotingPublicId}}),
                        Downvote.deleteMany({postId: {$eq: postId}, postFormat: "Thread", userPublicId: {$eq: userUpvotingPublicId}})
                    ]).then(() => {
                        resolve("Thread UpVote removed")
                    }).catch(error => {
                        console.error(error)
                        reject({publicError: errorMessage, privateError: 'An error occured (log above) while deleting all upvotes and downvotes for a thread post with id:' + postId + ' and a userPublicId:' + userUpvotingPublicId})
                    })
                } else {
                    Promise.all([
                        new Upvote({
                            postId: String(postId),
                            postFormat: "Thread",
                            interactionDate: Date.now(),
                            userPublicId: String(userUpvotingPublicId)
                        }).save(),
                        Downvote.deleteMany({postId: {$eq: postId}, postFormat: "Thread", userPublicId: {$eq: userUpvotingPublicId}})
                    ]).then(() => {
                        resolve("Thread UpVoted")
                    }).catch(error => {
                        console.error(error)
                        reject({publicError: errorMessage, privateError: 'An error occured (log above) while deleting all downvotes and creating a new upvote for a thread post with id:' + postId + ' and a userPublicId:' + userUpvotingPublicId})
                    })
                }
            }).catch(error => {
                console.error(error)
                reject({publicError: errorMessage, privateError: 'An error occured (log above) while finding upvote for thread with id:' + postId + ". The user trying to upvote's public id is:" + userUpvotingPublicId})
            })
        })
    }

    downvote(post, userDownvoting) {
        const postId = post._id;
        const userDownvotingPublicId = userDownvoting.secondId;
        const errorMessage = 'An error occured while downvoting thread post. Please try again later.';

        return new Promise((resolve, reject) => {
            if (post.creatorId.toString() === userDownvoting._id.toString()) {
                return reject({publicError: 'You cannot dowmvote your own post.'})
            }
            
            Downvote.findOne({postId: {$eq: postId}, postFormat: "Thread", userPublicId: {$eq: userDownvotingPublicId}}).then(downvote => {
                if (downvote) {
                    Promise.all([
                        Upvote.deleteMany({postId: {$eq: postId}, postFormat: "Thread", userPublicId: {$eq: userDownvotingPublicId}}),
                        Downvote.deleteMany({postId: {$eq: postId}, postFormat: "Thread", userPublicId: {$eq: userDownvotingPublicId}})
                    ]).then(() => {
                        resolve("Thread DownVote removed")
                    }).catch(error => {
                        console.error(error)
                        reject({publicError: errorMessage, privateError: 'An error occured (log above) while deleting all upvotes and downvotes for a thread post with id:' + postId + ' and a userPublicId:' + userDownvotingPublicId})
                    })
                } else {
                    Promise.all([
                        new Downvote({
                            postId: String(postId),
                            postFormat: "Thread",
                            interactionDate: Date.now(),
                            userPublicId: String(userDownvotingPublicId)
                        }).save(),
                        Upvote.deleteMany({postId: {$eq: postId}, postFormat: "Thread", userPublicId: {$eq: userDownvotingPublicId}})
                    ]).then(() => {
                        resolve("Thread DownVoted")
                    }).catch(error => {
                        console.error(error)
                        reject({publicError: errorMessage, privateError: 'An error occured (log above) while deleting all upvotes and creating a new downvote for a thread post with id:' + postId + ' and a userPublicId:' + userDownvotingPublicId})
                    })
                }
            }).catch(error => {
                console.error(error)
                reject({publicError: errorMessage, privateError: 'An error occured (log above) while finding downvote for thread with id:' + postId + ". The user trying to upvote's public id is:" + userDownvotingPublicId})
            })
        })
    }

    deleteOneThreadPostById(postId, rejectOnPostNotFound) {
        return new Promise((resolve, reject) => {
            Thread.findOne({_id: {$eq: postId}}).lean().then(post => {
                if (post) {
                    Thread.deleteOne({_id: {$eq: postId}}).then(() => {
                        Promise.all([
                            Upvote.deleteMany({postId: {$eq: postId}, postFormat: "Thread"}),
                            Downvote.deleteMany({postId: {$eq: postId}, postFormat: "Thread"})
                        ]).then(() => {
                            if (post.imageKey) {
                                imageLib.deleteImageByKey(post.imageKey)
                            }
                            resolve()
                        }).catch(error => {
                            console.error('An error occured while deleting votes from thread post with id:', postId)
                            console.error('The error was:', error)
                            reject('An error occured while deleting thread post')
                        })
                    }).catch(error => {
                        console.error('An error occured while deleting thread post with id:', postId)
                        console.error('The error was:', error)
                        reject('An error occured while deleting thread post')
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

module.exports = ThreadPost;