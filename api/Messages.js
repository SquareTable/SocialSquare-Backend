const express = require('express');
const router = express.Router();

//Schemas
const Message = require("../models/Message")
const User = require('../models/User');
const Conversation = require('../models/Conversation');

//Web Token Stuff

const { tokenValidation } = require("../middleware/TokenHandler");

//UNCOMMENT THE LINE BELOW AFTER CHATS HAVE BEEN REMADE
//router.all("/{*splat}", [tokenValidation]); // the /{*splat} just makes it that it affects them all it could be /whatever and it would affect that only

//load first 20 or 20 more messages of gc
router.get("/loadmessages/:conversationId/:lastLoaded", (req,res)=>{
    const lastLoaded = req.params.lastLoaded
    Message.find({conversationId: {$eq: req.params.conversationId}}).then(result => { 
        if (result.length) {
            //messages exist
            const allMessagesFound = [];
            var itemsProcessed = 0;
            const afterSort = (afterSorted) => {
                console.log("After sorted")
                if (lastLoaded == null || typeof lastLoaded == "undefined") {
                    res.json({
                        status: "FAILED",
                        message: "Error with last message loaded passed."
                    })
                } else {
                    var lastLoadedIndex = -1;
                    if (lastLoaded == "firstLoad") {
                        lastLoadedIndex = 0;
                    } else {
                        lastLoadedIndex = afterSorted.findIndex(x => x._id == lastLoaded);
                    }
                    if (lastLoadedIndex !== -1) {
                        var lastLoadedPosition = 0;
                        if (lastLoaded !== "firstLoad") lastLoadedPosition = lastLoadedIndex + 1;
                        if (afterSorted.length - lastLoadedPosition == 0) {
                            res.json({
                                status: "SUCCESS",
                                message: "All messages loaded already"
                            })
                        } else {
                            var LLIPlusTwenty = lastLoadedPosition + 20;
                            for (let index = lastLoadedPosition; index <= LLIPlusTwenty; index++) {
                                if (afterSorted[index]) {
                                    console.log(afterSorted[index].datePosted);
                                    if (index <= lastLoadedIndex && lastLoadedPosition !== 0) { //the !== 0 here is for the first load to allow the latest message
                                        //before not after last loaded
                                        console.log(`Index was lower than last loaded index ${afterSorted[index].datePosted}`);
                                    } else {
                                        if (afterSorted[index].isServerMessage !== true) {
                                            let inReplyTo = "";
                                            if (afterSorted[index].inReplyTo !== "") {
                                                let msgReplyingTo = afterSorted.find(x => x._id == afterSorted[index].inReplyTo);
                                                if (typeof msgReplyingTo == "undefined") {
                                                    inReplyTo = {
                                                        _id: "Couldn't find",
                                                        publicId: "",
                                                        senderName: "",
                                                        senderImageKey: "",
                                                        senderDisplayName: "",
                                                        isEncrypted: false,
                                                        chatText: "",
                                                        datePosted: 0,
                                                        dateUpdated: 0,
                                                        cryptographicNonce: [],
                                                        encryptedChatText: [],
                                                        isServerMessage: false,
                                                        involvedIds: {},
                                                        messageReactions: [],
                                                        inReplyTo: "",
                                                        attatchments: []
                                                    }
                                                } else {
                                                    inReplyTo = {
                                                        _id: msgReplyingTo._id,
                                                        publicId: afterSorted[index].involvedIds.repliedToPubId,
                                                        senderName: "",
                                                        senderImageKey: "",
                                                        senderDisplayName: "",
                                                        isEncrypted: msgReplyingTo.isEncrypted,
                                                        chatText: msgReplyingTo.chatText,
                                                        datePosted: msgReplyingTo.datePosted,
                                                        dateUpdated: msgReplyingTo.dateUpdated,
                                                        cryptographicNonce: msgReplyingTo.cryptographicNonce,
                                                        encryptedChatText: msgReplyingTo.encryptedChatText,
                                                        isServerMessage: false,
                                                        involvedIds: msgReplyingTo.involvedIds,
                                                        messageReactions: msgReplyingTo.messageReactions,
                                                        inReplyTo: msgReplyingTo.inReplyTo,
                                                        attatchments: msgReplyingTo.attatchments
                                                    }
                                                    User.findOne({_id: {$eq: msgReplyingTo.senderId}}).then(userRepliedTo => {
                                                        if (!userRepliedTo) {
                                                            inReplyTo.publicId = afterSorted[index].involvedIds.repliedToPubId
                                                            inReplyTo.senderName = ""
                                                            inReplyTo.senderImageKey = ""
                                                            inReplyTo.senderDisplayName = ""
                                                        } else {
                                                            inReplyTo.publicId = afterSorted[index].involvedIds.repliedToPubId
                                                            inReplyTo.senderName = userRepliedTo.name
                                                            inReplyTo.senderImageKey = userRepliedTo.profileImageKey
                                                            inReplyTo.senderDisplayName = userRepliedTo.displayName
                                                        }
                                                    }).catch(err => {
                                                        console.log(err)
                                                        inReplyTo.publicId = afterSorted[index].involvedIds.repliedToPubId
                                                        inReplyTo.senderName = ""
                                                        inReplyTo.senderImageKey = ""
                                                        inReplyTo.senderDisplayName = ""
                                                    })
                                                }
                                            }
                                            User.find({_id: {$eq: afterSorted[index].senderId}}).then(data => {
                                                if (data.length) {
                                                    var toPush = {
                                                        _id: afterSorted[index]._id,
                                                        publicId: data[0].secondId,
                                                        senderName: data[0].name,
                                                        senderImageKey: data[0].profileImageKey,
                                                        senderDisplayName: data[0].displayName,
                                                        chatText: afterSorted[index].chatText,
                                                        isEncrypted: afterSorted[index].isEncrypted,
                                                        datePosted: afterSorted[index].datePosted,
                                                        dateUpdated: afterSorted[index].dateUpdated,
                                                        cryptographicNonce: afterSorted[index].cryptographicNonce,
                                                        encryptedChatText: afterSorted[index].encryptedChatText,
                                                        involvedIds: afterSorted[index].involvedIds,
                                                        isServerMessage: false,
                                                        messageReactions: afterSorted[index].messageReactions,
                                                        inReplyTo: inReplyTo,
                                                        attatchments: afterSorted[index].attatchments
                                                    }
                                                    allMessagesFound.push(toPush);
                                                    itemsProcessed++;
                                                    if (afterSorted.length - lastLoadedPosition < 20 ) {
                                                        if (itemsProcessed == afterSorted.length - lastLoadedPosition) {
                                                            res.json({
                                                                status: "SUCCESS",
                                                                message: "Messages found.",
                                                                data: allMessagesFound
                                                            })
                                                        }
                                                    } else {
                                                        //more than 20 msgs to load
                                                        if (itemsProcessed == 20) {
                                                            res.json({
                                                                status: "SUCCESS",
                                                                message: "Messages found.",
                                                                data: allMessagesFound
                                                            })
                                                        }
                                                    }
                                                } else {
                                                    res.json({
                                                        status: "FAILED",
                                                        message: "Sender not found."
                                                    })
                                                }
                                            }).catch(err => {
                                                console.log(err)
                                                res.json({
                                                    status: "FAILED",
                                                    message: "Error with finding message sender."
                                                })
                                            })
                                        } else {
                                            var toPush = {
                                                _id: afterSorted[index]._id,
                                                publicId: "",
                                                senderName: "",
                                                senderImageKey: "",
                                                senderDisplayName: "",
                                                chatText: afterSorted[index].chatText,
                                                isEncrypted: afterSorted[index].isEncrypted,
                                                datePosted: afterSorted[index].datePosted,
                                                dateUpdated: afterSorted[index].dateUpdated,
                                                cryptographicNonce: [],
                                                encryptedChatText: [],
                                                involvedIds: afterSorted[index].involvedIds,
                                                isServerMessage: true,
                                                messageReactions: afterSorted[index].messageReactions,
                                                inReplyTo: afterSorted[index].inReplyTo,
                                                attatchments: afterSorted[index].attatchments
                                            }
                                            allMessagesFound.push(toPush);
                                            itemsProcessed++;
                                            if (afterSorted.length - lastLoadedPosition < 20 ) {
                                                if (itemsProcessed == afterSorted.length - lastLoadedPosition) {
                                                    res.json({
                                                        status: "SUCCESS",
                                                        message: "Messages found.",
                                                        data: allMessagesFound
                                                    })
                                                }
                                            } else {
                                                //more than 20 msgs to load
                                                if (itemsProcessed == 20) {
                                                    res.json({
                                                        status: "SUCCESS",
                                                        message: "Messages found.",
                                                        data: allMessagesFound
                                                    })
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "Last loaded message could not be found."
                        })
                    }
                }
            }
            console.log("Before sort")
            const sortedResult = result.sort(function(a, b){
                return a.datePosted > b.datePosted ? -1 : 1
            });
            afterSort(sortedResult);
        } else {
            res.json({
                status: "FAILED",
                message: "No messages found."
            })
        }
    }).catch(err => {
        console.log(err);
        res.json({
            status: "FAILED",
            message: "Error with finding messages."
        })
    })
})

router.post("/addReactionToMessage", (req,res)=> {
    const idSent = req.tokenData;
    const conversationId = req.body.conversationId
    const messageId = req.body.messageId
    const reactionSent = req.body.reactionSent
    User.find({_id: {$eq: idSent}}).then(userFound => {
        if (userFound.length) {
            Message.find({_id: {$eq: messageId}}).then(messageFound => {
                if (messageFound.length) {
                    //check if message is in the right conversation just in case same id or something
                    if (messageFound.length == 1) {
                        if (messageFound[0].conversationId == conversationId) {
                            Message.findOneAndUpdate({_id: {$eq: messageId}}, { $push : { messageReactions: { pubId: String(idSent), reactionEmoji: String(reactionSent) } }}).then(function() { 
                                res.json({
                                    status: "SUCCESS",
                                    message: "Added Reaction."
                                })
                            }).catch(err => {
                                console.log(err)
                                res.json({
                                    status: "FAILED",
                                    message: "Error updating the message."
                                })
                            })
                        } else {
                            res.json({
                                status: "FAILED",
                                message: "Couldn't finding message."
                            })
                        }
                    } else {
                        //todo fix whatever the fuck I wrote here
                        var itemsChecked = 0;
                        messageFound.forEach(function (item, index) {
                            if (messageFound[index].conversationId == conversationId) {
                                Message.findOneAndUpdate({_id: {$eq: messageId}}, { $push : { messageReactions: { pubId: String(idSent), reactionEmoji: String(reactionSent) } }}).then(function() { 
                                    res.json({
                                        status: "SUCCESS",
                                        message: "Added Reaction."
                                    })
                                }).catch(err => {
                                    console.log(err)
                                    res.json({
                                        status: "FAILED",
                                        message: "Error updating the message."
                                    })
                                })
                            } else {
                                itemsChecked++;
                                if (messageFound.length) {
                                    res.json({
                                        status: "FAILED",
                                        message: "Couldn't finding message."
                                    })
                                }
                            }
                        })
                    }
                } else {
                    res.json({
                        status: "FAILED",
                        message: "Error finding message."
                    })
                }
            })
        }
    }).catch(err => {
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error finding user."
        })
    })
})

router.post("/removeReactionToMessage", (req,res)=> {
    const idSent = req.tokenData;
    const conversationId = req.body.conversationId
    const messageId = req.body.messageId
    const reactionSent = req.body.reactionSent
    User.find({_id: {$eq: idSent}}).then(userFound => {
        if (userFound.length) {
            Message.find({_id: {$eq: messageId}}).then(messageFound => {
                if (messageFound.length) {
                    //check if message is in the right conversation just in case same id or something
                    if (messageFound.length == 1) {
                        if (messageFound[0].conversationId == conversationId) {
                            Message.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { messageFound : { pubId: String(idSent), reactionEmoji: String(reactionSent) } }}).then(function(){
                                res.json({
                                    status: "SUCCESS",
                                    message: "Added Reaction."
                                })
                            }).catch(err => {
                                console.log(err)
                                res.json({
                                    status: "FAILED",
                                    message: "Error updating the message."
                                })
                            })
                        } else {
                            res.json({
                                status: "FAILED",
                                message: "Couldn't finding message."
                            })
                        }
                    } else {
                        let itemsChecked = 0;
                        messageFound.forEach(function (item, index) {
                            if (messageFound[index].conversationId == conversationId) {
                                Message.findOneAndUpdate({_id: {$eq: messageId}}, { $push : { messageReactions: String(reactionSent) }}).then(function() { 
                                    res.json({
                                        status: "SUCCESS",
                                        message: "Added Reaction."
                                    })
                                }).catch(err => {
                                    console.log(err)
                                    res.json({
                                        status: "FAILED",
                                        message: "Error updating the message."
                                    })
                                })
                            } else {
                                itemsChecked++;
                                if (messageFound.length) {
                                    res.json({
                                        status: "FAILED",
                                        message: "Couldn't finding message."
                                    })
                                }
                            }
                        })
                    }
                } else {
                    res.json({
                        status: "FAILED",
                        message: "Error finding message."
                    })
                }
            })
        }
    }).catch(err => {
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error finding user."
        })
    })
})

module.exports = router;