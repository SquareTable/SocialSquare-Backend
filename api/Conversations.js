const express = require('express');
const router = express.Router();

//Schemas
const Conversation = require("../models/Conversation")
const User = require('../models/User');
const Message = require('../models/Message')

const fs = require('fs')
const S3 = require('aws-sdk/clients/s3')

const bucketName = process.env.AWS_BUCKET_NAME
const region = process.env.AWS_BUCKET_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY
const secretAccessKey = process.env.AWS_SECRET_KEY

const s3 = new S3 ({
    region,
    accessKeyId,
    secretAccessKey
})

const util = require('util')
const unlinkFile = util.promisify(fs.unlink)
const { addSocketToClients, getSocketToDisconnect } = require('./../socketHandler')

//Image post
const multer  = require('multer')
const upload = multer({ dest: 'uploads/' })

const { uploadFile, getFileStream } = require('../s3')

const crypto = require('crypto')

// Get the objectID type
var ObjectID = require('mongodb').ObjectID;

//Web Token Stuff

const { tokenValidation } = require("../middleware/TokenHandler");

//UNCOMMENT THE LINE BELOW AFTER CHATS HAVE BEEN REMADE
//router.all("/{*splat}", [tokenValidation]); // the /{*splat} just makes it that it affects them all it could be /whatever and it would affect that only

//create conversation
router.post("/create", (req,res)=> {
    const conversationMembers = req.body.conversationMembers
    const conversationTitle = req.body.conversationTitle.trim()
    const creatorId = req.tokenData;
    console.log(conversationTitle)
    //
    function createConversation(allIdsFound) {
        if (conversationTitle == "" || conversationTitle == null) { 
            res.json({
                status: "FAILED",
                message: "Title Needed"
            })
        } else {
            var currentdate = new Date(); 
            //
            var twoDigitDate = ''
            if (currentdate.getDate() < 10) {
                twoDigitDate = '0' + currentdate.getDate()
            } else {
                twoDigitDate = currentdate.getDate()
            }
            //
            var twoDigitMonth = ''
            var recievedMonth = currentdate.getMonth()+1
            if (recievedMonth < 10) {
                twoDigitMonth = '0' + recievedMonth
            } else {
                twoDigitMonth = recievedMonth
            }
            //
            var twoDigitHour = ''
            if (currentdate.getHours() < 10) {
                twoDigitHour = '0' + currentdate.getHours()
            } else {
                twoDigitHour = currentdate.getHours()
            }
            //
            var twoDigitMinutes = ''
            if (currentdate.getMinutes() < 10) {
                twoDigitMinutes = '0' + currentdate.getMinutes()
            } else {
                twoDigitMinutes = currentdate.getMinutes()
            }
            //
            var twoDigitSeconds = ''
            if (currentdate.getSeconds() < 10) {
                twoDigitSeconds = '0' + currentdate.getSeconds()
            } else {
                twoDigitSeconds = currentdate.getSeconds()
            }
            //
            var datetime = twoDigitDate + "/"
            + twoDigitMonth  + "/" 
            + currentdate.getFullYear() + " @ "  
            + twoDigitHour + ":"  
            + twoDigitMinutes + ":" 
            + twoDigitSeconds;
            const newConversation = new Conversation({
                members: allIdsFound,
                isDirectMessage: false,
                ownerId: creatorId,
                isEncrypted: false,
                conversationImageKey: "",
                conversationTitle: conversationTitle,
                conversationDescription: req.body.conversationDescription,
                conversationNSFW: req.body.conversationNSFW,
                conversationNSFL: req.body.conversationNSFL,
                dateCreated: datetime,
                lastMessage: "N/A",
                lastMessageDate: "N/A",
                lastMessageViewed: []
            });
            newConversation.save().then(result => {
                const newMessage = new Message({
                    conversationId: result._id,
                    isEncrypted: false,
                    senderId: "",
                    chatText: "Conversation Created",
                    datePosted: datetime,
                    dateUpdated: datetime,
                    encryptedChatText: [],
                    isServerMessage: true,
                    involvedIds: {}
                });
                newMessage.save().then(result => {
                    res.json({
                        status: "SUCCESS",
                        message: "Created Conversation",
                        data: {
                            _id: result._id
                        }
                    })
                }).catch(err => {
                    console.log(err)
                    res.json({
                        status: "SUCCESS",
                        message: "Created Conversation but was a few errors",
                        data: {
                            _id: result._id
                        }
                    })
                });
            }).catch(err => {
                console.log(err)
                res.json({
                    status: "FAILED",
                    message: "Error with saving conversation"
                })
            });
        }
    }
    var itemsProcessed = 0;
    const allFound = []
    User.find({_id: {$eq: creatorId}}).then(data => { 
        if (data.length) {
            allFound.push(data[0]._id)
            conversationMembers.forEach(function (item, index) {
                //Make sure users are real
                if (conversationMembers.length >= 2) {
                    if (conversationMembers.length <= 13) {
                        User.find({name: {$eq: conversationMembers[index]}}).then(result => { 
                            if (result.length) {
                                itemsProcessed++;
                                allFound.push(result[0]._id)
                                if(itemsProcessed === conversationMembers.length) {
                                    console.log(`Total Users: ${conversationMembers.length}`)
                                    createConversation(allFound)
                                }
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Non-existent user found."
                                })
                            }
                        }).catch(err => {
                            console.log(err)
                            res.json({
                                status: "FAILED",
                                message: "Error occured when finding members."
                            })
                        })
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "More users than allowed."
                        })
                    }
                } else {
                    //No users
                    res.json({
                        status: "FAILED",
                        message: "Not enough users were sent over."
                    })
                }
            });
        } else {
            res.json({
                status: "FAILED",
                message: "No creator?"
            })
        }
    }).catch(err => {
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error with finding creator"
        })
    });
})

