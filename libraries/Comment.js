const Upvote = require('../models/Upvote')
const Downvote = require('../models/Downvote')

class CommentLibrary {
    processOneCommentFromOneOwner(commentOwner, comment, userRequesting) {
        delete comment.commenterId
        delete comment.__v
        return new Promise((resolve, reject) => {
            Promise.all([
                Upvote.countDocuments({postId: {$eq: comment._id}, postFormat: "Comment"}),
                Downvote.countDocuments({postId: {$eq: comment._id}, postFormat: "Comment"}),
                Upvote.findOne({postId: {$eq: comment._id}, postFormat: "Comment", userPublicId: userRequesting.secondId}),
                Downvote.findOne({postId: {$eq: comment._id}, postFormat: "Comment", userPublicId: userRequesting.secondId})
            ]).then(([upvotes, downvotes, isUpvoted, isDownvoted]) => {
                const commentObject = {
                    ...comment,
                    votes: upvotes - downvotes,
                    commenterName: commentOwner.name,
                    commenterDisplayName: commentOwner.displayName,
                    profileImageKey: commentOwner.profileImageKey,
                    upvoted: !!isUpvoted,
                    downvoted: !!isDownvoted,
                    isOwner: commentOwner._id.toString() === userRequesting._id.toString(),
                    interacted: !!isUpvoted || !!isDownvoted,
                    _id: comment._id.toString()
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
    }

    processMultipleCommentsFromOneOwner(commentOwner, comments, userRequesting) {
        return new Promise((resolve, reject) => {

            Promise.all(
                comments.map(comment => this.processOneCommentFromOneOwner(commentOwner, comment, userRequesting))
            ).then(images => {
                resolve(images)
            }).catch(error => {
                reject(`An error occured in the final Promise.all in CommentLibrary.processMultipleCommentsFromOneOwner: ${error}`)
            })
        })
    }
}

module.exports = CommentLibrary;