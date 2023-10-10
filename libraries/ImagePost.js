const Upvote = require('../models/Upvote')
const Downvote = require('../models/Downvote')
const ImagePost = require('../models/ImagePost')
const ImageLibrary = require('../libraries/Image')
const imageLib = new ImageLibrary()

class ImagePostClass {
    processMultiplePostDataFromOneOwner(posts, postOwner, userRequesting) {
        return new Promise((resolve, reject) => {

            Promise.all(
                posts.map(post => {
                    delete post.creatorId
                    return new Promise((resolve, reject) => {
                        Promise.all([
                            Upvote.countDocuments({postId: {$eq: post._id}, postFormat: "Image"}),
                            Downvote.countDocuments({postId: {$eq: post._id}, postFormat: "Image"}),
                            Upvote.findOne({postId: {$eq: post._id}, postFormat: "Image", userPublicId: userRequesting.secondId}),
                            Downvote.findOne({postId: {$eq: post._id}, postFormat: "Image", userPublicId: userRequesting.secondId}),
                        ]).then(([upvotes, downvotes, isUpvoted, isDownvoted]) => {
                            const postObject = {
                                ...post,
                                votes: upvotes - downvotes,
                                creatorName: postOwner.name,
                                creatorDisplayName: postOwner.displayName,
                                creatorPfpKey: postOwner.profileImageKey,
                                upvoted: !!isUpvoted,
                                downvoted: !!isDownvoted,
                                isOwner: postOwner._id.toString() === userRequesting._id.toString(),
                                interacted: !!isUpvoted || !!isDownvoted,
                                _id: post._id.toString(),
                                comments: post.comments ? post.comments.length : 0
                            }

                            if (isUpvoted) {
                                postObject.voteId = isUpvoted._id.toString()
                            }

                            if (isDownvoted) {
                                postObject.voteId = isDownvoted._id.toString()
                            }
                            
                            resolve(postObject)
                        }).catch(error => {
                            reject(`An error occured while executing Promise.all in ImagePostLibrary.processMultiplePostDataFromOneOwner: ${error}`)
                        })
                    })
                })
            ).then(images => {
                resolve(images)
            }).catch(error => {
                reject(`An error occured in the final Promise.all in ImagePostLibrary.processMultiplePostDataFromOneOwner: ${error}`)
            })
        })
    }

    deleteOneImagePostById(postId, rejectOnPostNotFound) {
        return new Promise((resolve, reject) => {
            ImagePost.findOne({_id: {$eq: postId}}).lean().then(post => {
                if (post) {
                    ImagePost.deleteOne({_id: {$eq: postId}}).then(() => {
                        Promise.all([
                            Upvote.deleteMany({postId: {$eq: postId}, postFormat: "Image"}),
                            Downvote.deleteMany({postId: {$eq: postId}, postFormat: "Image"})
                        ]).then(() => {
                            imageLib.deleteImageByKey(post.imageKey)
                            resolve()
                        }).catch(error => {
                            console.error('An error occured while deleting votes from image post with id:', postId)
                            console.error('The error was:', error)
                            reject('An error occured while deleting image post')
                        })
                    }).catch(error => {
                        console.error('An error occured while deleting image post with id:', postId)
                        console.error('The error was:', error)
                        reject('An error occured while deleting image post')
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

module.exports = ImagePostClass;