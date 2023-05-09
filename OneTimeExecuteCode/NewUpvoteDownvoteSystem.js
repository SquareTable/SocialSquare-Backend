const ImagePost = require('../models/ImagePost')
const Poll = require('../models/Poll')
const Thread = require('../models/Thread')
const User = require('../models/User')
const Upvote = require('../models/Upvote')
const Downvote = require('../models/Downvote')
const ObjectId = require('mongoose').Types.ObjectId

const MoveImagesToNewSystem = () => {
    ImagePost.find().lean().then(posts => {
        Promise.all([
            ImagePost.updateMany({}, {$unset: {upVotes: "", downVotes: ""}}),
            ...posts.map(post => {
                return Promise.all([
                    ...post.upVotes.map(upVote => {
                        return new Promise((resolve, reject) => {
                            const userId = upVote.userId;
                            if ((userId?.length === 12 || userId?.length === 24) && userId === new ObjectId(userId).toString()) {
                                User.findOne({_id: userId}).lean().then(userFound => {
                                    const newUpvote = new Upvote({
                                        postFormat: "Image",
                                        postId: post._id,
                                        interactionDate: upVote.interactionDate,
                                        userPublicId: userFound.secondId
                                    })
    
                                    newUpvote.save().then(() => {
                                        console.log('Added upvote for image post with id:', post._id, '. Interaction date:', upVote.interactionDate, '. userPublicId:', userFound.secondId)
                                        resolve()
                                    }).catch(error => reject(error))
                                }).catch(error => {
                                    console.error('An error occured while finding user by id: ' + userId + '. The upvote was found in post with id: ' + post._id + '. The error was: ' + error)
                                    reject('An error occured while finding user by id: ' + userId + '. The upvote was found in post with id: ' + post._id + '. The error was: ' + error)
                                })
                            } else {
                                console.log('FAKE USERID DETECTED:', userId, '!!! SKIPPING THIS UPVOTE')
                                resolve()
                            }
                        })
                    }),
                    ...post.downVotes.map(downVote => {
                        return new Promise((resolve, reject) => {
                            const userId = downVote.userId;
                            if ((userId?.length === 12 || userId?.length === 24) && userId === new ObjectId(userId).toString()) {
                                User.findOne({_id: userId}).lean().then(userFound => {
                                    const newDownvote = new Downvote({
                                        postFormat: "Image",
                                        postId: post._id,
                                        interactionDate: downVote.interactionDate,
                                        userPublicId: userFound.secondId
                                    })
    
                                    newDownvote.save().then(() => {
                                        console.log('Added downvote for image post with id:', post._id, '. Interaction date:', downVote.interactionDate, '. userPublicId:', userFound.secondId)
                                        resolve()
                                    }).catch(error => reject(error))
                                }).catch(error => {
                                    console.error('An error occured while finding user by id: ' + userId + '. The downvote was found in post with id: ' + post._id + '. The error was: ' + error)
                                    reject('An error occured while finding user by id: ' + userId + '. The downvote was found in post with id: ' + post._id + '. The error was: ' + error)
                                })
                            } else {
                                console.log('FAKE USERID DETECTED:', userId, '!!! SKIPPING THIS DOWNVOTE')
                                resolve()
                            }
                        })
                    })
                ])
            })
        ]).then(() => {
            console.log('Moving image posts over to ne upvote downvote system was successful!')
        }).catch(error => {
            console.error('An error occured while changing image posts over to new system:', error)
        })
    }).catch(error => {
        console.error('Whoopsies. An error occured while finding all SocialSquare image posts.')
        console.error('The error was:', error)
    })
}

