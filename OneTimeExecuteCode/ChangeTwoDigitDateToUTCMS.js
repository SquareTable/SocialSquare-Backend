const Category = require('../models/Category')
const Conversation = require('../models/Conversation')
const ImagePost = require('../models/ImagePost')
const Message = require('../models/Message')
const Poll = require('../models/Poll')
const Thread = require('../models/Thread')
const User = require('../models/User')

const ChangeTwoDigitDateToUTCMS = () => {
    Category.find({}).then(categories => {
        Promise.all(
            categories.map(category => Category.findOneAndUpdate({_id: category._id}, {datePosted: Date.now()}))
        ).then(() => {
            console.log('Updated all categories')
        }).catch(error => {
            console.error('Error while updating categories:', error)
        })
    }).catch(error => {
        console.error('Error occured while finding all categories:', error)
    })

    Conversation.find({}).then(conversations => {
        Promise.all(
            conversations.map(conversation => {
                const newLastMessageViewedArray = conversation.lastMessageViewed.map(item => {
                    item.dateOfMessage = Date.now();
                    return item
                })
                return Conversation.findOneAndUpdate({_id: conversation._id}, {dateCreated: Date.now(), lastMessageViewed: newLastMessageViewedArray})
            })
        ).then(() => {
            console.log('Updated all conversations')
        }).catch(error => {
            console.error('An error occured while updating conversations:', error)
        })
    }).catch(error => {
        console.error('Error occured while finding all conversations:', error)
    })

    ImagePost.find({}).then(images => {
        Promise.all(
            images.map(post => {
                const newComments = post.comments.map(item => {
                    item.datePosted = Date.now();
                    item.commentReplies = item.commentReplies.map(item => {
                        item.datePosted = Date.now()
                    })
                    return item
                })
                const newUpVotes = post.upVotes.map(item => {
                    item.interactionDate = Date.now();
                    return item
                })
                const newDownVotes = post.downVotes.map(item => {
                    item.interactionDate = Date.now();
                    return item;
                })
                return ImagePost.findOneAndUpdate({_id: post._id}, {datePosted: Date.now(), comments: newComments, upVotes: newUpVotes, downVotes: newDownVotes})
            })
        ).then(() => {
            console.log('Updated all image posts')
        }).catch(error => {
            console.error('An error occured while updating image posts:', error)
        })
    }).catch(error => {
        console.error('An error occured while finding all image posts:', error)
    })

    Message.find({}).then(messages => {
        Promise.all(
            messages.map(message => {
                return Message.findOneAndUpdate({_id: message._id}, {datePosted: Date.now(), dateUpdated: Date.now()})
            })
        ).then(() => {
            console.log('Updated all messages')
        }).catch(error => {
            console.error('An error occured while updating all messages:', error)
        })
    }).catch(error => {
        console.error('An error occured while finding all messages:', error)
    })

    Poll.find({}).then(polls => {
        Promise.all(
            polls.map(poll => {
                const newComments = poll.comments.map(item => {
                    item.datePosted = Date.now();
                    item.commentReplies = item.commentReplies.map(item => {
                        item.datePosted = Date.now()
                    })
                    return item
                })
                const newUpVotes = poll.upVotes.map(item => {
                    item.interactionDate = Date.now();
                    return item
                })
                const newDownVotes = poll.downVotes.map(item => {
                    item.interactionDate = Date.now();
                    return item;
                })
                return Poll.findOneAndUpdate({_id: poll._id}, {datePosted: Date.now(), comments: newComments, upVotes: newUpVotes, downVotes: newDownVotes})
            })
        ).then(() => {
            console.log('Updated all polls')
        }).catch(error => {
            console.error('An error occured while updating polls:', error)
        })
    }).catch(error => {
        console.error('An error occured while finding all polls:', error)
    })

    Thread.find({}).then(threads => {
        Promise.all(
            threads.map(thread => {
                const newComments = thread.comments.map(item => {
                    item.datePosted = Date.now();
                    item.commentReplies = item.commentReplies.map(item => {
                        item.datePosted = Date.now()
                    })
                    return item
                })
                const newUpVotes = thread.upVotes.map(item => {
                    item.interactionDate = Date.now();
                    return item
                })
                const newDownVotes = thread.downVotes.map(item => {
                    item.interactionDate = Date.now();
                    return item;
                })
                return Thread.findOneAndUpdate({_id: thread._id}, {datePosted: Date.now(), comments: newComments, upVotes: newUpVotes, downVotes: newDownVotes})
            })
        ).then(() => {
            console.log('Updated all threads')
        }).catch(error => {
            console.error('An error occured while updating all threads:', error)
        })
    }).catch(error => {
        console.error('An error occured while finding all threads:', error)
    })

    User.find({}).then(users => {
        Promise.all(
            users.map(user => {
                const newBadges = user.badges.map(badge => {
                    badge.dateRecieved = Date.now()
                    return badge
                })
                return User.findOneAndUpdate({_id: user._id}, {badges: newBadges})
            })
        ).then(() => {
            console.log('Updated all users')
        }).catch(error => {
            console.error('An error occured while updating all users:', error)
        })
    }).catch(error => {
        console.error('An error occured while finding all users:', error)
    })
}

exports.ChangeTwoDigitDateToUTCMS = ChangeTwoDigitDateToUTCMS;