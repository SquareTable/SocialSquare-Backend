const Comment = require('../models/Comment')
const Upvote = require('../models/Upvote')
const Downvote = require('../models/Downvote')

class CommentLibrary {
    processMultipleCommentsFromOneOwner(comments, commentOwner, userRequesting) {
        return new Promise((resolve, reject) => {

            Promise.all(
                comments.map(comment => {
                    delete comment.creatorId
                    return new Promise((resolve, reject) => {
                        Promise.all([
                            Upvote.countDocuments({postId: {$eq: post._id}, postFormat: "Comment"}),
                            Downvote.countDocuments({postId: {$eq: post._id}, postFormat: "Comment"}),
                            Upvote.findOne({postId: {$eq: post._id}, postFormat: "Comment", userPublicId: userRequesting.secondId}),
                            Downvote.findOne({postId: {$eq: post._id}, postFormat: "Comment", userPublicId: userRequesting.secondId}),
                            Comment.countDocuments({parentCommentId: post._id})
                        ]).then(([upvotes, downvotes, isUpvoted, isDownvoted, replies]) => {
                            const commentObject = {
                                ...comment,
                                votes: upvotes - downvotes,
                                creatorName: commentOwner.name,
                                creatorDisplayName: commentOwner.displayName,
                                creatorPfpKey: commentOwner.profileImageKey,
                                upvoted: !!isUpvoted,
                                downvoted: !!isDownvoted,
                                isOwner: commentOwner._id.toString() === userRequesting._id.toString(),
                                interacted: !!isUpvoted || !!isDownvoted,
                                _id: comment._id.toString(),
                                replies
                            }

                            if (isUpvoted) {
                                commentObject.voteId = isUpvoted._id.toString()
                            }

                            if (isDownvoted) {
                                commentObject.voteId = isDownvoted._id.toString()
                            }
                            
                            resolve(commentObject)
                        }).catch(error => {
                            reject(`An error occured while executing Promise.all in CommentLibrary.processMultipleCommentsFromOneOwner: ${error}`)
                        })
                    })
                })
            ).then(images => {
                resolve(images)
            }).catch(error => {
                reject(`An error occured in the final Promise.all in CommentLibrary.processMultipleCommentsFromOneOwner: ${error}`)
            })
        })
    }
}

module.exports = CommentLibrary;