//create Direct Message
router.post("/createDirectMessage", (req,res)=> {
    const recipientName = req.body.recipientName
    const creatorId = req.tokenData;
    //
    function createDM(recipientId) {
        var currentdate = new Date(); 
        //
        var twoDigitDate = ''
        if (currentdate.getDate() < 10) {
            twoDigitDate = '0' + currentdate.getDate()
        } else {
            twoDigitDate = currentdate.getDate()
        }
        //
        var twoDigitMonth = ''
        var recievedMonth = currentdate.getMonth()+1
        if (recievedMonth < 10) {
            twoDigitMonth = '0' + recievedMonth
        } else {
            twoDigitMonth = recievedMonth
        }
        //
        var twoDigitHour = ''
        if (currentdate.getHours() < 10) {
            twoDigitHour = '0' + currentdate.getHours()
        } else {
            twoDigitHour = currentdate.getHours()
        }
        //
        var twoDigitMinutes = ''
        if (currentdate.getMinutes() < 10) {
            twoDigitMinutes = '0' + currentdate.getMinutes()
        } else {
            twoDigitMinutes = currentdate.getMinutes()
        }
        //
        var twoDigitSeconds = ''
        if (currentdate.getSeconds() < 10) {
            twoDigitSeconds = '0' + currentdate.getSeconds()
        } else {
            twoDigitSeconds = currentdate.getSeconds()
        }
        //
        var datetime = twoDigitDate + "/"
        + twoDigitMonth  + "/" 
        + currentdate.getFullYear() + " @ "  
        + twoDigitHour + ":"  
        + twoDigitMinutes + ":" 
        + twoDigitSeconds;
        const newConversation = new Conversation({
            members: [new ObjectID(creatorId), recipientId],
            isDirectMessage: true,
            ownerId: null,
            isEncrypted: false,
            conversationImageKey: "",
            conversationTitle: "",
            conversationDescription: "",
            conversationNSFW: false,
            conversationNSFL: false,
            dateCreated: datetime,
            lastMessageViewed: []
        });
        newConversation.save().then(result => {
            const newMessage = new Message({
                conversationId: result._id,
                isEncrypted: false,
                senderId: "",
                chatText: "Conversation Created",
                datePosted: datetime,
                dateUpdated: datetime,
                encryptedChatText: [],
                isServerMessage: true,
                involvedIds: {}
            });
            newMessage.save().then(result => {
                res.json({
                    status: "SUCCESS",
                    message: "Created Conversation",
                    data: result._id
                })
            }).catch(err => {
                console.log(err)
                res.json({
                    status: "SUCCESS",
                    message: "Created Conversation but was a few errors",
                    data: result._id
                })
            });
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error with saving conversation"
            })
        });
    }
    User.find({_id: {$eq: creatorId}}).then(data => { 
        if (data.length) {
            User.find({name: {$eq: recipientName}}).then(result => { 
                if (result.length) {
                    Conversation.find({members: { $all: [new ObjectID(creatorId), result[0]._id]}}).then(conversationsResult => {
                        if (conversationsResult.length) {
                            var itemsProcessed = 0;
                            conversationsResult.forEach(function (item, index) {
                                if (conversationsResult[index].isDirectMessage == true) {
                                    res.json({
                                        status: "FAILED",
                                        message: "Direct Message Exists",
                                        data: conversationsResult[index]._id
                                    })
                                } else {
                                    itemsProcessed++;
                                    if (itemsProcessed == conversationsResult.length) {
                                        //create
                                        createDM(result[0]._id)
                                    }
                                }
                            })
                        } else {
                            //create
                            createDM(result[0]._id)
                        }
                    }).catch(err => {
                        console.log(err)
                        res.json({
                            status: "FAILED",
                            message: "Error with searching existing conversations"
                        })
                    });
                } else {
                    res.json({
                        status: "FAILED",
                        message: "Couldn't get recipient"
                    })
                }
            }).catch(err => {
                console.log(err)
                res.json({
                    status: "FAILED",
                    message: "Error with finding recipient"
                })
            });
        } else {
            res.json({
                status: "FAILED",
                message: "No creator?"
            })
        }
    }).catch(err => {
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error with finding creator"
        })
    });
})

