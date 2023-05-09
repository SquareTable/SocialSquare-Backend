//MongoDB <3
const mongodb = require('mongodb');
var ObjectID = require('mongodb').ObjectID;

//Schemas
const User = require('./../models/User');
const Poll = require('./../models/Poll');
const ImagePost = require('./../models/ImagePost');
const Category = require('./../models/Category');
const Thread = require('./../models/Thread')
const PopularPosts = require('./../models/PopularPosts')

// \/ Main Program \/ \\

// IM is importance multiplier
// CTBC is chance to be chosen
const sectorValues = {
    recommendation: {IM: 3}, //higher IM but val moves slower than UR
    upcomingRecommendation: {IM: 2}, //lower IM but val moves faster than UR
    frequentlyPositiveReactions: {IM: 3}, //higher IM but val moves slower than UFPR
    upcomingFrequentlyPositiveReactions: {IM: 2}, //lower IM but val moves faster than FPR
    frequentlyNegativeReactions: {IM: 0},
    postNegativeReactions: {IM: 0}
};

const seenTooMuch = 5;

const dateFuncForTest = () => {
    var currentdate = new Date(); 
    var datetime = "Last Sync: " + currentdate.getDate() + "/"
        + (currentdate.getMonth()+1)  + "/" 
        + currentdate.getFullYear() + " @ "  
        + currentdate.getHours() + ":"  
        + currentdate.getMinutes() + ":" 
        + currentdate.getSeconds(); 
    return datetime
};

