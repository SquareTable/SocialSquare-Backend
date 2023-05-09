const mongodb = require('mongodb');
const { algorithmMain } = require('./../Algorithm/algorithmMain')

//Schemas
const User = require('./../models/User');
const Poll = require('./../models/Poll');
const ImagePost = require('./../models/ImagePost');
const Category = require('./../models/Category');
const Thread = require('./../models/Thread')

const ImagePostLibrary = require('../libraries/ImagePost');
const imagePostHandler = new ImagePostLibrary();
const PollPostLibrary = require('../libraries/PollPost');
const pollPostHandler = new PollPostLibrary();
const ThreadPostLibrary = require('../libraries/ThreadPost');
const threadPostHandler = new ThreadPostLibrary();

const HTTPWTLibrary = require('../libraries/HTTPWT')
const HTTPWTHandler = new HTTPWTLibrary()

const dateFuncForTest = () => {
    var currentdate = new Date(); 
    var datetime = "Last Sync: " + currentdate.getDate() + "/"
        + (currentdate.getMonth()+1)  + "/" 
        + currentdate.getFullYear() + " @ "  
        + currentdate.getHours() + ":"  
        + currentdate.getMinutes() + ":" 
        + currentdate.getSeconds(); 
    return datetime
}

class FeedController {
    static #viewedPostInFeed = (userId, postId, postFormat) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userOfViewing => {
                if (userOfViewing) {
                    if (postFormat == "Image") {
                        //Image
                        ImagePost.findOne({_id: {$eq: postId}}).lean().then(postFound => {
                            if (postFound) {
                                const indexIfUserIsInViewed = postFound.viewedBy.findIndex(x => x.pubId == userOfViewing.secondId)
                                if (indexIfUserIsInViewed == -1) {
                                    //already there
                                    const updateQuery = { $push: { viewedBy: { pubId: userOfViewing.secondId, amount: 1 } } };
                                    ImagePost.findOneAndUpdate({ _id: {$eq: postId}}, updateQuery).then(function() {
                                        return resolve(HTTPWTHandler.OK('Viewed'))
                                    }).catch(err => {
                                        console.error('An error occurred while finding one user with id:', postId, 'and updating with query:', updateQuery, '. The error was:', err)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while updating.'))
                                    })
                                } else {
                                    var amountPlusOne = postFound.viewedBy[indexIfUserIsInViewed].amount+1
                                    //already there
                                    const updateQuery = {
                                        $set: {
                                            'viewedBy.$.amount': amountPlusOne
                                        }
                                    }
                                    ImagePost.findOneAndUpdate(
                                        {
                                            _id: {$eq: postId},
                                            'viewedBy.pubId': userOfViewing.secondId
                                        },
                                        updateQuery
                                    ).then(function() {
                                        return resolve(HTTPWTHandler.OK('Viewed'))
                                    }).catch(err => {
                                        console.error('An error occurred while finding one image post with id:', postId, 'and viewedBy.pubId:', userOfViewing.secondId, '. The update query was:', updateQuery, '. The error was:', err)
                                        return resolve(HTTPWTHandler.serverError('Error when updating'))
                                    })
                                }
                            } else {
                                return resolve(HTTPWTHandler.notFound("Copuldn't find image post viewing in feed."))
                            }
                        }).catch(err => {
                            console.error('An error occurred while dfinding images with id:', postId, '. The error was:', err)
                            return resolve(HTTPWTHandler.serverError('Error finding image post viewing in feed.'))
                        })
                    } else if (postFormat == "Poll") {
                        //Poll
                        Poll.findOne({_id: {$eq: postId}}).lean().then(postFound => {
                            if (postFound) {
                                const indexIfUserIsInViewed = postFound.viewedBy.findIndex(x => x.pubId == userOfViewing.secondId)
                                if (indexIfUserIsInViewed == -1) {
                                    //already there
                                    const updateQuery = {
                                        $set: {
                                            'viewedBy.$.amount': amountPlusOne
                                        }
                                    }
                                    Poll.findOneAndUpdate({ _id: {$eq: postId} }, updateQuery).then(function() {
                                        return resolve(HTTPWTHandler.OK('Viewed'))
                                    }).catch(err => {
                                        console.error('An error occurred while finding one poll with id:', postId, 'and executing update query:', updateQuery, '. The error was:', err)
                                        return resolve(HTTPWTHandler.serverError('Error when updating.'))
                                    })
                                } else {
                                    var amountPlusOne = postFound.viewedBy[indexIfUserIsInViewed].amount+1
                                    //already there
                                    const updateQuery = {
                                        $set: {
                                            'viewedBy.$.amount': amountPlusOne
                                        }
                                    }
                                    Poll.findOneAndUpdate(
                                        {
                                            _id: {$eq: postId},
                                            'viewedBy.pubId': userOfViewing.secondId
                                        },
                                        updateQuery
                                    ).then(function() {
                                        return resolve(HTTPWTHandler.OK('Viewed'))
                                    }).catch(err => {
                                        console.error('An error occurred while finding one poll with id:', postId, 'and with viewedBy.pubId:', userOfViewing.secondId, ' and updating it with update query:', updateQuery, '. The error was:', err)
                                        return resolve(HTTPWTHandler.serverError('Error when updating.'))
                                    })
                                }
                            } else {
                                return resolve(HTTPWTHandler.notFound("Couldn't find poll post viewing in feed."))
                            }
                        }).catch(err => {
                            console.error('An error occurred while finding polls with id:', postId, '. The error was:', err)
                            return resolve(HTTPWTHandler.serverError('Error finding poll post viewing in feed.'))
                        })
                    } else if (postFormat == "Thread") {
                        //Thread
                        Thread.findOne({_id: {$eq: postId}}).lean().then(postFound => {
                            if (postFound) {
                                const indexIfUserIsInViewed = postFound.viewedBy.findIndex(x => x.pubId == userOfViewing.secondId)
                                if (indexIfUserIsInViewed == -1) {
                                    //already there
                                    const updateQuery = { $push: { viewedBy: { pubId: userOfViewing.secondId, amount: 1 } } }
                                    Thread.findOneAndUpdate({ _id: {$eq: postId} }, updateQuery).then(function() {
                                        return resolve(HTTPWTHandler.OK('Viewed'))
                                    }).catch(err => {
                                        console.error('An error occurred while finding one thread with id:', postId, 'and executing update query on it:', updateQuery, '. The error was:', err)
                                        return resolve(HTTPWTHandler.serverError('Error when updating.'))
                                    })
                                } else {
                                    var amountPlusOne = postFound.viewedBy[indexIfUserIsInViewed].amount+1
                                    //already there
                                    const updateQuery = {
                                        $set: {
                                            'viewedBy.$.amount': amountPlusOne
                                        }
                                    }
                                    Thread.findOneAndUpdate(
                                        {
                                            _id: {$eq: postId},
                                            'viewedBy.pubId': userOfViewing.secondId
                                        },
                                        updateQuery
                                    ).then(function() {
                                        return resolve(HTTPWTHandler.OK('Viewed'))
                                    }).catch(err => {
                                        console.error('An error occurred while finding one thread with id:', postId, 'and viewedBy.pubId:', userOfViewing.secondId, ' and executing updateQuery:', updateQuery, '. The error was:', err)
                                        return resolve(HTTPWTHandler.serverError('Error when updating.'))
                                    })
                                }
                            } else {
                                return resolve(HTTPWTHandler.notFound("Couldn't find thread post viewing in feed."))
                            }
                        }).catch(err => {
                            console.error('An error occurred while finding thread posts with id:', postId, '. The error was:', err)
                            return resolve(HTTPWTHandler.serverError('Error finding thread post viewing in thread.'))
                        })
                    } else {
                        //invalid format
                        return resolve(HTTPWTHandler.badInput('Invalid format.'))
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound("Couldn't find user that's viewing post in feed."))
                }
            }).catch(err => {
                console.error('An error occurred while finding users with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError("Error finding user that's viewing post in feed."))
            })
        })
    }

    static #followerFeed = (idOfUser, alreadyOnCurrentFeed) => {
        return new Promise(resolve => {
            if (typeof alreadyOnCurrentFeed === 'string' || alreadyOnCurrentFeed instanceof String) {

                var splitAlreadyOnCurrentFeedIds = alreadyOnCurrentFeed.split(",")
                const alreadyOnCurrentFeedIds = splitAlreadyOnCurrentFeedIds.map(x => x.trim())
                //Check if user exists
                User.findOne({_id: {$eq: idOfUser}}).lean().then(userFound => {
                    if (userFound) {
                        const userIsFollowing = userFound.following // is pub ids
                        if (userIsFollowing.length !== 0) {
                            //Probs want to change later
                            const afterGettingAllPosts = (allPostsWithRequiredFields) => {
                                //remove any falsey values (they will not have a date time so ill use that)
                                //console.log("allPostsWithRequiredFields")
                                //console.log(allPostsWithRequiredFields)
                                const filteredAllPostsWithRequiredFields = allPostsWithRequiredFields.filter(x => typeof x.datePosted == "number")
                                if (filteredAllPostsWithRequiredFields.length !== 0) {
                                    //sort by date
                                    const sortedResult = filteredAllPostsWithRequiredFields.sort(function(a, b){
                                        return a.datePosted > b.datePosted ? -1 : 1
                                    });
                                    //split into has viewed (twice or more so u can view it twice before it doesnt show) and hasnt viewed
                                    function hasViewedChecker(propertyOfViewed) {
                                        if (propertyOfViewed.interacted == false) {
                                            indexOfThisUsers = propertyOfViewed.viewedBy.findIndex(x => x.pubId == userFound.secondId)
                                            if (indexOfThisUsers !== -1) {
                                                if (propertyOfViewed.viewedBy[indexOfThisUsers].amount < 2) {
                                                    return false
                                                } else {
                                                    return true
                                                }
                                            } else {
                                                return false
                                            }
                                        } else {
                                            return true
                                        }
                                    }
                                    function hasNotViewedChecker(propertyOfViewed) {
                                        if (propertyOfViewed.interacted == false) {
                                            indexOfThisUsers = propertyOfViewed.viewedBy.findIndex(x => x.pubId == userFound.secondId)
                                            if (indexOfThisUsers !== -1) {
                                                if (propertyOfViewed.viewedBy[indexOfThisUsers].amount < 2) {
                                                    return true
                                                } else {
                                                    return false
                                                }
                                            } else {
                                                return true
                                            }
                                        } else {
                                            return false
                                        }
                                        
                                    }
        
                                    //console.log("Before filter")
                                    //console.log("sortedResult")
                                    //console.log(sortedResult)
                                    const hasViewedPostsWithRequiredFields = sortedResult.slice().filter(hasViewedChecker)
                                    const hasNotViewedPostsWithRequiredFields = sortedResult.slice().filter(hasNotViewedChecker)
                                    
                                    //console.log("After filter, first is has viewed, second is has not viewed.")
                                    //console.log(hasViewedPostsWithRequiredFields)
                                    //console.log(hasNotViewedPostsWithRequiredFields)
        
                                    const sendBack = (allPostsForSendBackInOrder) => {
                                        console.log("Send back function")
                                        console.log('Posts that are getting sent back:', allPostsForSendBackInOrder)
                                        console.log('Post formats getting sent back:', allPostsForSendBackInOrder.map(x => x.format))
                                        allPostsForSendBackInOrder = allPostsForSendBackInOrder.map(item => {
                                            item._id = item._id.toString()
                                            return item
                                        })
                                        return resolve(HTTPWTHandler.OK('Found posts', allPostsForSendBackInOrder))
                                    }
        
                                    const alreadyOnCurrentFeedIdsChecker = (propertyOfViewed, idTesting) => {
                                        try {
                                            //console.log(propertyOfViewed + " " + idTesting)
                                            
                                            const idVersionOfPropertyViewed = new mongodb.ObjectID(propertyOfViewed)
        
                                            if (idVersionOfPropertyViewed.equals(idTesting)) {
                                                //console.log("Found match of ids in alreadyOnCurrentFeedIdsChecker " + propertyOfViewed + " " + idTesting)
                                                return true
                                            } else {    
                                                //console.log("Not match of ids in alreadyOnCurrentFeedIdsChecker " + propertyOfViewed + " " + idTesting)
                                                return false
                                            }
                                        } catch (err) {
                                            //console.log(`alreadyOnCurrentFeedIdsChecker: ${err}`) //should happed a lot so commented out
                                            return false
                                        }
                                    }
        
                                    const forAlreadyViewedOnes = (forSendBackItemsProcessed, postsForResponse) => {
                                        console.log('forAlreadyViewedOnes now loading...')
                                        //console.log("forAlreadyViewedOnes postsforresponse:")
                                        //console.log(postsForResponse)
                                        hasViewedPostsWithRequiredFields.forEach(function (item, index) {
                                            //console.log(alreadyOnCurrentFeedIds)
                                            if (alreadyOnCurrentFeedIds.findIndex(x => alreadyOnCurrentFeedIdsChecker(x, hasViewedPostsWithRequiredFields[index]._id)) == -1) {
                                                if (hasViewedPostsWithRequiredFields[index].format == "Image") {
                                                    //image
                                                    ImagePost.findOne({_id: {$eq: hasViewedPostsWithRequiredFields[index]._id}}).lean().then(foundImg => {
                                                        if (foundImg) {
                                                            User.findOne({_id: foundImg.creatorId}).lean().then(postUserFound => {
                                                                if (postUserFound) {
                                                                    imagePostHandler.processMultiplePostDataFromOneOwner([foundImg], postUserFound, userFound).then(posts => {
                                                                        const post = posts[0]
                                                                        post.format = "Image"
                                                                        post.hasSeenPosts = true;
                                                                        postsForResponse.push(post)
                                                                    }).catch(error => {
                                                                        console.error('An error occured while processing image post for following feed. The error was:', error)
                                                                    }).finally(() => {
                                                                        forSendBackItemsProcessed++;
                                                                        //do like 10 load
                                                                        var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                                        if (hasViewedLengthAndNotViewedLength < 10) {
                                                                            if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        } else {
                                                                            //more than 10
                                                                            if (postsForResponse.length == 10) {
                                                                                sendBack(postsForResponse)
                                                                            } else if (postsForResponse.length < 10) {
                                                                                if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        }
                                                                    })
                                                                } else {
                                                                    console.log(`Couldn't find user image creator: ${foundImg._id}`)
                                                                    forSendBackItemsProcessed++;
                                                                    //do like 10 load
                                                                    var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                                    if (hasViewedLengthAndNotViewedLength < 10) {
                                                                        if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    } else {
                                                                        //more than 10
                                                                        if (postsForResponse.length == 10) {
                                                                            sendBack(postsForResponse)
                                                                        } else if (postsForResponse.length < 10) {
                                                                            if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }).catch(err => {
                                                                console.error('An error occurred while finding users with id:', foundImg.creatorId, '. The error was:', err)
                                                                forSendBackItemsProcessed++;
                                                                //do like 10 load
                                                                var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                                if (hasViewedLengthAndNotViewedLength < 10) {
                                                                    if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                } else {
                                                                    //more than 10
                                                                    if (postsForResponse.length == 10) {
                                                                        sendBack(postsForResponse)
                                                                    } else if (postsForResponse.length < 10) {
                                                                        if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    }
                                                                }
                                                            })
                                                        } else {
                                                            console.log("Image couldn't be found with _id")
                                                            forSendBackItemsProcessed++;
                                                            //do like 10 load
                                                            var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                            if (hasViewedLengthAndNotViewedLength < 10) {
                                                                if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            } else {
                                                                //more than 10
                                                                if (postsForResponse.length == 10) {
                                                                    sendBack(postsForResponse)
                                                                } else if (postsForResponse.length < 10) {
                                                                    if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }).catch(err => {
                                                        //Error finding image posts
                                                        console.error('An error occurred while finding image posts with id:', hasViewedPostsWithRequiredFields[index]._id, '. The error was:', err)
                                                        forSendBackItemsProcessed++;
                                                        //do like 10 load
                                                        var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                        if (hasViewedLengthAndNotViewedLength < 10) {
                                                            if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                sendBack(postsForResponse)
                                                            }
                                                        } else {
                                                            //more than 10
                                                            if (postsForResponse.length == 10) {
                                                                sendBack(postsForResponse)
                                                            } else if (postsForResponse.length < 10) {
                                                                if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            }
                                                        }
                                                    })
                                                } else if (hasViewedPostsWithRequiredFields[index].format == "Poll") {
                                                    //poll
                                                    Poll.findOne({_id: {$eq: hasViewedPostsWithRequiredFields[index]._id}}).lean().then(foundPoll => {
                                                        if (foundPoll) {
                                                            User.findOne({_id: {$eq: foundPoll.creatorId}}).lean().then(postUserFound => {
                                                                if (postUserFound) {
                                                                    pollPostHandler.processMultiplePostDataFromOneOwner([foundPoll], postUserFound, userFound).then(posts => {
                                                                        const toPush = {
                                                                            ...posts[0],
                                                                            format: 'Poll',
                                                                            hasSeenPosts: true
                                                                        }
                                                                        console.log('POLL POST TO SEND:', toPush)
                                                                        postsForResponse.push(toPush)
                                                                    }).catch(error => {
                                                                        console.error('An error occured while processing poll post for following feed. The error was:', error)
                                                                    }).finally(() => {
                                                                        forSendBackItemsProcessed++;
                                                                        //do like 10 load
                                                                        var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                                        if (hasViewedLengthAndNotViewedLength < 10) {
                                                                            if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        } else {
                                                                            //more than 10
                                                                            if (postsForResponse.length == 10) {
                                                                                sendBack(postsForResponse)
                                                                            } else if (postsForResponse.length < 10) {
                                                                                if (forSendBackItemsProcessed == hasViewedPostsWithRequiredFields.length) {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        }
                                                                    })
                                                                } else {
                                                                    console.log(`Couldn't find user poll creator: ${foundPoll._id}`)
                                                                    forSendBackItemsProcessed++;
                                                                    //do like 10 load
                                                                    var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                                    if (hasViewedLengthAndNotViewedLength < 10) {
                                                                        if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    } else {
                                                                        //more than 10
                                                                        if (postsForResponse.length == 10) {
                                                                            sendBack(postsForResponse)
                                                                        } else if (postsForResponse.length < 10) {
                                                                            if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }).catch(err => {
                                                                console.error('An error occurred while finding user with id:', foundPoll.creatorId, '. The error was:', err)
                                                                forSendBackItemsProcessed++;
                                                                //do like 10 load
                                                                var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                                if (hasViewedLengthAndNotViewedLength < 10) {
                                                                    if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                } else {
                                                                    //more than 10
                                                                    if (postsForResponse.length == 10) {
                                                                        sendBack(postsForResponse)
                                                                    } else if (postsForResponse.length < 10) {
                                                                        if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    }
                                                                }
                                                            })
                                                        } else {
                                                            console.log("Poll couldn't be found with _id")
                                                            forSendBackItemsProcessed++;
                                                            //do like 10 load
                                                            var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                            if (hasViewedLengthAndNotViewedLength < 10) {
                                                                if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            } else {
                                                                //more than 10
                                                                if (postsForResponse.length == 10) {
                                                                    sendBack(postsForResponse)
                                                                } else if (postsForResponse.length < 10) {
                                                                    if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }).catch(err => {
                                                        //Error finding poll posts
                                                        console.error('An error occurred finding polls with id:', hasViewedPostsWithRequiredFields[index]._id, '. The error was:', err)
                                                        forSendBackItemsProcessed++;
                                                        //do like 10 load
                                                        var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                        if (hasViewedLengthAndNotViewedLength < 10) {
                                                            if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                sendBack(postsForResponse)
                                                            }
                                                        } else {
                                                            //more than 10
                                                            if (postsForResponse.length == 10) {
                                                                sendBack(postsForResponse)
                                                            } else if (postsForResponse.length < 10) {
                                                                if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            }
                                                        }
                                                    })
                                                } else {
                                                    //thread
                                                    Thread.findOne({_id: {$eq: hasViewedPostsWithRequiredFields[index]._id}}).lean().then(foundThread => {
                                                        if (foundThread) {
                                                            User.findOne({_id: foundThread.creatorId}).lean().then(postUserFound => {
                                                                if (postUserFound) {
                                                                    threadPostHandler.processMultiplePostDataFromOneOwner([foundThread], postUserFound, userFound).then(posts => {
                                                                        const post = {
                                                                            ...posts[0],
                                                                            format: 'Thread',
                                                                            hasSeenPosts: true
                                                                        }
                                                                        postsForResponse.push(post)
                                                                    }).catch(error => {
                                                                        console.error('An error occured while processing thread post for following feed. The error was:', error)
                                                                    }).finally(() => {
                                                                        forSendBackItemsProcessed++;
                                                                        //do like 10 load
                                                                        var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                                        if (hasViewedLengthAndNotViewedLength < 10) {
                                                                            if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        } else {
                                                                            //more than 10
                                                                            if (postsForResponse.length == 10) {
                                                                                sendBack(postsForResponse)
                                                                            } else if (postsForResponse.length < 10) {
                                                                                if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        }
                                                                    })
                                                                    console.log(`Thread found: ${foundThread._id}`)
                                                                } else {
                                                                    console.log(`Couldn't find user thread creator: ${foundThread._id}`)
                                                                    forSendBackItemsProcessed++;
                                                                    //do like 10 load
                                                                    var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                                    if (hasViewedLengthAndNotViewedLength < 10) {
                                                                        if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    } else {
                                                                        //more than 10
                                                                        if (postsForResponse.length == 10) {
                                                                            sendBack(postsForResponse)
                                                                        } else if (postsForResponse.length < 10) {
                                                                            if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }).catch(err => {
                                                                console.error('An error occurred while finding users with id:', foundThread.creatorId, '. The error was:', err)
                                                                forSendBackItemsProcessed++;
                                                                //do like 10 load
                                                                var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                                if (hasViewedLengthAndNotViewedLength < 10) {
                                                                    if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                } else {
                                                                    //more than 10
                                                                    if (postsForResponse.length == 10) {
                                                                        sendBack(postsForResponse)
                                                                    } else if (postsForResponse.length < 10) {
                                                                        if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    }
                                                                }
                                                            })
                                                        } else {
                                                            console.log("Thread couldn't be found with _id")
                                                            forSendBackItemsProcessed++;
                                                            //do like 10 load
                                                            var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                            if (hasViewedLengthAndNotViewedLength < 10) {
                                                                if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            } else {
                                                                //more than 10
                                                                if (postsForResponse.length == 10) {
                                                                    sendBack(postsForResponse)
                                                                } else if (postsForResponse.length < 10) {
                                                                    if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }).catch(err => {
                                                        //Error finding thread posts
                                                        console.error('An error occurred while finding threads with id:', hasViewedPostsWithRequiredFields[index]._id, '. The error was:', err)
                                                        forSendBackItemsProcessed++;
                                                        //do like 10 load
                                                        var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                        if (hasViewedLengthAndNotViewedLength < 10) {
                                                            if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                sendBack(postsForResponse)
                                                            }
                                                        } else {
                                                            //more than 10
                                                            if (postsForResponse.length == 10) {
                                                                sendBack(postsForResponse)
                                                            } else if (postsForResponse.length < 10) {
                                                                if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            }
                                                        }
                                                    })
                                                }
                                            } else {
                                                forSendBackItemsProcessed++;
                                                //do like 10 load
                                                var hasViewedLengthAndNotViewedLength = hasViewedPostsWithRequiredFields.length+hasNotViewedPostsWithRequiredFields.length
                                                if (hasViewedLengthAndNotViewedLength < 10) {
                                                    if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                        sendBack(postsForResponse)
                                                    }
                                                } else {
                                                    //more than 10
                                                    if (postsForResponse.length == 10) {
                                                        sendBack(postsForResponse)
                                                    } else if (postsForResponse.length < 10) {
                                                        if (forSendBackItemsProcessed == hasViewedLengthAndNotViewedLength) {
                                                            sendBack(postsForResponse)
                                                        }
                                                    }
                                                }
                                            }
                                        })
                                    }
        
                                    if (hasNotViewedPostsWithRequiredFields.length !== 0) {
                                        var forSendBackItemsProcessed = 0
                                        var postsForResponse = []
                                        console.log('hasNotViewedPostsWithRequiredFields.length is not 0')
                                        console.log('hasNotViewedPostsWithRequiredFields:', hasNotViewedPostsWithRequiredFields)
                                        hasNotViewedPostsWithRequiredFields.forEach(function (item, index) {
                                            //console.log(alreadyOnCurrentFeedIds)
                                            if (alreadyOnCurrentFeedIds.findIndex(x => alreadyOnCurrentFeedIdsChecker(x, hasNotViewedPostsWithRequiredFields[index]._id)) == -1) {
                                                if (hasNotViewedPostsWithRequiredFields[index].format == "Image") {
                                                    //image
                                                    ImagePost.findOne({_id: {$eq: hasNotViewedPostsWithRequiredFields[index]._id}}).lean().then(foundImg => {
                                                        if (foundImg) {
                                                            User.findOne({_id: foundImg.creatorId}).lean().then(postUserFound => {
                                                                if (postUserFound) {
                                                                    imagePostHandler.processMultiplePostDataFromOneOwner([foundImg], postUserFound, userFound).then(posts => {
                                                                        const toPush = {
                                                                            ...posts[0],
                                                                            format: 'Image',
                                                                            hasSeenPosts: false
                                                                        }
                                                                        console.log('POST THAT HAS NOT BEEN VIEWED YET:', posts[0])
                                                                        postsForResponse.push(toPush)
                                                                        forSendBackItemsProcessed++;
        
                                                                        console.log('forSendBackItemsProcessed:', forSendBackItemsProcessed)
                                                                        console.log('hasNotViewedPostsWithRequiredFields.length:', hasNotViewedPostsWithRequiredFields.length)
                                                                        console.log('postsForResponse:', postsForResponse)
        
                                                                        //do like 10 load
                                                                        if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                            if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                                    forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                                } else {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        } else {
                                                                            //more than 10
                                                                            if (postsForResponse.length == 10) {
                                                                                sendBack(postsForResponse)
                                                                            } else if (postsForResponse.length < 10) {
                                                                                if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        }
                                                                    }).catch(error => {
                                                                        console.error('An error occured while processing not seen already image posts for following feed. The error was:', error)
                                                                        forSendBackItemsProcessed++;
        
                                                                        //do like 10 load
                                                                        if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                            if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                                    forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                                } else {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        } else {
                                                                            //more than 10
                                                                            if (postsForResponse.length == 10) {
                                                                                sendBack(postsForResponse)
                                                                            } else if (postsForResponse.length < 10) {
                                                                                if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        }
                                                                    })
                                                                } else {
                                                                    console.error('Cpuld not find user with id:', foundImg.creatorId, '. This user still has image posts which are accessible from the database even though the account has been deleted. These must be deleted immediately.')
                                                                    forSendBackItemsProcessed++;
                                                                    //do like 10 load
                                                                    if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                        if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                            if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                                forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                            } else {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        }
                                                                    } else {
                                                                        //more than 10
                                                                        if (postsForResponse.length == 10) {
                                                                            sendBack(postsForResponse)
                                                                        } else if (postsForResponse.length < 10) {
                                                                            if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }).catch(err => {
                                                                console.error('An error occurred while finding users with id:', foundImg.creatorId, '. The error was:', error)
                                                                forSendBackItemsProcessed++;
                                                                //do like 10 load
                                                                if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                    if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                        if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                            forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                        } else {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    }
                                                                } else {
                                                                    //more than 10
                                                                    if (postsForResponse.length == 10) {
                                                                        sendBack(postsForResponse)
                                                                    } else if (postsForResponse.length < 10) {
                                                                        if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    }
                                                                }      
                                                            })
                                                        } else {
                                                            console.log("Image couldn't be found with _id")
                                                            forSendBackItemsProcessed++;
                                                            //do like 10 load
                                                            if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                    if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                        forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                    } else {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                }
                                                            } else {
                                                                //more than 10
                                                                if (postsForResponse.length == 10) {
                                                                    sendBack(postsForResponse)
                                                                } else if (postsForResponse.length < 10) {
                                                                    if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }).catch(err => {
                                                        //Error finding image posts
                                                        console.error('An error occurred while finding image posts with id:', hasNotViewedPostsWithRequiredFields[index]._id, '. The error was:', err)
                                                        forSendBackItemsProcessed++;
                                                        //do like 10 load
                                                        if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                            if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                    forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                } else {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            }
                                                        } else {
                                                            //more than 10
                                                            if (postsForResponse.length == 10) {
                                                                sendBack(postsForResponse)
                                                            } else if (postsForResponse.length < 10) {
                                                                if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            }
                                                        }
                                                    })
                                                } else if (hasNotViewedPostsWithRequiredFields[index].format == "Poll") {
                                                    //poll
                                                    Poll.findOne({_id: {$eq: hasNotViewedPostsWithRequiredFields[index]._id}}).lean().then(foundPoll => {
                                                        if (foundPoll) {
                                                            User.findOne({_id: {$eq: foundPoll.creatorId}}).then(postUserFound => {
                                                                if (postUserFound) {
                                                                    pollPostHandler.processMultiplePostDataFromOneOwner([foundPoll], postUserFound, userFound).then(posts => {
                                                                        const toPush = {
                                                                            ...posts[0],
                                                                            format: 'Poll',
                                                                            hasSeenPosts: false
                                                                        }
                                                                        console.log('POLL POST TO SEND:', toPush)
                                                                        postsForResponse.push(toPush)
                                                                    }).catch(error => {
                                                                        console.error('An error occured while processing poll post for following feed.')
                                                                        console.error('The error was:', error)
                                                                    }).finally(() => {
                                                                        //do like 10 load
                                                                        if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                            if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                                    forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                                } else {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        } else {
                                                                            //more than 10
                                                                            if (postsForResponse.length == 10) {
                                                                                sendBack(postsForResponse)
                                                                            } else if (postsForResponse.length < 10) {
                                                                                if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        }
                                                                    })
                                                                } else {
                                                                    console.error("A poll post exists that was created from a deleted user account. The deleted user account's id is:", foundPoll.creatorId)
                                                                    forSendBackItemsProcessed++;
                                                                    //do like 10 load
                                                                    if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                        if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                            if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                                forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                            } else {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        }
                                                                    } else {
                                                                        //more than 10
                                                                        if (postsForResponse.length == 10) {
                                                                            sendBack(postsForResponse)
                                                                        } else if (postsForResponse.length < 10) {
                                                                            if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }).catch(err => {
                                                                console.error('An error occurred while finding user with id:', foundPoll.creatorId, '. The error was:', err)
                                                                forSendBackItemsProcessed++;
                                                                //do like 10 load
                                                                if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                    if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                        if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                            forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                        } else {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    }
                                                                } else {
                                                                    //more than 10
                                                                    if (postsForResponse.length == 10) {
                                                                        sendBack(postsForResponse)
                                                                    } else if (postsForResponse.length < 10) {
                                                                        if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    }
                                                                }
                                                                
                                                            })
                                                        } else {
                                                            console.log("Poll couldn't be found with _id")
                                                            forSendBackItemsProcessed++;
                                                            //do like 10 load
                                                            if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                    if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                        forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                    } else {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                }
                                                            } else {
                                                                //more than 10
                                                                if (postsForResponse.length == 10) {
                                                                    sendBack(postsForResponse)
                                                                } else if (postsForResponse.length < 10) {
                                                                    if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }).catch(err => {
                                                        //Error finding poll posts
                                                        console.error('An error occurred while finding polls with id:', hasNotViewedPostsWithRequiredFields[index]._id, '. The error was:', err)
                                                        forSendBackItemsProcessed++;
                                                        //do like 10 load
                                                        if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                            if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                    forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                } else {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            }
                                                        } else {
                                                            //more than 10
                                                            if (postsForResponse.length == 10) {
                                                                sendBack(postsForResponse)
                                                            } else if (postsForResponse.length < 10) {
                                                                if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            }
                                                        }
                                                    })
                                                } else {
                                                    //thread
                                                    Thread.findOne({_id: {$eq: hasNotViewedPostsWithRequiredFields[index]._id}}).lean().then(foundThread => {
                                                        if (foundThread) {
                                                            User.findOne({_id: {$eq: foundThread.creatorId}}).lean().then(postUserFound => {
                                                                if (postUserFound) {
                                                                    threadPostHandler.processMultiplePostDataFromOneOwner([foundThread], postUserFound, userFound).then(posts => {
                                                                        const post = {
                                                                            ...posts[0],
                                                                            format: 'Thread',
                                                                            hasSeenPosts: false
                                                                        }
                                                                        postsForResponse.push(post)
                                                                    }).catch(error => {
                                                                        console.error('An error occured while processing thread post for following feed. The error was:', error)
                                                                    }).finally(() => {
                                                                        forSendBackItemsProcessed++;
                                                                        //do like 10 load
                                                                        if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                            if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                                    forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                                } else {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        } else {
                                                                            //more than 10
                                                                            if (postsForResponse.length == 10) {
                                                                                sendBack(postsForResponse)
                                                                            } else if (postsForResponse.length < 10) {
                                                                                if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                    sendBack(postsForResponse)
                                                                                }
                                                                            }
                                                                        }
                                                                    })
                                                                    console.log(`Thread found: ${foundThread._id}`)
                                                                } else {
                                                                    console.error("A thread post exists with id:', hasNotViewedPostsWithRequiredFields[index]._id, 'that does not have a creator (the creator's account got deleted). The creator id is:", foundThread[0].creatorId, '. Delete all posts from this user with id as none of their data should be in the database.')
                                                                    forSendBackItemsProcessed++;
                                                                    //do like 10 load
                                                                    if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                        if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                            if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                                forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                            } else {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        }
                                                                    } else {
                                                                        //more than 10
                                                                        if (postsForResponse.length == 10) {
                                                                            sendBack(postsForResponse)
                                                                        } else if (postsForResponse.length < 10) {
                                                                            if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                                sendBack(postsForResponse)
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }).catch(err => {
                                                                console.error('An error occurred while finding users with id:', foundThread.creatorId, '. The error was:', err)
                                                                forSendBackItemsProcessed++;
                                                                //do like 10 load
                                                                if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                    if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                        if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                            forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                        } else {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    }
                                                                } else {
                                                                    //more than 10
                                                                    if (postsForResponse.length == 10) {
                                                                        sendBack(postsForResponse)
                                                                    } else if (postsForResponse.length < 10) {
                                                                        if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                            sendBack(postsForResponse)
                                                                        }
                                                                    }
                                                                }
                                                            })
                                                        } else {
                                                            console.log("Thread couldn't be found with _id")
                                                            forSendBackItemsProcessed++;
                                                            //do like 10 load
                                                            if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                                if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                    if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                        forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                    } else {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                }
                                                            } else {
                                                                //more than 10
                                                                if (postsForResponse.length == 10) {
                                                                    sendBack(postsForResponse)
                                                                } else if (postsForResponse.length < 10) {
                                                                    if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                        sendBack(postsForResponse)
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }).catch(err => {
                                                        //Error finding thread posts
                                                        console.error('An error occurred while finding threads with id:', hasNotViewedPostsWithRequiredFields[index]._id, '. The error was:', err)
                                                        forSendBackItemsProcessed++;
                                                        //do like 10 load
                                                        if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                            if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                                    forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                                } else {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            }
                                                        } else {
                                                            //more than 10
                                                            if (postsForResponse.length == 10) {
                                                                sendBack(postsForResponse)
                                                            } else if (postsForResponse.length < 10) {
                                                                if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                                    sendBack(postsForResponse)
                                                                }
                                                            }
                                                        }
                                                    })
                                                }
                                            } else {
                                                forSendBackItemsProcessed++;
                                                //do like 10 load
                                                if (hasNotViewedPostsWithRequiredFields.length < 10) {
                                                    if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                        if (hasViewedPostsWithRequiredFields.length !== 0) {
                                                            forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                                        } else {
                                                            sendBack(postsForResponse)
                                                        }
                                                    }
                                                } else {
                                                    //more than 10
                                                    if (postsForResponse.length == 10) {
                                                        sendBack(postsForResponse)
                                                    } else if (postsForResponse.length < 10) {
                                                        if (forSendBackItemsProcessed == hasNotViewedPostsWithRequiredFields.length) {
                                                            sendBack(postsForResponse)
                                                        }
                                                    }
                                                }
                                            }
                                        })
                                    } else {
                                        var forSendBackItemsProcessed = 0
                                        var postsForResponse = []
                                        forAlreadyViewedOnes(forSendBackItemsProcessed, postsForResponse)
                                    }
                                } else {
                                    //None at all meaning there is not even viewed ones
                                    return resolve(HTTPWTHandler.notFound('There are no posts from anyone you follow.'))
                                }
                            }
                            //
                            let allPostsWithRequiredFieldsPrior = []
                            let itemsProcessed = 0
                            userIsFollowing.forEach(function (item, index) {
                                User.findOne({secondId: {$eq: userIsFollowing[index]}}).lean().then(userThatsFollowed => {
                                    if (userThatsFollowed) {
                                        //
                                        const getImagePosts = (callback) => {
                                            ImagePost.find({creatorId: {$eq: userThatsFollowed._id}}, {datePosted: 1, viewedBy: 1}).lean().then(imagePostsFound => {
                                                console.log(`imagePostsFound:`, imagePostsFound)
                                                if (imagePostsFound.length) {
                                                    let imagePostsProcessed = 0
                                                    const imagePostsFoundForReturn = []
                                                    imagePostsFound.forEach(function (item, index) {
                                                        imagePostsFoundForReturn.push({viewedBy: imagePostsFound[index].viewedBy, _id: imagePostsFound[index]._id, datePosted: imagePostsFound[index].datePosted, format: "Image"})
                                                        imagePostsProcessed++;
                                                        if (imagePostsProcessed == imagePostsFound.length) {
                                                            //console.log(`imagePostsFoundForReturn ${JSON.stringify(imagePostsFoundForReturn)}`)
                                                            return callback(imagePostsFoundForReturn)
                                                        }
                                                    })
                                                } else {
                                                    return callback([])
                                                }                                       
                                            }).catch(err => {
                                                console.error('An error occurred while finding image posts with id:', userThatsFollowed._id, '. The error was:', err)
                                                return callback([])
                                            })
                                        }
                                        //
                                        const getPollPosts = (callback) => {
                                            Poll.find({creatorId: {$eq: userThatsFollowed._id}}, {datePosted: 1, viewedBy: 1}).lean().then(pollPostsFound => {
                                                //console.log(`pollPostsFound ${pollPostsFound}`)
                                                if (pollPostsFound.length) {
                                                    let pollPostsProcessed = 0
                                                    const pollPostsFoundForReturn = []
                                                    pollPostsFound.forEach(function (item, index) {
                                                        //console.log("Interacted is true")
                                                        pollPostsFoundForReturn.push({viewedBy: pollPostsFound[index].viewedBy, _id: pollPostsFound[index]._id, datePosted: pollPostsFound[index].datePosted, format: "Poll"})
                                                        pollPostsProcessed++;
                                                        if (pollPostsProcessed == pollPostsFound.length) {
                                                            //console.log(`pollPostsFoundForReturn ${JSON.stringify(pollPostsFoundForReturn)}`)
                                                            return callback(pollPostsFoundForReturn)
                                                        }
                                                    })
                                                } else {
                                                    return callback([])
                                                }
                                            }).catch(err => {
                                                console.error('An error occurred while finding poll posts with id:', userThatsFollowed._id, '. The error was:', err)
                                                return callback([])
                                            })
                                        }
                                        //
                                        const getThreadPosts = (callback) => {
                                            Thread.find({creatorId: {$eq: userThatsFollowed._id}}, {datePosted: 1, viewedBy: 1, upVotes: 1, downVotes: 1}).lean().then(threadPostsFound => {
                                                //console.log(`threadPostsFound ${threadPostsFound}`)
                                                if (threadPostsFound.length) {
                                                    var threadPostsProcessed = 0
                                                    var threadPostsFoundForReturn = []
                                                    threadPostsFound.forEach(function (item, index) {
                                                        //console.log("Interacted is true")
                                                        threadPostsFoundForReturn.push({viewedBy: threadPostsFound[index].viewedBy, _id: threadPostsFound[index]._id, datePosted: threadPostsFound[index].datePosted, format: "Thread"})
                                                        threadPostsProcessed++;
                                                        if (threadPostsProcessed == threadPostsFound.length) {
                                                            //console.log(`threadPostsFoundForReturn ${JSON.stringify(threadPostsFoundForReturn)}`)
                                                            return callback(threadPostsFoundForReturn)
                                                        }
                                                    })
                                                } else {
                                                    return callback([])
                                                }
                                            }).catch(err => {
                                                console.error('An error occurred while finding thread posts with id:', userThatsFollowed._id, '. The error was:', err)
                                                return callback([])
                                            })
                                        }
                                        //
                                        getImagePosts(function(thisUserImages) {
                                            getPollPosts(function(thisUserPoll) {
                                                getThreadPosts(function(thisUserThreads) {
                                                    var concatOne = thisUserImages.concat(thisUserPoll)
                                                    const thisFollowedUsersPostRequiredFields = concatOne.concat(thisUserThreads)
                                                    allPostsWithRequiredFieldsPrior = allPostsWithRequiredFieldsPrior.concat(thisFollowedUsersPostRequiredFields)
                                                    //console.log(`allPostsWithRequiredFieldsPrior ${allPostsWithRequiredFieldsPrior}`)
                                                    //
                                                    itemsProcessed++;
                                                    if (itemsProcessed == userIsFollowing.length) {
                                                        afterGettingAllPosts(allPostsWithRequiredFieldsPrior)
                                                    }
                                                })
                                            })
                                        })
                                    } else {
                                        console.log("Couldnt find user that this user is following.")
                                        itemsProcessed++;
                                        if (itemsProcessed == userIsFollowing.length) {
                                            afterGettingAllPosts(allPostsWithRequiredFieldsPrior)
                                        }
                                    }
                                }).catch(err => {
                                    console.error('An error occurred while finding user with id:', userIsFollowing[index], '. The error was:', err)
                                    itemsProcessed++;
                                    if (itemsProcessed == userIsFollowing.length) {
                                        afterGettingAllPosts(allPostsWithRequiredFieldsPrior)
                                    }
                                })
                            })
                        } else {
                            return resolve(HTTPWTHandler.badInput('You do not follow anyone'))
                        }
                    } else {
                        return resolve(HTTPWTHandler.notFound('Could not find user due to incorrect userId passed.'))
                    }
                }).catch(err => {
                    console.error('An error occurred while finding users with id:', idOfUser, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                })
            } else {
                return resolve(HTTPWTHandler.badInput('alreadyOnCurrentFeed must be a string'))
            }
        })
    }

    static #forYouFeed = (idOfUser, alreadyOnCurrentFeed) => {
        return new Promise(resolve => {
            const sendBack = (posts) => {
                posts = posts.map(item => {
                    item._id = item._id.toString()
                    return item
                })
                return resolve(HTTPWTHandler.OK('Found posts.', posts))
            }
            console.log("JSFYF1" + dateFuncForTest())
            User.findOne({_id: {$eq: idOfUser}}).lean().then(userFound => {
                if (userFound) {
                    console.log("JSFYF2" + dateFuncForTest())
                    algorithmMain(idOfUser, alreadyOnCurrentFeed, 10, function(postIdsReturned) {
                        console.log("JSFYF3" + dateFuncForTest())
                        console.log("postIdsReturned");
                        console.log(postIdsReturned);
                        if (postIdsReturned.status == "SUCCESS") {
                            if (postIdsReturned.data.length > 0) {
                                ImagePost.find({_id: {$in: postIdsReturned.data}}).lean().then(postsFound => {
                                    if (postsFound.length) {
                                        console.log("JSFYF4" + dateFuncForTest())
                                        let forResponse = [];
                                        let itemsProcessed = 0;
                                        postsFound.forEach(function (item, index) {
                                            //for less requests we can use an array or dictionary and not have to repeat queries for same ids
                                            User.findOne({_id: {$eq: item.creatorId}}).lean().then(postUserFound => {
                                                if (postUserFound) {
                                                    imagePostHandler.processMultiplePostDataFromOneOwner([item], postUserFound, userFound).then(posts => {
                                                        posts[0].format = "Image"
                                                        forResponse.push(posts[0])

                                                        itemsProcessed++;
                                                        if (itemsProcessed == postsFound.length) {
                                                            if (forResponse.length > 0) {
                                                                console.log("JSFYF5" + dateFuncForTest())
                                                                sendBack(forResponse)
                                                            } else {
                                                                return resolve(HTTPWTHandler.badInput('No valid posts?'))
                                                            }
                                                        }
                                                    }).catch(error => {
                                                        console.error('An error occured while processing image posts for following feed. The error was:', error)

                                                        itemsProcessed++;
                                                        if (itemsProcessed == postsFound.length) {
                                                            if (forResponse.length > 0) {
                                                                console.log("JSFYF5" + dateFuncForTest())
                                                                sendBack(forResponse)
                                                            } else {
                                                                return resolve(HTTPWTHandler.badInput('No valid posts?'))
                                                            }
                                                        }
                                                    })
                                                } else {
                                                    itemsProcessed++;
                                                    if (itemsProcessed == postsFound.length) {
                                                        if (forResponse.length > 0) {
                                                            sendBack(forResponse)
                                                        } else {
                                                            return resolve(HTTPWTHandler.badInput('No valid posts?'))
                                                        }
                                                    }
                                                }
                                            }).catch(err => {
                                                console.log(err)
                                                itemsProcessed++;
                                                if (itemsProcessed == postsFound.length) {
                                                    if (forResponse.length > 0) {
                                                        sendBack(forResponse)
                                                    } else {
                                                        return resolve(HTTPWTHandler.badInput('No valid posts?'))
                                                    }
                                                }
                                            })
                                        })
                                    } else {
                                        return resolve(HTTPWTHandler.notFound('Images could not be obtained.'))
                                    }
                                }).catch(err => {
                                    console.error('An error occurred while finding image posts with their id inside of:', postIdsReturned.data, '. The error was:', err)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while getting images. Please try again later.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('There are no more posts that you have not seen multiple times already.'))
                            }
                        } else {
                            return resolve(HTTPWTHandler.serverError('An error occurred while getting your feed.'))
                        }
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(err => {
                console.error('An error occurred while finding users with id:', idOfUser, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again later.'))
            })
        })
    }

    static viewedPostInFeed = async (userId, postId, postFormat) => {
        return await this.#viewedPostInFeed(userId, postId, postFormat)
    }

    static followerFeed = async (idOfUser, alreadyOnCurrentFeed) => {
        return await this.#followerFeed(idOfUser, alreadyOnCurrentFeed)
    }

    static forYouFeed = async (idOfUser, alreadyOnCurrentFeed) => {
        return await this.#forYouFeed(idOfUser, alreadyOnCurrentFeed)
    }
}

module.exports = FeedController;