//get conversations of user

router.get("/getConvos", (req,res)=>{
    const userId = req.tokenData;
    User.find({_id: {$eq: userId}}).then(userAttemptingToFindConvos => {
        if (userAttemptingToFindConvos.length) {
            Conversation.find({members: { $in: [new ObjectID(userId)]}}).then(result => { 
                if (result.length) {
                    var allConversationsFound = []
                    var itemsProcessed = 0;
                    result.forEach(function (item, index) {
                        //afterUnreads
                        const afterUnreads = (convoUnreadAmount, lastMessageDate) => {
                            if (result[index].isDirectMessage == false) {
                                var toPush = {conversationId: result[index]._id, members: result[index].members.length, isDirectMessage: result[index].isDirectMessage, conversationImageKey: result[index].conversationImageKey, conversationTitle: result[index].conversationTitle, conversationDescription: result[index].conversationDescription, conversationNSFW: result[index].conversationNSFW, conversationNSFL: result[index].conversationNSFL, lastMessageDate: lastMessageDate, dateCreated: result[index].dateCreated, unreadsMessages: convoUnreadAmount, isEncrypted: result[index].isEncrypted}
                                allConversationsFound.push(toPush)
                                itemsProcessed++;
                                if (itemsProcessed == result.length) {
                                    //console.log(allConversationsFound)
                                    res.json({
                                        status: "SUCCESS",
                                        message: "Conversations found.",
                                        data: allConversationsFound
                                    })
                                }
                            } else {
                                var idOfOther
                                const usersObjId = new ObjectID(userId)
                                if (result[index].members[0].equals(usersObjId)) {
                                    idOfOther = result[index].members[1]
                                } else {
                                    idOfOther = result[index].members[0]
                                }
                                User.find({_id: {$eq: idOfOther}}).then(data => { 
                                    if (data.length) {
                                        var toPush = {conversationId: result[index]._id, members: result[index].members.length, isDirectMessage: result[index].isDirectMessage, conversationImageKey: data[0].profileImageKey, conversationTitle: data[0].name, conversationDescription: result[index].conversationDescription, conversationNSFW: result[index].conversationNSFW, conversationNSFL: result[index].conversationNSFL, lastMessageDate: result[index].lastMessageDate, dateCreated: result[index].dateCreated, unreadsMessages: convoUnreadAmount, isEncrypted: result[index].isEncrypted}
                                        allConversationsFound.push(toPush)
                                        itemsProcessed++;
                                        if (itemsProcessed == result.length) {
                                            //console.log(allConversationsFound)
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Conversations found.",
                                                data: allConversationsFound
                                            })
                                        }
                                    } else {
                                        itemsProcessed++;
                                        if (itemsProcessed == result.length) {
                                            //console.log(allConversationsFound)
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Conversations found.",
                                                data: allConversationsFound
                                            })
                                        }
                                    }
                                }).catch(err => {
                                    console.log(err)
                                    res.json({
                                        status: "FAILED",
                                        message: "Error with finding other member of a DM."
                                    })
                                })
                            }
                        }
                        //First get unreads
                        //Might be bad to do it this way change in future :)
                        var unreadAmount
                        const indexOfLastMessageSeenInLastMessageViewedArray = result[index].lastMessageViewed.findIndex(x => x.userThatViewed == userAttemptingToFindConvos[0].secondId)
                        if (indexOfLastMessageSeenInLastMessageViewedArray !== -1) { 
                            Message.find({conversationId: {$eq: result[index]._id}}).then(conversationMessages => {
                                var msgDates = conversationMessages.map(function(x) {
                                    return x.datePosted;
                                });
                                const sortedDates = msgDates.sort(function(a, b){
                                    return a.datePosted > b.datePosted ? -1 : 1
                                });
                                const indexOfLastSeenInSorted = sortedDates.findIndex(x => x == result[index].lastMessageViewed[indexOfLastMessageSeenInLastMessageViewedArray].dateOfMessage)
                                if (indexOfLastSeenInSorted !== -1) {
                                    var msgNumberOfLastSeen = indexOfLastSeenInSorted+1
                                    var messageSinceLastSeen = sortedDates.length - msgNumberOfLastSeen
                                    unreadAmount = messageSinceLastSeen
                                    console.log(unreadAmount)
                                    afterUnreads(unreadAmount, sortedDates[sortedDates.length-1])
                                } else {
                                    //should never happen
                                    unreadAmount = "?"
                                    afterUnreads(unreadAmount, sortedDates[sortedDates.length-1])
                                }
                            }).catch(err => {
                                console.log(`Error finding conversationMessages: ${err}`)
                                unreadAmount = "?"
                                afterUnreads(unreadAmount, "err")
                            })
                        } else {
                            unreadAmount = ""
                            afterUnreads(unreadAmount, "")
                        }
                        //
                    })
                } else {
                    res.json({
                        status: "FAILED",
                        message: "No conversations found."
                    })
                }
            }).catch(err => {
                console.log(err)
                res.json({
                    status: "FAILED",
                    message: "Error with finding conversations."
                })
            })
        } else {
            res.json({
                status: "FAILED",
                message: "Couldn't find user."
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

router.get("/singleDmWithName/:nameOfOther", (req,res)=>{
    const thisUserId = req.tokenData;
    User.find({_id: {$eq: thisUserId}}).then(userAttemptingToFindConvos => {
        if (userAttemptingToFindConvos.length) {
            User.find({name: {$eq: req.params.nameOfOther}}).then(data => { 
                if (data.length) {
                    Conversation.find({$and: [ {members: { $in: [new ObjectID(thisUserId)]}}, {members: { $in: [new ObjectID(data[0]._id)]}} ]}).then(resultOfConvosFound => { 
                        if (resultOfConvosFound.length) {
                            var itemsProcessedWithoutDm = 0
                            resultOfConvosFound.forEach(function (item, index) {
                                var result = resultOfConvosFound[index]
                                if (result.isDirectMessage == false) {
                                    itemsProcessedWithoutDm++;
                                    if (itemsProcessedWithoutDm == resultOfConvosFound.length) {
                                        res.json({                                       
                                            status: "FAILED",
                                            message: "No dms with this person found."                                        
                                        })
                                    }
                                } else {
                                    var idOfOther
                                    const usersObjId = new ObjectID(thisUserId)
                                    if (result.members[0].equals(usersObjId)) {
                                        idOfOther = result.members[1]
                                    } else {
                                        idOfOther = result.members[0]
                                    }
                                    User.find({_id: {$eq: idOfOther}}).then(data => { 
                                        if (data.length) {
                                            var toSend = {conversationId: result._id, members: result.members.length, isDirectMessage: result.isDirectMessage, conversationImageKey: data[0].profileImageKey, conversationTitle: data[0].name, conversationDescription: result.conversationDescription, conversationNSFW: result.conversationNSFW, conversationNSFL: result.conversationNSFL, lastMessage: result.lastMessage, lastMessageDate: result.lastMessageDate, dateCreated: result.dateCreated}
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Conversations found.",
                                                data: toSend
                                            })
                                        } else {
                                            res.json({
                                                status: "FAILED",
                                                message: "No user user found."
                                            })
                                        }
                                    }).catch(err => {
                                        console.log(err)
                                        res.json({
                                            status: "FAILED",
                                            message: "Error with finding other member of a DM."
                                        })
                                    })
                                }
                            })
                        } else {
                            res.json({
                                status: "FAILED",
                                message: "No conversations found."
                            })
                        }
                    }).catch(err => {
                        console.log(err)
                        res.json({
                            status: "FAILED",
                            message: "Error with finding conversations."
                        })
                    })
                } else {
                    res.json({
                        status: "FAILED",
                        message: "Couldn't find other user."
                    })
                }
            })
        } else {
            res.json({
                status: "FAILED",
                message: "Couldn't find user."
            })
        }
    }).catch(err => {
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error with finding user."
        })
    })
})

