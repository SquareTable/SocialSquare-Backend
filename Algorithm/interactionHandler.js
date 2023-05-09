const User = require('./models/User');
const ImagePost = require('./models/ImagePost')

//over 1 values on "change" ones may cause issues but should be simple fixes
const recommendationChange = 1.2
const upcomingRecommendationChange = 1.8
const newInRecommendation = 100
const newUpcomingRecommendation = 5
const upComingToRecommendationAmount = 100
const recommendationMax = 800
const recommendationMin = 50
const upComingRecommendationMin = 5
const frequentlyPositiveReactionsChange = 1.2 
const upcomingFrequentlyPositiveReactionsChange = 1.8
const newInFrequentlyPositiveReactions = 100
const newUpcomingFrequentlyPositiveReactions = 5
const upcomingToFrequentlyPositiveAmount = 100
const frequentlyPositiveReactionsMax = 800
const frequentlyPositiveReactionsMin = 50
const upComingFrequentlyPositiveReactionsMin = 5

function interactionHandler(userId, keywords, interaction, postCreatorId) { //keywords an object incase wanting to add more in future
    User.findOne({_id: userId}).then(userFound => {
        if (userFound) {
            if (interaction == "upVote") {
                //positive
                keywords.forEach(function (item, index) {
                    try {
                        //Keyword based
                        let indexInRecommendation = userFound.algorithmData.recommendation.findIndex(x => x.stringVal == item);
                        if (indexInRecommendation > -1) {
                            let decidedNewValue = userFound.algorithmData.recommendation[indexInRecommendation].val * recommendationChange
                            if (decidedNewValue < recommendationMax) { //more than 800 is too much
                                let lowerOthersAmount = (decidedNewValue-userFound.algorithmData.recommendation[indexInRecommendation].val)/userFound.algorithmData.recommendation.length()
                                let newArray = userFound.algorithmData.recommendation.splice(indexInRecommendation, 1).map(x => x-lowerOthersAmount).concat({stringVal: item, val: decidedNewValue})
                                User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.recommendation': newArray}})
                            }
                        } else {
                            let indexInUpcomingRecommendation = userFound.algorithmData.upcomingRecommendation.findIndex(x => x.stringVal == item);
                            if (indexInUpcomingRecommendation > -1) {
                                let decidedNewValue = userFound.algorithmData.upcomingRecommendation[indexInUpcomingRecommendation].val * upcomingRecommendationChange
                                if (decidedNewValue < upComingToRecommendationAmount) {
                                    let newArray = userFound.algorithmData.upcomingRecommendation.splice(indexInUpcomingRecommendation, 1).concat({stringVal: item, val: decidedNewValue})
                                    User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.upcomingRecommendation': newArray}})
                                } else {
                                    //remove from upcoming and place in normal
                                    let lowerOthersAmount = newInRecommendation/userFound.algorithmData.recommendation.length()
                                    let newArray = userFound.algorithmData.map(x => x-lowerOthersAmount).concat({stringVal: item, val: newInRecommendation})
                                    User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.recommendation': newArray, $pull: {'algorithmData.$.upComingRecommendation': {stringVal: item}}}})
                                }
                            } else {
                                let indexInPostNegativeReactions = userFound.algorithmData.postNegativeReactions.findIndex(x => x.stringVal == item);
                                if (indexInPostNegativeReactions > -1) {
                                    // in negative
                                    let decidedNewValue = userFound.algorithmData.postNegativeReactions[indexInPostNegativeReactions] - 1
                                    if (decidedNewValue != 0) {
                                        User.findOneAndUpdate({_id: userId}, {$pull: {'algorithmData.$.postNegativeReactions': {stringVal: item}}, $push: {'algorithmData.$.postNegativeReactions': {stringVal: item, val: decidedNewValue}}})
                                    } else {
                                        //remove from negative
                                        User.findOneAndUpdate({_id: userId}, {$pull: {'algorithmData.$.postNegativeReactions': {stringVal: item}}})
                                    }
                                } else {
                                    //add to upcoming with very low number
                                    User.findOneAndUpdate({_id: userId}, {$push: {'algorithmData.$.upcomingRecommendation': {stringVal: item, val: newUpcomingRecommendation}}})
                                }
                            }
                        }
                        //Post creator based
                        let indexInFrequentlyPositiveReactions = userFound.algorithmData.frequentlyPositiveReactions.findIndex(x => x.stringVal == postCreatorId);
                        if (indexInFrequentlyPositiveReactions > -1) {
                            let decidedNewValue = userFound.algorithmData.frequentlyPositiveReactions[indexInFrequentlyPositiveReactions].val * frequentlyPositiveReactionsChange
                            if (decidedNewValue < frequentlyPositiveReactionsMax) { //more than 800 is too much
                                let lowerOthersAmount = (decidedNewValue-userFound.algorithmData.frequentlyPositiveReactions[indexInFrequentlyPositiveReactions].val)/userFound.algorithmData.frequentlyPositiveReactions.length()
                                let newArray = userFound.algorithmData.frequentlyPositiveReactions.splice(indexInFrequentlyPositiveReactions, 1).map(x => x-lowerOthersAmount).concat({stringVal: postCreatorId, val: decidedNewValue})
                                User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.frequentlyPositiveReactions': newArray}})
                            }
                        } else {
                            let indexInUpcomingFrequentlyPositiveReactions = userFound.algorithmData.upcomingFrequentlyPositiveReactions.findIndex(x => x.stringVal == postCreatorId);
                            if (indexInUpcomingFrequentlyPositiveReactions > -1) {
                                let decidedNewValue = userFound.algorithmData.upcomingFrequentlyPositiveReactions[indexInUpcomingFrequentlyPositiveReactions].val * upcomingFrequentlyPositiveReactionsChange
                                if (decidedNewValue < upcomingToFrequentlyPositiveAmount) {
                                    let newArray = userFound.algorithmData.upcomingFrequentlyPositiveReactions.splice(indexInUpcomingFrequentlyPositiveReactions, 1).concat({stringVal: postCreatorId, val: decidedNewValue})
                                    User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.upcomingFrequentlyPositiveReactions': newArray}})
                                } else {
                                    //remove from upcoming and place in normal
                                    let lowerOthersAmount = newInFrequentlyPositiveReactions/userFound.algorithmData.frequentlyPositiveReactions.length()
                                    let newArray = userFound.algorithmData.map(x => x-lowerOthersAmount).concat({stringVal: postCreatorId, val: newInFrequentlyPositiveReactions})
                                    User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.frequentlyPositiveReactions': newArray, $pull: {'algorithmData.$.upcomingFrequentlyPositiveReactions': {stringVal: postCreatorId}}}})
                                }
                            } else {
                                let indexInFrequentlyNegativeReactions = userFound.algorithmData.frequentlyNegativeReactions.findIndex(x => x.stringVal == postCreatorId);
                                if (indexInFrequentlyNegativeReactions > -1) {
                                    // in negative
                                    let decidedNewValue = userFound.algorithmData.frequentlyNegativeReactions[indexInFrequentlyNegativeReactions] - 1
                                    if (decidedNewValue != 0) {
                                        User.findOneAndUpdate({_id: userId}, {$pull: {'algorithmData.$.frequentlyNegativeReactions': {stringVal: postCreatorId}}, $push: {'algorithmData.$.frequentlyNegativeReactions': {stringVal: postCreatorId, val: decidedNewValue}}})
                                    } else {
                                        //remove from negative
                                        User.findOneAndUpdate({_id: userId}, {$pull: {'algorithmData.$.frequentlyNegativeReactions': {stringVal: postCreatorId}}})
                                    }
                                } else {
                                    //add to upcoming with very low number
                                    User.findOneAndUpdate({_id: userId}, {$push: {'algorithmData.$.upcomingFrequentlyPositiveReactions': {stringVal: postCreatorId, val: newUpcomingFrequentlyPositiveReactions}}})
                                }
                            }
                        }
                    } catch (err) {
                        console.log("Error in interaction handler.js in keywords loop.")
                        console.log(err)
                    }
                })
            } else if ("ignored") {
                //negative
                keywords.forEach(function (item, index) {
                    try {
                        //Keyword Based
                        let indexInRecommendation = userFound.algorithmData.recommendation.findIndex(x => x.stringVal == item);
                        if (indexInRecommendation > -1) {
                            let decidedNewValue = userFound.algorithmData.recommendation[indexInRecommendation].val * (1-((recommendationChange-1)/2))
                            if (decidedNewValue > recommendationMin) { //less than 50 is too low
                                let increaseOthersAmount = (userFound.algorithmData.recommendation[indexInRecommendation].val-decidedNewValue)/userFound.algorithmData.recommendation.length()
                                let newArray = userFound.algorithmData.recommendation.splice(indexInRecommendation, 1).map(x => x+increaseOthersAmount).concat({stringVal: item, val: decidedNewValue})
                                User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.recommendation': newArray}})
                            } else {
                                //less than 50
                                let increaseOthersAmount = userFound.algorithmData.recommendation[indexInRecommendation].val/userFound.algorithmData.recommendation.length()
                                let newArray = userFound.algorithmData.recommendation.splice(indexInRecommendation, 1).map(x => x+increaseOthersAmount)
                                User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.recommendation': newArray}})
                            }
                        } else {
                            let indexInUpcomingRecommendation = userFound.algorithmData.upcomingRecommendation.findIndex(x => x.stringVal == item);
                            if (indexInUpcomingRecommendation > -1) {
                                let decidedNewValue = userFound.algorithmData.upcomingRecommendation[indexInUpcomingRecommendation].val * (1-((upcomingRecommendationChange-1)/2))
                                if (decidedNewValue > upComingRecommendationMin) {
                                    let newArray = userFound.algorithmData.recommendation.splice(indexInUpcomingRecommendation, 1).concat({stringVal: item, val: decidedNewValue})
                                    User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.upcomingRecommendation': newArray}})
                                } else {
                                    //remove from upcoming
                                    User.findOneAndUpdate({_id: userId}, {$pull: {'algorithmData.$.upcomingRecommendation': {stringVal: item}}})
                                }
                            } /*else {
                                //Ignoring doesnt add to the negative reaction things
                            }*/
                        }
                        //Post creator based
                        let indexInFrequentlyPositiveReactions = userFound.algorithmData.frequentlyPositiveReactions.findIndex(x => x.stringVal == postCreatorId);
                        if (indexInFrequentlyPositiveReactions > -1) {
                            let decidedNewValue = userFound.algorithmData.frequentlyPositiveReactions[indexInFrequentlyPositiveReactions].val * (1-((frequentlyPositiveReactionsChange-1)/2))
                            if (decidedNewValue < frequentlyPositiveReactionsMin) { //less than 50 is too low
                                let increaseOthersAmount = (userFound.algorithmData.frequentlyPositiveReactions[indexInFrequentlyPositiveReactions].val-decidedNewValue)/userFound.algorithmData.frequentlyPositiveReactions.length()
                                let newArray = userFound.algorithmData.frequentlyPositiveReactions.splice(indexInFrequentlyPositiveReactions, 1).map(x => x+increaseOthersAmount).concat({stringVal: postCreatorId, val: decidedNewValue})
                                User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.frequentlyPositiveReactions': newArray}})
                            } else {
                                //less than 50
                                let increaseOthersAmount = userFound.algorithmData.frequentlyPositiveReactions[indexInFrequentlyPositiveReactions].val/userFound.algorithmData.frequentlyPositiveReactions.length()
                                let newArray = userFound.algorithmData.frequentlyPositiveReactions.splice(indexInFrequentlyPositiveReactions, 1).map(x => x+increaseOthersAmount)
                                User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.frequentlyPositiveReactions': newArray}})
                            }
                        } else {
                            let indexInUpcomingFrequentlyPositiveReactions = userFound.algorithmData.upcomingFrequentlyPositiveReactions.findIndex(x => x.stringVal == postCreatorId);
                            if (indexInUpcomingFrequentlyPositiveReactions > -1) {
                                let decidedNewValue = userFound.algorithmData.upcomingFrequentlyPositiveReactions[indexInUpcomingFrequentlyPositiveReactions].val * (1-((upcomingFrequentlyPositiveReactionsChange-1)/2))
                                if (decidedNewValue > upComingFrequentlyPositiveReactionsMin) {
                                    let newArray = userFound.algorithmData.upcomingFrequentlyPositiveReactions.splice(indexInUpcomingFrequentlyPositiveReactions, 1).concat({stringVal: postCreatorId, val: decidedNewValue})
                                    User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.upcomingFrequentlyPositiveReactions': newArray}})
                                } else {
                                    //remove from upcoming
                                    User.findOneAndUpdate({_id: userId}, {$pull: {'algorithmData.$.upcomingFrequentlyPositiveReactions': {stringVal: postCreatorId}}})
                                }
                            } /*else {
                                //Ignoring doenst add to the negative reaction things
                            }*/
                        }
                    } catch (err) {
                        console.log("Error in interaction handler.js in keywords loop.")
                        console.log(err)
                    }
                })
            } else { // (downvote)
                //more negative 
                keywords.forEach(function (item, index) {
                    try {
                        //Keyword Based
                        let indexInRecommendation = userFound.algorithmData.recommendation.findIndex(x => x.stringVal == item);
                        if (indexInRecommendation > -1) {
                            let decidedNewValue = userFound.algorithmData.recommendation[indexInRecommendation].val * (1-((recommendationChange-1)*2))
                            if (decidedNewValue > recommendationMin) { //less than 50 is too low
                                let increaseOthersAmount = (userFound.algorithmData.recommendation[indexInRecommendation].val-decidedNewValue)/userFound.algorithmData.recommendation.length()
                                let newArray = userFound.algorithmData.recommendation.splice(indexInRecommendation, 1).map(x => x+increaseOthersAmount).concat({stringVal: item, val: decidedNewValue})
                                User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.recommendation': newArray}})
                            } else {
                                //less than 50
                                let increaseOthersAmount = userFound.algorithmData.recommendation[indexInRecommendation].val/userFound.algorithmData.recommendation.length()
                                let newArray = userFound.algorithmData.recommendation.splice(indexInRecommendation, 1).map(x => x+increaseOthersAmount)
                                User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.recommendation': newArray}})
                            }
                        } else {
                            let indexInUpcomingRecommendation = userFound.algorithmData.upcomingRecommendation.findIndex(x => x.stringVal == item);
                            if (indexInUpcomingRecommendation > -1) {
                                let decidedNewValue = userFound.algorithmData.upcomingRecommendation[indexInUpcomingRecommendation].val * (1-((upcomingRecommendationChange-1)*2))
                                if (decidedNewValue > upComingRecommendationMin) {
                                    let newArray = userFound.algorithmData.recommendation.splice(indexInUpcomingRecommendation, 1).concat({stringVal: item, val: decidedNewValue})
                                    User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.upcomingRecommendation': newArray}})
                                } else {
                                    //remove from upcoming
                                    User.findOneAndUpdate({_id: userId}, {$pull: {'algorithmData.$.upcomingRecommendation': {stringVal: item}}})
                                }
                            } else {
                                //downvoting would add to the negative reaction things
                                let indexInPostNegativeReactions = userFound.algorithmData.postNegativeReactions.findIndex(x => x.stringVal == item);
                                if (indexInPostNegativeReactions > -1) {
                                    // in negative
                                    let decidedNewValue = userFound.algorithmData.postNegativeReactions[indexInPostNegativeReactions] + 1
                                    if (decidedNewValue <= 5) {
                                        User.findOneAndUpdate({_id: userId}, {$pull: {'algorithmData.$.postNegativeReactions': {stringVal: item}}, $push: {'algorithmData.$.postNegativeReactions': {stringVal: item, val: decidedNewValue}}})
                                    }
                                } else {
                                    //add to negative with low number
                                    User.findOneAndUpdate({_id: userId}, {$push: {'algorithmData.$.postNegativeReactions': {stringVal: item, val: 1}}})
                                }
                            }
                        }
                        //Post creator based
                        let indexInFrequentlyPositiveReactions = userFound.algorithmData.frequentlyPositiveReactions.findIndex(x => x.stringVal == postCreatorId);
                        if (indexInFrequentlyPositiveReactions > -1) {
                            let decidedNewValue = userFound.algorithmData.frequentlyPositiveReactions[indexInFrequentlyPositiveReactions].val * (1-((frequentlyPositiveReactionsChange-1)*2))
                            if (decidedNewValue < frequentlyPositiveReactionsMin) { //less than 50 is too low
                                let increaseOthersAmount = (userFound.algorithmData.frequentlyPositiveReactions[indexInFrequentlyPositiveReactions].val-decidedNewValue)/userFound.algorithmData.frequentlyPositiveReactions.length()
                                let newArray = userFound.algorithmData.frequentlyPositiveReactions.splice(indexInFrequentlyPositiveReactions, 1).map(x => x+increaseOthersAmount).concat({stringVal: postCreatorId, val: decidedNewValue})
                                User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.frequentlyPositiveReactions': newArray}})
                            } else {
                                //less than 50
                                let increaseOthersAmount = userFound.algorithmData.frequentlyPositiveReactions[indexInFrequentlyPositiveReactions].val/userFound.algorithmData.frequentlyPositiveReactions.length()
                                let newArray = userFound.algorithmData.frequentlyPositiveReactions.splice(indexInFrequentlyPositiveReactions, 1).map(x => x+increaseOthersAmount)
                                User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.frequentlyPositiveReactions': newArray}})
                            }
                        } else {
                            let indexInUpcomingFrequentlyPositiveReactions = userFound.algorithmData.upcomingFrequentlyPositiveReactions.findIndex(x => x.stringVal == postCreatorId);
                            if (indexInUpcomingFrequentlyPositiveReactions > -1) {
                                let decidedNewValue = userFound.algorithmData.upcomingFrequentlyPositiveReactions[indexInUpcomingFrequentlyPositiveReactions].val * (1-((upcomingFrequentlyPositiveReactionsChange-1)*2))
                                if (decidedNewValue > upComingFrequentlyPositiveReactionsMin) {
                                    let newArray = userFound.algorithmData.upcomingFrequentlyPositiveReactions.splice(indexInUpcomingFrequentlyPositiveReactions, 1).concat({stringVal: postCreatorId, val: decidedNewValue})
                                    User.findOneAndUpdate({_id: userId}, {$set: {'algorithmData.$.upcomingFrequentlyPositiveReactions': newArray}})
                                } else {
                                    //remove from upcoming
                                    User.findOneAndUpdate({_id: userId}, {$pull: {'algorithmData.$.upcomingFrequentlyPositiveReactions': {stringVal: postCreatorId}}})
                                }
                            } else {
                                let indexInFrequentlyNegativeReactions = userFound.algorithmData.frequentlyNegativeReactions.findIndex(x => x.stringVal == postCreatorId);
                                if (indexInFrequentlyNegativeReactions > -1) {
                                    // in negative
                                    let decidedNewValue = userFound.algorithmData.frequentlyNegativeReactions[indexInFrequentlyNegativeReactions] + 1
                                    if (decidedNewValue <= 5) {
                                        User.findOneAndUpdate({_id: userId}, {$pull: {'algorithmData.$.frequentlyNegativeReactions': {stringVal: postCreatorId}}, $push: {'algorithmData.$.frequentlyNegativeReactions': {stringVal: postCreatorId, val: decidedNewValue}}})
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.log("Error in interaction handler.js in keywords loop.")
                        console.log(err)
                    }
                })
            }
        } else {
            console.log("Couldn't find user in interactionHandler.js (userId: " + userId +" )")
        }
    }).catch(err => {
        console.log("Error in interactionHandler.js")
        console.log(err)
    })
}


exports.interactionHandler = interactionHandler;