const MovePollsToNewSystem = () => {
    Poll.find().lean().then(posts => {
        Promise.all([
            Poll.updateMany({}, {$unset: {upVotes: "", downVotes: ""}}),
            ...posts.map(post => {
                return Promise.all([
                    ...post.upVotes.map(upVote => {
                        return new Promise((resolve, reject) => {
                            const userId = upVote.userId;
                            if ((userId?.length === 12 || userId?.length === 24) && userId === new ObjectId(userId).toString()) {
                                User.findOne({_id: userId}).lean().then(userFound => {
                                    const newUpvote = new Upvote({
                                        postFormat: "Poll",
                                        postId: post._id,
                                        interactionDate: upVote.interactionDate,
                                        userPublicId: userFound.secondId
                                    })
    
                                    newUpvote.save().then(() => {
                                        console.log('Added upvote for poll post with id:', post._id, '. Interaction date:', upVote.interactionDate, '. userPublicId:', userFound.secondId)
                                        resolve()
                                    }).catch(error => reject(error))
                                }).catch(error => {
                                    console.error('An error occured while finding user by id: ' + userId + '. The upvote was found in post with id: ' + post._id + '. The error was: ' + error)
                                    reject('An error occured while finding user by id: ' + userId + '. The upvote was found in post with id: ' + post._id + '. The error was: ' + error)
                                })
                            } else {
                                console.log('FAKE USERID DETECTED:', userId, '!!! SKIPPING THIS UPVOTE')
                                resolve()
                            }
                        })
                    }),
                    ...post.downVotes.map(downVote => {
                        return new Promise((resolve, reject) => {
                            const userId = downVote.userId;
                            if ((userId?.length === 12 || userId?.length === 24) && userId === new ObjectId(userId).toString()) {
                                User.findOne({_id: userId}).lean().then(userFound => {
                                    const newDownvote = new Downvote({
                                        postFormat: "Poll",
                                        postId: post._id,
                                        interactionDate: downVote.interactionDate,
                                        userPublicId: userFound.secondId
                                    })
    
                                    newDownvote.save().then(() => {
                                        console.log('Added downvote for poll post with id:', post._id, '. Interaction date:', downVote.interactionDate, '. userPublicId:', userFound.secondId)
                                        resolve()
                                    }).catch(error => reject(error))
                                }).catch(error => {
                                    console.error('An error occured while finding user by id: ' + userId + '. The downvote was found in post with id: ' + post._id + '. The error was: ' + error)
                                    reject('An error occured while finding user by id: ' + userId + '. The downvote was found in post with id: ' + post._id + '. The error was: ' + error)
                                })
                            } else {
                                console.log('FAKE USERID DETECTED:', userId, '!!! SKIPPING THIS DOWNVOTE')
                                resolve()
                            }
                        })
                    })
                ])
            })
        ]).then(() => {
            console.log('Moving poll posts over to new upvote downvote system was successful!')
        }).catch(error => {
            console.error('An error occured while changing poll posts over to new system:', error)
        })
    }).catch(error => {
        console.error('Whoopsies. An error occured while finding all SocialSquare poll posts.')
        console.error('The error was:', error)
    })
}

const MoveThreadsToNewSystem = () => {
    Thread.find().lean().then(posts => {
        Promise.all([
            Thread.updateMany({}, {$unset: {upVotes: "", downVotes: ""}}),
            ...posts.map(post => {
                return Promise.all([
                    ...post.upVotes.map(upVote => {
                        return new Promise((resolve, reject) => {
                            const userId = upVote.userId;
                            if ((userId?.length === 12 || userId?.length === 24) && userId === new ObjectId(userId).toString()) {
                                User.findOne({_id: userId}).lean().then(userFound => {
                                    const newUpvote = new Upvote({
                                        postFormat: "Thread",
                                        postId: post._id,
                                        interactionDate: upVote.interactionDate,
                                        userPublicId: userFound.secondId
                                    })
    
                                    newUpvote.save().then(() => {
                                        console.log('Added upvote for thread post with id:', post._id, '. Interaction date:', upVote.interactionDate, '. userPublicId:', userFound.secondId)
                                        resolve()
                                    }).catch(error => reject(error))
                                }).catch(error => {
                                    console.error('An error occured while finding user by id: ' + userId + '. The thread was found in post with id: ' + post._id + '. The error was: ' + error)
                                    reject('An error occured while finding user by id: ' + userId + '. The thread was found in post with id: ' + post._id + '. The error was: ' + error)
                                })
                            } else {
                                console.log('FAKE USERID DETECTED:', userId, '!!! SKIPPING THIS UPVOTE')
                                resolve()
                            }
                        })
                    }),
                    ...post.downVotes.map(downVote => {
                        return new Promise((resolve, reject) => {
                            const userId = downVote.userId;
                            if ((userId?.length === 12 || userId?.length === 24) && userId === new ObjectId(userId).toString()) {
                                User.findOne({_id: userId}).lean().then(userFound => {
                                    const newDownvote = new Downvote({
                                        postFormat: "Thread",
                                        postId: post._id,
                                        interactionDate: downVote.interactionDate,
                                        userPublicId: userFound.secondId
                                    })
    
                                    newDownvote.save().then(() => {
                                        console.log('Added downvote for thread post with id:', post._id, '. Interaction date:', downVote.interactionDate, '. userPublicId:', userFound.secondId)
                                        resolve()
                                    }).catch(error => reject(error))
                                }).catch(error => {
                                    console.error('An error occured while finding user by id: ' + userId + '. The downvote was found in post with id: ' + post._id + '. The error was: ' + error)
                                    reject('An error occured while finding user by id: ' + userId + '. The downvote was found in post with id: ' + post._id + '. The error was: ' + error)
                                })
                            } else {
                                console.log('FAKE USERID DETECTED:', userId, '!!! SKIPPING THIS DOWNVOTE')
                                resolve()
                            }
                        })
                    })
                ])
            })
        ]).then(() => {
            console.log('Moving thread posts over to ne upvote downvote system was successful!')
        }).catch(error => {
            console.error('An error occured while changing thread posts over to new system:', error)
        })
    }).catch(error => {
        console.error('Whoopsies. An error occured while finding all SocialSquare thread posts.')
        console.error('The error was:', error)
    })
}

module.exports = {
    MoveImagesToNewSystem,
    MovePollsToNewSystem,
    MoveThreadsToNewSystem
}