router.get("/singleConvoWithId/:idOfConvo", (req,res)=>{
    const thisUserId = req.tokenData;
    User.findOne({_id: {$eq: thisUserId}}).then(userAttemptingToFindConvos => {
        if (!userAttemptingToFindConvos) {
            res.json({
                status: "FAILED",
                message: "Couldn't find user."
            })
        } else {
            Conversation.findOne({_id: {$eq: req.params.idOfConvo}}).then(result => {
                if (!result) {        
                    res.json({
                        status: "FAILED",
                        message: "No conversations found."
                    })
                } else {
                    if (!result.members.includes(userAttemptingToFindConvos._id)) {
                        res.json({
                            status: "FAILED",
                            message: "User is not in conversation."
                        })
                    } else {
                        if (result.isDirectMessage == false) {
                            var toSend = {conversationId: result._id, members: result.members.length, isDirectMessage: result.isDirectMessage, conversationImageKey: result.conversationImageKey, conversationTitle: result.conversationTitle, conversationDescription: result.conversationDescription, conversationNSFW: result.conversationNSFW, conversationNSFL: result.conversationNSFL, lastMessage: result.lastMessage, lastMessageDate: result.lastMessageDate, dateCreated: result.dateCreated, isEncrypted: result.isEncrypted}
                            res.json({
                                status: "SUCCESS",
                                message: "Conversations found.",
                                data: toSend
                            })
                        } else {
                            var idOfOther
                            const usersObjId = new ObjectID(thisUserId)
                            if (result.members[0].equals(usersObjId)) {
                                idOfOther = result.members[1]
                            } else {
                                idOfOther = result.members[0]
                            }
                            User.findOne({_id: {$eq: idOfOther}}).then(data => { 
                                if (!data) {
                                    res.json({
                                        status: "FAILED",
                                        message: "No user user found."
                                    })
                                } else {
                                    var toSend = {conversationId: result._id, members: result.members.length, isDirectMessage: result.isDirectMessage, conversationImageKey: data.profileImageKey, conversationTitle: data.name, conversationDescription: result.conversationDescription, conversationNSFW: result.conversationNSFW, conversationNSFL: result.conversationNSFL, lastMessage: result.lastMessage, lastMessageDate: result.lastMessageDate, dateCreated: result.dateCreated, isEncrypted: result.isEncrypted}
                                    res.json({
                                        status: "SUCCESS",
                                        message: "Conversations found.",
                                        data: toSend
                                    })
                                }
                            }).catch(err => {
                                console.log(err)
                                res.json({
                                    status: "FAILED",
                                    message: "Error with finding other member of a DM."
                                })
                            })
                        }
                    }
                }
            }).catch(err => {
                console.log(err)
                res.json({
                    status: "FAILED",
                    message: "Error with finding conversations."
                })
            })
        }
    }).catch(err => {
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error with finding user."
        })
    })
})