function sortByDate(forSort) {
    return forSort.sort(function(a, b){
        var fUpToDownVotes = a.upToDownVotes
        var sUpToDownVotes = b.upToDownVotes
        var aViewedAmount = a.viewedAmount
        var bViewedAmount = b.viewedAmount
        var first = a.datePosted
        var second = b.datePosted
        if (fUpToDownVotes !== sUpToDownVotes) {
            return fUpToDownVotes > sUpToDownVotes ? -1 : (fUpToDownVotes > sUpToDownVotes ? 1 : 0);
        } else if (aViewedAmount !== bViewedAmount) {
            return aViewedAmount > bViewedAmount ? -1 : (aViewedAmount > bViewedAmount ? 1 : 0);
        } else {
            return a.datePosted > b.datePosted ? -1 : (a.datePosted > b.datePosted ? 1 : 0);
        }
    });
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

async function getPostFromRecommendations(decidedKey, userId, userPubId, postIdsAlready, callback) {
    console.log("AM2: " + dateFuncForTest())
    console.log(postIdsAlready)
    if (decidedKey == "~popular") { //to speed up we can reduce the amount of db requests made
        console.log("~popular")
        await PopularPosts.findOne().then(popularPostsDoc => {
            if (!popularPostsDoc) {
                console.log("Couldn't find popular posts doc")
                return callback(null)  
            } else { 
                console.log("1")
                var arrayOfIds = popularPostsDoc.popularPosts
                var iterationsResult
                const forAsync = async () => {
                    for (let i = 0; i < arrayOfIds.length-1; i++) {
                        async function decidePost(callback) {
                            let randomIndex = Math.floor(Math.random() * arrayOfIds.length);
                            let randomPost = arrayOfIds[randomIndex] //As Id rather have random than a descending from top
                            console.log(randomPost)
                            if (postIdsAlready.findIndex(x => alreadyOnCurrentFeedIdsChecker(x, randomPost._id)) !== -1) {
                                arrayOfIds.splice(randomIndex, 1)
                            } else {
                                await ImagePost.findOne({_id: randomPost._id}, {"upVotes": 1, "downVotes": 1, "viewedBy": 1}).then(thisImagePost => {
                                    if (!thisImagePost) {
                                        console.log("Couldn't find this index's post")
                                        arrayOfIds.splice(randomIndex, 1)
                                        return callback("Blacklist")
                                    } else {
                                        if (thisImagePost.upVotes.includes(userId) || thisImagePost.downVotes.includes(userId)) {
                                            arrayOfIds.splice(randomIndex, 1)
                                            return callback("Blacklist")
                                        } else {
                                            let viewedBy = []
                                            if (thisImagePost.hasOwnProperty("viewedBy")) {
                                                viewedBy = thisImagePost.viewedBy
                                            }
                                            userHasViewed = viewedBy.findIndex(x => x.pubId == userPubId)
                                            if (userHasViewed > -1) {
                                                if (viewedBy[userHasViewed].amount > seenTooMuch) { //seen too much
                                                    arrayOfIds.splice(randomIndex, 1)
                                                    return callback("Blacklist")
                                                } else {
                                                    //console.log("Success: " + str(randomPost._id))
                                                    console.log("2")
                                                    return callback(randomPost._id)
                                                }
                                            } else {
                                                //might as well consider as a success
                                                console.log("3")
                                                return callback(randomPost._id)
                                            }
                                        }
                                    }
                                }).catch(err => {
                                    console.log("Error occured when finding image post of id: " + randomPost._id)
                                    console.log(err)
                                    arrayOfIds.splice(randomIndex, 1)
                                })
                            }
                        }
                        await decidePost(function(iterationsResultF) {
                            //break out if found
                            iterationsResult = iterationsResultF
                        })
                        if (iterationsResult !== "Blacklist") {
                            break
                        }
                    }
                }
                forAsync().then(() => {
                    console.log("After loop")
                    return callback(iterationsResult)
                })
            }
        }).catch(err => {
            console.log("Error occured finding popular posts")
            console.log(err)
            return callback(null)
        })
    } else {
        //console.log("Recommendation " + decidedKey)
        await ImagePost.find({"tags": decidedKey}, {"upVotes": 1, "downVotes": 1, "viewedBy": 1}).then(imagePostsRecommended => { //CHANGE in future to not have to get every single post or something (could do in 100s or smth by date if thats possible in a query)
            if (imagePostsRecommended.length) {
                let postsToUse = []
                let itemsProcessed = 0;
                imagePostsRecommended.forEach(function(post, index) {
                    if (postIdsAlready.findIndex(x => alreadyOnCurrentFeedIdsChecker(x, post._id)) !== -1 || post.upVotes.includes(userId) || post.downVotes.includes(userId) ) {
                        itemsProcessed++;
                    } else {
                        let viewedBy = []
                        if (post.hasOwnProperty("viewedBy")) {
                            viewedBy = post.viewedBy
                        }
                        userHasViewed = viewedBy.findIndex(x => x.pubId == userPubId)
                        if (userHasViewed > -1) {
                            if (viewedBy[userHasViewed].amount > seenTooMuch) { //seen too much
                                itemsProcessed++;
                            } else {
                                //console.log("Success: " + str(randomPost._id))
                                itemsProcessed++;
                                postsToUse.push({postId: post._id, viewedAmount: userHasViewed.amount, datePosted: post.datePosted, upToDownVotes: post.upVotes.length-post.downVotes.length})
                            }
                        } else {
                            //might as well consider as a success
                            itemsProcessed++;
                            postsToUse.push({postId: post._id, viewedAmount: userHasViewed.amount, datePosted: post.datePosted, upToDownVotes: post.upVotes.length-post.downVotes.length})
                        }   
                        
                        if (itemsProcessed == imagePostsRecommended.length) {
                            if (postsToUse.length !== 0) {
                                //console.log(postsToUse)
                                sortedPosts = sortByDate(postsToUse)
                                //console.log("Sorted: \n")
                                //console.log(sortedPosts)
                                return callback(sortedPosts[0].postId) //change to favour lower
                            } else {
                                return callback("Blacklist")
                            }
                                
                        }
                    }
                })
            } else {
                return callback("Blacklist")
            }
        }).catch(err => {
            console.log("Error finding posts with tag: " + decidedKey)
            console.log(err)
            return callback(null)
        })
    }
}

async function getPostFromPostCreator(decidedUser, userId, userPubId, postIdsAlready, following, callback) {
    console.log("AM3: " + dateFuncForTest())
    console.log(postIdsAlready)
    //console.log("1 following: " + str(following))
    if (decidedUser == "~following") {
        console.log("following")
        //console.log("1")
        await User.find({"secondId": {"$in": following}}, {_id: 1}).then(usersIfAnyFound => {
            //console.log(usersIfAny)
            if (usersIfAnyFound.length !== 0) {
                usersIfAny = usersIfAnyFound.map(x => x._id)
                //console.log("2")
                ImagePost.find({"creatorId": {"$in": usersIfAny}}, {"upVotes" : 1, "downVotes": 1, "viewedBy": 1, "datePosted": 1}).then(possibleImagePosts => { //only need these values _id is there by defailt
                    if (possibleImagePosts.length !== 0) {
                        //console.log("3")
                        //console.log(possibleImagePosts)
                        let postsToUse = []
                        var itemsProcessed = 0;
                        possibleImagePosts.forEach(function(post, index) {
                            //console.log(post)
                            if (post.upVotes.includes(userId) || post.downVotes.includes(userId)) {
                                itemsProcessed++;
                            } else if (postIdsAlready.findIndex(x => alreadyOnCurrentFeedIdsChecker(x, post._id)) !== -1) {
                                itemsProcessed++;
                            } else {
                                let viewedBy = []
                                if (post.hasOwnProperty("viewedBy")) {
                                    viewedBy = post.viewedBy
                                }
                                userHasViewed = viewedBy.findIndex(x => x.pubId == userPubId)
                                if (userHasViewed > -1) {
                                    if (viewedBy[userHasViewed].amount > seenTooMuch) { //seen too much
                                        itemsProcessed++;
                                    } else {
                                        //console.log("Success: " + str(randomPost._id))
                                        postsToUse.push({postId: post._id, viewedAmount: userHasViewed.amount, datePosted: post.datePosted, upToDownVotes: post.upVotes.length-post.downVotes.length})
                                        itemsProcessed++;
                                    }
                                } else {
                                    //might as well consider as a success
                                    postsToUse.push({postId: post._id, viewedAmount: userHasViewed.amount, datePosted: post.datePosted, upToDownVotes: post.upVotes.length-post.downVotes.length})
                                    itemsProcessed++;
                                }
                            }

                            if (itemsProcessed == possibleImagePosts.length) {
                                if (postsToUse.length !== 0) {
                                    //console.log(postsToUse)
                                    //console.log("4")
                                    sortedPosts = sortByDate(postsToUse)
                                    //console.log("5")
                                    //console.log("Sorted: \n")
                                    //console.log(sortedPosts)
                                    return callback(sortedPosts[0].postId) // change to favour lower
                                } else {
                                    return callback("Blacklist")
                                }
                            }
                        })
                    } else {
                        console.log("No posts from following")
                        return callback("Blacklist")
                    }
                }).catch(err => {
                    console.log("Error finding image posts of following.")
                    console.log(err)
                    return callback(null)
                })
            } else {
                console.log("Likely none they are following")
                return callback("Blacklist")
            }
        }).catch(err => {
            console.log("Error finding users following")
            console.log(err)
            return callback(null)
        })
    } else {
        //console.log("User " + decidedUser)
        var postCreatorObjectId = decidedUser
        await User.find({_id: postCreatorObjectId}).then(postCreator => {
            if (postCreator.length) {
                //user exists
                ImagePost.find({"creatorId": postCreatorObjectId}, {"upVotes" : 1, "downVotes": 1, "viewedBy": 1, "datePosted": 1}).then(postCreatorsImagePosts => { //only need these values _id is there by defailt
                    //console.log(postCreatorsImagePosts)
                    if (postCreatorsImagePosts.length) {
                        var postsToUse = [];
                        let itemsProcessed = 0;
                        postCreatorsImagePosts.forEach(function(post, index) {
                            if (post.upVotes.includes(userId) || post.downVotes.includes(userId)) {
                                itemsProcessed++;
                            } else if (postIdsAlready.findIndex(x => alreadyOnCurrentFeedIdsChecker(x, randomPost._id)) !== -1) {
                                itemsProcessed++;
                            } else {
                                let viewedBy = []
                                if (post.hasOwnProperty("viewedBy")) {
                                    viewedBy = post.viewedBy
                                }
                                userHasViewed = viewedBy.findIndex(x => x.pubId == userPubId)
                                if (userHasViewed > -1) {
                                    if (viewedBy[userHasViewed].amount > seenTooMuch) { //seen too much
                                        itemsProcessed++;
                                    } else {
                                        //console.log("Success: " + str(randomPost._id))
                                        postsToUse.push({postId: post._id, viewedAmount: userHasViewed.amount, datePosted: post.datePosted, upToDownVotes: post.upVotes.length-post.downVotes.length})
                                    }
                                } else {
                                    //might as well consider as a success
                                    postsToUse.push({postId: post._id, viewedAmount: userHasViewed.amount, datePosted: post.datePosted, upToDownVotes: post.upVotes.length-post.downVotes.length})
                                }
                            }

                            if (itemsProcessed == postCreatorsImagePosts) {
                                if (postsToUse.length != 0) {
                                    //console.log(postsToUse)
                                    sortedPosts = sortByDate(postsToUse)
                                    //console.log("Sorted: \n")
                                    //console.log(sortedPosts)
                                    return callback(sortedPosts[0].postId)
                                } else {
                                    return callback("Blacklist")
                                }
                            }
                        })
                    } else {
                        console.log("No posts by this user")
                        return callback(null)
                    }
                }).catch(err => {
                    console.log("Error finding images of creator: " + decidedUser)
                    console.log(err)
                    return callback(null)
                })
            } else {
                return callback(null)
            }
        }).catch(err => {
            console.log("Error finding post creator: " + decidedUser)
            console.log(err)
            return callback(null)
        })
    }
}
//console.log(getPostFromPostCreator("61416af34b1919000421eb68", "61413c93818714000457c09f", "34a0d72d-971a-4284-a9bb-b78adf954c0f", [''ObjectId("61bda9c499aefa0004226e88")''])) //missing few speech marks due to test

async function algorithmMain(userId, alreadyOnFeed, amountRequesting, callback) {
    try {
        console.log("AM1: " + dateFuncForTest())
    
        var alreadyOnCurrentFeedIds = [] //TODO test more make better?

        //console.log(alreadyOnFeed)
        if (alreadyOnFeed != "") {
            //console.log(alreadyOnCurrentFeedIds)
            var splitAlreadyOnCurrentFeedIds = alreadyOnFeed.split(",")
            alreadyOnCurrentFeedIds = splitAlreadyOnCurrentFeedIds.map(x => x.trim())
            //console.log(alreadyOnCurrentFeedIds)
        }

        console.log(userId)
        await User.findOne({_id: userId}).then(userFound => {
            if (!userFound) {        
                return callback({status : "FAILED", message : "Couldn't find user."});
            } else {
                var userPubId = userFound.secondId;
                var usersR = userFound.algorithmData.recommendation;
                var usersUR = userFound.algorithmData.upcomingRecommendation;
                var usersFPR = userFound.algorithmData.frequentlyPositiveReactions;
                var usersUFPR = userFound.algorithmData.upcomingFrequentlyPositiveReactions;
    
                var arrayOfAll = [{CTBC: 0}]; //inital value for 0 just bc why not is actually used in the .reduce() tho
                var sumCTBC = 0
                //CTBC is a range type of thing if there is only two in array and the second has a 1000/5000 chance, the first in array will be 4000 and second will be 5000
                usersR.forEach(function(item, index) {
                    sumCTBC += item.val*sectorValues.recommendation.IM
                    arrayOfAll.push({CTBC: item.val*sectorValues.recommendation.IM+arrayOfAll[arrayOfAll.length-1].CTBC, stringVal: item.stringVal, sector: "recommendation"})
                })
                
                usersUR.forEach(function(item, index) {
                    sumCTBC += item.val*sectorValues.upcomingRecommendation.IM
                    arrayOfAll.push({CTBC: item.val*sectorValues.upcomingRecommendation.IM+arrayOfAll[arrayOfAll.length-1].CTBC, stringVal: item.stringVal, sector: "upcomingRecommendation"})
                })
                
                usersFPR.forEach(function(item, index) {
                    if (item.stringVal !== "~none") {
                        sumCTBC += item.val*sectorValues.frequentlyPositiveReactions.IM
                        arrayOfAll.push({CTBC: item.val*sectorValues.frequentlyPositiveReactions.IM+arrayOfAll[arrayOfAll.length-1].CTBC, stringVal: item.stringVal, sector: "frequentlyPositiveReactions"})
                    }
                })

                usersUFPR.forEach(function(item, index) {
                    sumCTBC += item.val*sectorValues.upcomingFrequentlyPositiveReactions.IM
                    arrayOfAll.push({"CTBC": item.val*sectorValues.upcomingFrequentlyPositiveReactions.IM+arrayOfAll[arrayOfAll.length-1].CTBC, "stringVal": item.stringVal, "sector": "upcomingFrequentlyPositiveReactions"})
                })

                /* ngl I dont think this is rlly needed
                //remove any unlikely duplicates
                const notDuplicates = [];

                const unique = arrayOfAll.slice(1).filter(x => {
                    if (notDuplicates.includes(x.stringVal)) {
                        return false;
                    } else {
                        return true;
                    }
                });
                */
                
                var postsForResponse = []
                var blackList = [] //if no posts eligible (dont really have to seperate to user ids for fpr/ufpr and keywords for r/ur as a userid as a keyword is a stupid keyword anyway)
                const forAsync = async () => {
                    while (true) {
                        const funcForLoop = async (callback) => {
                            //console.log(sumCTBC)
                            sectorSelector =  Math.floor(Math.random() * sumCTBC) + 1;
                            //console.log(sectorSelector)
                            var chosenStringValAndSector = arrayOfAll.reduce((previousVal, currentVal) => {
                                console.log(sectorSelector)
                                //console.log(currentVal)
                                //console.log(previousVal)
                                if (sectorSelector <= currentVal.CTBC && sectorSelector > previousVal.CTBC) {
                                    return currentVal
                                } else {
                                    return previousVal
                                }
                            }, {CTBC: 0})
                            console.log("Chose:")
                            console.log(chosenStringValAndSector)
                            if (!blackList.includes(chosenStringValAndSector.stringVal)) {
                                if (chosenStringValAndSector.sector == "recommendation" || chosenStringValAndSector.sector == "upcomingRecommendation") {
                                    await getPostFromRecommendations(chosenStringValAndSector.stringVal, userId, userPubId, alreadyOnCurrentFeedIds, async function(postFromRecommendations) {
                                        console.log("PFR")
                                        console.log(postFromRecommendations)
                                        if (postFromRecommendations == null) {
                                            console.log("Posts from: " + chosenStringValAndSector.stringVal + " failed in getPostFromRecommendations")
                                            return callback()
                                        } else if (postFromRecommendations == "Blacklist") {
                                            //blackList.push(chosenStringValAndSector.stringVal)
                                            return callback("blackList", chosenStringValAndSector.stringVal)
                                        } else { 
                                            //postsForResponse.push(postFromRecommendations)
                                            console.log("Success")
                                            console.log("AM4: " + dateFuncForTest())
                                            return callback("postsForResponse", postFromRecommendations)
                                        }
                                    })
                                } else {
                                    //the post creator based ones (FPR, UFPR)
                                    var followingForSend = null
                                    if (chosenStringValAndSector.stringVal == "~following") {
                                        followingForSend = userFound.following
                                    }
                                    await getPostFromPostCreator(chosenStringValAndSector.stringVal, userId, userPubId, alreadyOnCurrentFeedIds, followingForSend, async function(postFromPostCreator) {
                                        console.log("PFPC")
                                        console.log(postFromPostCreator)
                                        if (postFromPostCreator == null) {
                                            //console.log("Posts from: " + chosenStringValAndSector.stringVal + " failed in getPostFromPostCreator")
                                            return callback()
                                        } else if (postFromPostCreator == "Blacklist") {
                                            //blackList.push(chosenStringValAndSector.stringVal)
                                            return callback("blackList", chosenStringValAndSector.stringVal)
                                        } else { 
                                            //postsForResponse.push(postFromPostCreator)
                                            console.log("Success")
                                            console.log("AM5: " + dateFuncForTest())
                                            return callback("postsForResponse", postFromPostCreator)
                                        }
                                    })
                                }
                            }
                        }
                        await funcForLoop(function(list, val) {
                            if (list == "blackList") {
                                blackList.push(val)
                            } else if (list == "postsForResponse") {
                                alreadyOnCurrentFeedIds.push(val)
                                postsForResponse.push(val)
                            } else {
                                console.log("Null would have been returned")
                            }
                        })
                        if (postsForResponse.length >= amountRequesting || blackList.length + postsForResponse.length >= arrayOfAll.length-1) { //fix?
                            break
                        }
                    }
                }
                forAsync().then(() => {
                    //After looping done this point shall be reached
                    //console.log(postsForResponse)
                    console.log("Done")
                    if (postsForResponse.length < 10) {
                        return callback({"status" : "SUCCESS", "message" : "Done", "data": postsForResponse}); // change this soon to get 
                    } else {
                        return callback({"status" : "SUCCESS", "message" : "Done", "data": postsForResponse});
                    }
                })
            }
        }).catch(err => {
            console.log("Error finding user in AM: " + userId)
            console.log(err)
            return callback({status : "FAILED", message : "Error finding user in AM"});
        })
    } catch(err) {
        console.log("Error occured in for you feed")
        console.log(err)
        return callback({status : "FAILED", message : "Error occured in for you feed"});
    }
}

exports.algorithmMain = algorithmMain;