//Get conversation member data

router.get("/getMembers/:conversationId", (req,res)=>{
    if (req.params.conversationId == "" || req.params.conversationId == null) {
        res.json({
            status: "FAILED",
            message: "No ConversationId sent."
        })
    } else {
        Conversation.find({_id: {$eq: req.params.conversationId}}).then(data => { 
            if (data.length) {
                conversationData = data[0]
                var itemsProcessed = 0;
                var memberData = []
                conversationData.members.forEach(function (item, index) {
                    User.find({_id: {$eq: conversationData.members[index]}}).then(userFoundResult => {
                        if (userFoundResult.length) {
                            var isOwner = false
                            if (conversationData.ownerId !== null) {
                                if (userFoundResult[0]._id == conversationData.ownerId) {
                                    isOwner = true
                                }
                            }
                            var toPushObject = {profileImageKey: userFoundResult[0].profileImageKey, name: userFoundResult[0].name, displayName: userFoundResult[0].displayName, publicId: userFoundResult[0].secondId, isOwner: isOwner}
                            memberData.push(toPushObject)
                            itemsProcessed++;
                            if (itemsProcessed == conversationData.members.length) {
                                console.log("Search completed properly")
                                res.json({
                                    status: "SUCCESS",
                                    message: "Found Users",
                                    data: memberData
                                })
                            }
                        } else {
                            console.log("Wasn't able to find one of the users")
                            var toPushObject = {profileImageKey: "Error", name: "Couldn't Find User", displayName: "", publicId: "Couldn't Find User", isOwner: false}
                            memberData.push(toPushObject)
                            itemsProcessed++;
                            if (itemsProcessed == conversationData.members.length) {
                                console.log("Search completed properly")
                                res.json({
                                    status: "SUCCESS",
                                    message: "Found Users",
                                    data: memberData
                                })
                            }
                        }
                    })
                })
            } else {
                console.log("Conversation couldn't be found")
                res.json({
                    status: "FAILED",
                    message: "Conversation couldn't be found"
                })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error while finding conversation."
            })
        })
    }
})

//Get conversation singlemember data

router.get("/getSingleMember/:publicId", (req,res) => {
    if (req.params.publicId == "" || req.params.publicId == null) {
        res.json({
            status: "FAILED",
            message: "No publicId sent."
        })
    } else {           
        User.find({secondId: {$eq: req.params.publicId}}).then(userFoundResult => {
            if (userFoundResult.length) {
                var secondId = userFoundResult[0].secondId
                var toSendObject = {profileImageKey: userFoundResult[0].profileImageKey, name: userFoundResult[0].name, displayName: userFoundResult[0].displayName, publicId: userFoundResult[0].secondId, isOwner: false}
                res.json({
                    status: "SUCCESS",
                    message: "Found Users",
                    data: toSendObject
                })
            } else {
                var toSendObject = {profileImageKey: "", name: "Error", displayName: "Error", publicId: "Error", isOwner: false}
                res.json({
                    status: "SUCCESS",
                    message: "Found Users",
                    data: toSendObject
                })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error while finding user."
            })
        })
    }
})

//Get Group Icon
router.get('/getGroupIcon/:conversationId/:userId', (req, res) => {
    const conversationId = req.params.conversationId;
    const userId = req.params.userId;
    console.log("Before Find")
    User.find({_id: {$eq: userId}}).then(data =>{ 
        if (data.length) { 
            Conversation.find({_id: {$eq: conversationId}}).then(convoData => {
                if (convoData.length) {    
                    console.log("After Find")
                    var convoDataMain = convoData[0]
                    var conversationImageKey = convoDataMain.conversationImageKey
                    console.log(conversationImageKey)
                    if (conversationImageKey !== "") {
                        res.json({
                            status: "SUCCESS",
                            message: "Profile image found.",
                            data: conversationImageKey
                        })
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "No profile image."
                        })
                    }
                } else {
                    res.json({
                        status: "FAILED",
                        message: "Couldn't find conversation."
                    })
                }
            }).catch(err => {
                console.log(err)
                res.json({
                    status: "FAILED",
                    message: "Issue finding conversation."
                })
            })
        } else {
            res.json({
                status: "FAILED",
                message: "An error occured while finding user."
            })
        }
    })
    .catch(err => { 
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error Searching"
        })
    });
})

//send back public keys

router.get("/getPublicKeys/:conversationid", (req,res)=>{
    const idSent = req.tokenData;
    const conversationId = req.params.conversationid
    if (idSent == "" || conversationId == "") {
        res.json({
            status: "FAILED",
            message: "Error with params passed"
        })
    } else {           
        User.findOne({_id: {$eq: idSent}}).then(userFoundResult => {
            if (!userFoundResult) {
                res.json({
                    status: "FAILED",
                    message: "Error with user id passed"
                })
            } else {
                Conversation.findOne({_id: {$eq: conversationId}}).then(convoFound => {
                    if (!convoFound) {
                        res.json({
                            status: "FAILED",
                            message: "Error with conversation id passed"
                        })
                    } else {
                        const arrayOfKeys = convoFound.publicEncryptionKeys.filter(x => x.userIdIfKeyInUse !== "");
                        if (arrayOfKeys.length == 0) {
                            res.json({
                                status: "FAILED",
                                message: "No encryption keys in use could be found, try toggling encryption or re-opening the conversation."
                            })
                        } else {
                            const arrayOfKeysSendBack = arrayOfKeys.map(x => {return {pubKey: x.publicEncryptionKey, keysUniqueId: x.keysUniqueId}})
                            res.json({
                                status: "SUCCESS",
                                message: "Encryption Keys Found",
                                data: arrayOfKeysSendBack
                            })
                        }
                    }
                }).catch(err => {
                    console.log(err)
                    res.json({
                        status: "FAILED",
                        message: "Error while finding conversation."
                    })
                })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error while finding user."
            })
        })
    }
})

//get users current key in use
router.get("/getCurrentKeyInUse/:conversationId", (req,res) => {
    const conversationId = req.params.conversationId
    const idSent = req.tokenData;
    if (conversationId == null || typeof conversationId == "undefined" || conversationId == "") {
        res.json({
            status: "FAILED",
            message: "Bad ConversationId Passed."
        })
    } else {
        User.find({_id: {$eq: idSent}}).then(userFound => {
            if (userFound.length) {
                Conversation.find({_id: {$eq: conversationId}}).then(convoFound => {
                    if (convoFound.length) {
                        const asyncFunction = async () => {
                            const indexForKey = await convoFound[0].publicEncryptionKeys.findIndex(x => x.userIdIfKeyInUse !== "" && x.userIdIfKeyInUse.equals(userFound[0]._id));
                            if (indexForKey !== -1) {
                                const forSendBack = {
                                    keysUniqueId: convoFound[0].publicEncryptionKeys[indexForKey].keysUniqueId,
                                    publicEncryptionKey: convoFound[0].publicEncryptionKeys[indexForKey].publicEncryptionKey
                                }
                                res.json({
                                    status: "SUCCESS",
                                    message: "Found All",
                                    sendback: forSendBack
                                })
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Couldn't find your public key's UUID on the server."
                                })
                            }
                        }
                        asyncFunction()
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "Couldn't Find Conversation."
                        })
                    }
                })
            } else {
                res.json({
                    status: "FAILED",
                    message: "Issue With Finding User."
                })
            }
        })
    }
})


//search if encrypted and stuff

router.get("/checkForEncryption/:conversationid", (req,res)=>{
    const idSent = req.tokenData;
    const conversationId = req.params.conversationid
    if (idSent == "" || conversationId == "") {
        res.json({
            status: "FAILED",
            message: "Error with params passed"
        })
    } else {           
        User.find({_id: {$eq: idSent}}).then(userFoundResult => {
            if (userFoundResult.length) {
                Conversation.find({_id: {$eq: conversationId}}).then(convoFound => {
                    if (convoFound.length) {
                        if (convoFound[0].isEncrypted == true) {
                            if (convoFound[0].publicEncryptionKeys.length == 0) {
                                //no keys
                                res.json({
                                    status: "FAILED",
                                    message: "Public Key Not Found"
                                }) 
                            } else {
                                const forAsync = async () => {
                                    if (convoFound[0].publicEncryptionKeys.length >= 1) {
                                        const indexForKey = await convoFound[0].publicEncryptionKeys.findIndex(x => x.userIdIfKeyInUse !== "" && x.userIdIfKeyInUse.toString() == userFoundResult[0]._id.toString());
                                        if (indexForKey !== -1) {
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Encryption Key Found",
                                                data: {keysUniqueId: convoFound[0].publicEncryptionKeys[indexForKey].keysUniqueId, publicEncryptionKey: convoFound[0].publicEncryptionKeys[indexForKey].publicEncryptionKey}
                                            })
                                        } else {
                                            res.json({
                                                status: "FAILED",
                                                message: "Public Key Not Found"
                                            }) 
                                        }
                                    } else {
                                        res.json({
                                            status: "FAILED",
                                            message: "Public Key Not Found"
                                        }) 
                                    }
                                }
                                forAsync()
                            }
                        } else {
                            res.json({
                                status: "SUCCESS",
                                message: "Chat is not encrypted"
                            })
                        }
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "Error with conversation id passed"
                        })
                    }
                }).catch(err => {
                    console.log(err)
                    res.json({
                        status: "FAILED",
                        message: "Error while finding conversation."
                    })
                })
            } else {
                res.json({
                    status: "FAILED",
                    message: "Error with user id passed"
                })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error while finding user."
            })
        })
    }
})

//to send pub enc key

router.post('/sendpublicencryptionkey', (req,res) => {
    const sentId = req.tokenData;
    if (req.body.publicKey !== "") {
        if (req.body.conversationId !== "") {
            User.find({_id: {$eq: sentId}}).then(userFoundResult => {
                if (userFoundResult.length) {
                    Conversation.find({_id: {$eq: req.body.conversationId}}).then(convoFound => {
                        if (convoFound.length) {
                            if (convoFound[0].members.includes(userFoundResult[0]._id)) {
                                const forAsync = async () => {
                                    if (convoFound[0].publicEncryptionKeys.length !== 0) {
                                        const pEKInUse = await convoFound[0].publicEncryptionKeys.findIndex(x => x.publicEncryptionKey === req.body.publicKey);
                                        const userHasKey = await convoFound[0].publicEncryptionKeys.findIndex(x => x.userIdIfKeyInUse !== "" && x.userIdIfKeyInUse.toString() == userFoundResult[0]._id.toString());
                                        if (pEKInUse !== -1) {
                                            res.json({
                                                status: "FAILED",
                                                message: "Encryption key sent appears to be in use, generate new keys and try again?"
                                            })
                                        } else if (userHasKey !== -1) {
                                            var newUUID = crypto.randomUUID(); 
                                            const toPush = {
                                                userIdIfKeyInUse: userFoundResult[0]._id,
                                                keysUniqueId: newUUID,
                                                publicEncryptionKey: req.body.publicKey
                                            }
                                            Conversation.findOneAndUpdate({_id: {$eq: req.body.conversationId}, 'publicEncryptionKeys.userIdIfKeyInUse': userFoundResult[0]._id}, {$set: {'publicEncryptionKeys.$.userIdIfKeyInUse': ""}}).then(function() { 
                                                Conversation.findOneAndUpdate({_id: {$eq: req.body.conversationId}}, { $push: { publicEncryptionKeys: toPush }}).then(function() { 
                                                    console.log("Updated")
                                                    res.json({
                                                        status: "SUCCESS",
                                                        message: "Successfully created and sent encryption keys.",
                                                        data: {keysUniqueId: newUUID, publicEncryptionKey: req.body.publicKey}
                                                    })
                                                }).catch(err => {
                                                    console.log(err)
                                                    res.json({
                                                        status: "FAILED",
                                                        message: "Error occured while updating keys (pushing)."
                                                    })
                                                })
                                            }).catch(err => {
                                                console.log(err)
                                                res.json({
                                                    status: "FAILED",
                                                    message: "Error occured while updating keys (pulling)."
                                                })
                                            })
                                        } else {
                                            var newUUID = crypto.randomUUID(); 
                                            const toPush = {
                                                userIdIfKeyInUse: userFoundResult[0]._id,
                                                keysUniqueId: newUUID,
                                                publicEncryptionKey: req.body.publicKey
                                            }
                                            Conversation.findOneAndUpdate({_id: {$eq: req.body.conversationId}}, { $push: { publicEncryptionKeys: toPush }}).then(function() { 
                                                console.log("Updated")
                                                res.json({
                                                    status: "SUCCESS",
                                                    message: "Successfully created and sent encryption keys.",
                                                    data: {keysUniqueId: newUUID, publicEncryptionKey: req.body.publicKey}
                                                })
                                            }).catch(err => {
                                                console.log(err)
                                                res.json({
                                                    status: "FAILED",
                                                    message: "Error occured while updating keys."
                                                })
                                            })
                                        }
                                    } else {
                                        var newUUID = crypto.randomUUID(); 
                                        const toPush = {
                                            userIdIfKeyInUse: userFoundResult[0]._id,
                                            keysUniqueId: newUUID,
                                            publicEncryptionKey: req.body.publicKey
                                        }
                                        Conversation.findOneAndUpdate({_id: {$eq: req.body.conversationId}}, { $push: { publicEncryptionKeys: toPush }}).then(function() { 
                                            console.log("Updated")
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Successfully created and sent encryption keys.",
                                                data: {keysUniqueId: newUUID, publicEncryptionKey: req.body.publicKey}
                                            })
                                        }).catch(err => {
                                            console.log(err)
                                            res.json({
                                                status: "FAILED",
                                                message: "Error occured while updating keys."
                                            })
                                        })
                                    }
                                }
                                forAsync()
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "You could not be found in the group."
                                })
                            }
                        } else {
                            res.json({
                                status: "FAILED",
                                message: "Error with conversationId passed. 1"
                            })
                        }
                    }).catch(err => {
                        console.log(err)
                        res.json({
                            status: "FAILED",
                            message: "Error while finding conversation."
                        })
                    })
                } else {
                    res.json({
                        status: "FAILED",
                        message: "Error with public user id passed. 2"
                    })
                }
            }).catch(err => {
                res.json({
                    status: "FAILED",
                    message: "Error while finding user."
                })
            })
        } else {
            res.json({
                status: "FAILED",
                message: "Error with conversationId passed. 2"
            })
        }
    } else {
        res.json({
            status: "FAILED",
            message: "Error with publicKey passed."
        })
    }
})

//get gc title

router.get("/checkForTitle/:conversationid", (req,res)=>{
    const idSent = req.tokenData;
    const conversationId = req.params.conversationid
    if (idSent == "" || conversationId == "") {
        res.json({
            status: "FAILED",
            message: "Error with params passed"
        })
    } else {           
        User.find({_id: {$eq: idSent}}).then(userFoundResult => {
            if (userFoundResult.length) {
                Conversation.find({_id: {$eq: conversationId}}).then(convoFound => {
                    if (convoFound.length) {
                        res.json({
                            status: "SUCCESS",
                            message: "Retrieved",
                            data: convoFound[0].conversationTitle
                        })
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "Error with conversation id passed"
                        })
                    }
                }).catch(err => {
                    console.log(err)
                    res.json({
                        status: "FAILED",
                        message: "Error while finding conversation."
                    })
                })
            } else {
                res.json({
                    status: "FAILED",
                    message: "Error with user id passed"
                })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error while finding user."
            })
        })
    }
})

//get gc description

router.get("/checkForDescription/:conversationid", (req,res)=>{
    const idSent = req.tokenData;
    const conversationId = req.params.conversationid
    if (idSent == "" || conversationId == "") {
        res.json({
            status: "FAILED",
            message: "Error with params passed"
        })
    } else {           
        User.find({_id: {$eq: idSent}}).then(userFoundResult => {
            if (userFoundResult.length) {
                Conversation.find({_id: {$eq: conversationId}}).then(convoFound => {
                    if (convoFound.length) {
                        res.json({
                            status: "SUCCESS",
                            message: "Retrieved",
                            data: convoFound[0].conversationDescription
                        })
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "Error with conversation id passed"
                        })
                    }
                }).catch(err => {
                    console.log(err)
                    res.json({
                        status: "FAILED",
                        message: "Error while finding conversation."
                    })
                })
            } else {
                res.json({
                    status: "FAILED",
                    message: "Error with user id passed"
                })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error while finding user."
            })
        })
    }
})

//get gc seen

router.get("/getSeenMessages/:conversationid/:messageid", (req,res)=>{
    const idSent = req.tokenData;
    const conversationId = req.params.conversationid
    const messageId = req.params.messageid
    if (idSent == "" || conversationId == "" || messageId == "") {
        res.json({
            status: "FAILED",
            message: "Error with params passed"
        })
    } else {           
        User.find({_id: {$eq: idSent}}).then(userFoundResult => {
            if (userFoundResult.length) {
                Conversation.find({_id: {$eq: conversationId}}).then(convoFound => {
                    if (convoFound.length) {
                        const allViewedWithMessageIdSpecified = []
                        var itemsProcessed = 0;
                        if (convoFound[0].lastMessageViewed.length !== 0) {
                            convoFound[0].lastMessageViewed.forEach(function (item, index) {
                                if (convoFound[0].lastMessageViewed[index].messageViewedId == messageId) {
                                    allViewedWithMessageIdSpecified.push(convoFound[0].lastMessageViewed[index])
                                    itemsProcessed++;
                                    if (itemsProcessed == convoFound[0].lastMessageViewed.length) {
                                        res.json({
                                            status: "SUCCESS",
                                            message: "Seen",
                                            data: allViewedWithMessageIdSpecified
                                        })
                                    }
                                } else {
                                    itemsProcessed++;
                                    if (itemsProcessed == convoFound[0].lastMessageViewed.length) {
                                        if (allViewedWithMessageIdSpecified.length !== 0) {
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Seen",
                                                data: allViewedWithMessageIdSpecified
                                            })
                                        } else {
                                            res.json({
                                                status: "SUCCESS",
                                                message: "None Seen"
                                            })
                                        }
                                    }
                                }
                            })
                        } else {
                            res.json({
                                status: "SUCCESS",
                                message: "None Seen"
                            })
                        }
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "Error with conversation id passed"
                        })
                    }
                }).catch(err => {
                    console.log(err)
                    res.json({
                        status: "FAILED",
                        message: "Error while finding conversation."
                    })
                })
            } else {
                res.json({
                    status: "FAILED",
                    message: "Error with user id passed"
                })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error while finding user."
            })
        })
    }
})

module.exports = router;