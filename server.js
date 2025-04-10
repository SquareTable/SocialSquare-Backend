const app = require('express')();

// mongodb
if (process.env.isInCI !== 'true') {
    require('dotenv').config();
    require('./config/db').then(() => {
        console.log("DB Connected");
    }).catch((err) => {
        console.error('ERROR CONNECTING TO DATABASE:')
        console.error(err)
        console.error('SERVER WILL EXIT WITH CODE 1 (FAIL)')
        process.exit(1)
    });
} else {
    app.set('trust proxy', true)
}

const cors = require('cors')

const UserRouter = require('./routes/User')
const TempRouter = require('./routes/Temp')
const ConversationsRouter = require('./api/Conversations')
const MessagesRouter = require('./api/Messages')
const PublicApisRouter = require('./api/PublicApis')
const FeedRouter = require('./routes/Feed')
const AdminRouter = require('./routes/Admin')

const sanitizeFilename = require('sanitize-filename');

const swaggerUi = require('swagger-ui-express'); //For API docs
const swaggerDocument = require('./swagger.json'); //For API docs

const ImageLibrary = require('./libraries/Image');
const imageHandler = new ImageLibrary();
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

const { v4: uuidv4 } = require('uuid');

const util = require('util')
const unlinkFile = util.promisify(fs.unlink)

//Image post
const multer  = require('multer')
const path = require('path');
const stream = require('stream')

const storage = multer.diskStorage({
    // Destination to store image     
    destination: (req, file, cb) => {
        cb(null, process.env.TEMP_IMAGES_PATH)
    },
    filename: (req, file, cb) => {
        let extName = path.extname(file.originalname)
        if (extName == ".png" || extName == ".jpg" || extName == ".jpeg") {
            var newUUID = uuidv4(); 
            cb(null, newUUID + extName); 
        } else {
            cb("Invalid file format")
        }      
    }
});

const upload = multer({ storage: storage })


const { uploadFile, getFileStream } = require('./s3')
const { clients, addSocketToClients, getSocketToSendMessageTo, getSocketToDisconnect, clientConnectedToConversation, removeSocketDueToDisconnect, removeSocketFromClients, checkIfDeviceUUIDConnected } = require('./socketHandler')

var timeOutsOfSocketDisconnects = []

const User = require('./models/User');
const Conversation = require('./models/Conversation')
const Message = require('./models/Message')

const { popularPostHandler } = require('./popularPostHandler')


function generateDate(callback) { //todo: callback no longer needed im js lazy
    return callback(Date.now())
}

function determineUsersForStatusSend(userId, callback) {
    Conversation.find({members: {$in: [String(userId)]}}).then(convosOfUser => { // turn into function so can be used for online and offline setting
        if (convosOfUser.length) {
            console.log(convosOfUser.map(x => x._id));
            var convoMembersOnly = convosOfUser.map(x => x.members).flat(1); //excludes this user
            console.log(convoMembersOnly);
            var filteredConvoMembersOnly = convoMembersOnly.filter(x => x.equals(userId) == false);
            console.log(filteredConvoMembersOnly);
            let uniqueConvoMembersOnly = filteredConvoMembersOnly.filter((element, index) => {
                return filteredConvoMembersOnly.findIndex(x => x.equals(element)) === index;
            });
            console.log("uCMO");
            console.log(uniqueConvoMembersOnly);
            var clientsOfMembers = clients.clientList.filter(x => uniqueConvoMembersOnly.findIndex(y => y.equals(x.userId)) !== -1);
            console.log(clientsOfMembers);
            return callback(clientsOfMembers);
        } else {
            console.log("Couldn't find convo's so none to set for (or an issue occured).");
            return callback("None");
        }
    }).catch(err => {
        console.log("Error when finding convos, user most likely wont be online.");
        console.log(err);
        return callback("Error");
    });
};

function saveToDataBase(messageSent, convoId, messagesId, userSenderId, callback) {
    //console.log(messageSent)
    Conversation.findOne({_id: {$eq: convoId}}).then((conversationData) => {
        if (!conversationData) {
            const forReturn = {
                status: "FAILED", 
                message: "Coundn't find the conversation."
            }
            return callback(forReturn);
        } else {
            //Conversation exists
            if (messageSent.isEncrypted == true) {
                console.log(messageSent)
                if (Array.isArray(messageSent.encryptedChatText)) {
                    var encryptedChatText = messageSent.encryptedChatText
                    const allEncryptedKeysUUIDs = encryptedChatText.map(x => x.keysUniqueId)
                    console.log("allEncryptedKeysUUIDs: ")
                    console.log(allEncryptedKeysUUIDs)
                    if (messageSent.cryptographicNonce.length == 24) {
                        const cryptographicNonce = Array.from(messageSent.cryptographicNonce)
                        //following if checks for at least one encrypted string that isnt empty and one public encryption key uuid used
                        if (encryptedChatText.some(x => x.encryptedString.trim().length !== 0) && conversationData.publicEncryptionKeys.some(x => allEncryptedKeysUUIDs.includes(x.keysUniqueId))) {
                            const newMessage = new Message({
                                _id: messagesId,
                                conversationId: convoId,
                                isEncrypted: true,
                                senderId: userSenderId,
                                chatText: "",
                                datePosted: messageSent.datePosted,
                                dateUpdated: messageSent.dateUpdated,
                                cryptographicNonce: cryptographicNonce,
                                encryptedChatText: messageSent.encryptedChatText,
                                isServerMessage: false,
                                involvedIds: messageSent.involvedIds,
                                messageReactions: [],
                                inReplyTo: (messageSent.inReplyTo !== "" ? messageSent.inReplyTo._id : ""),
                                attatchments: messageSent.attatchments
                            });
                            newMessage.save().then(result => {
                                const forReturn = {
                                    status: "SUCCESS",
                                    message: "Sent Message"
                                }
                                console.log(`forReturn ${forReturn}`)
                                return callback(forReturn);
                            }).catch(err => {
                                console.log(err)
                                const forReturn = {
                                    status: "FAILED",
                                    message: "Error with saving message"
                                }
                                console.log(`forReturn ${forReturn}`)
                                return callback(forReturn);
                            });
                        } else {
                            const forReturn = {
                                status: "FAILED",
                                message: "Message was empty or not encrypted properly for any keys."
                            }
                            console.log(`forReturn ${forReturn}`)
                            return callback(forReturn);
                        }
                    } else {
                        const forReturn = {
                            status: "FAILED",
                            message: "Bad cryptographic nonce."
                        }
                        console.log(`forReturn ${forReturn}`)
                        return callback(forReturn);
                    }
                } else {
                    const forReturn = {
                        status: "FAILED",
                        message: "Message wasn't correct format for encrypted message."
                    }
                    console.log(`forReturn ${forReturn}`)
                    return callback(forReturn);
                }
            } else {
                //Conversation exists
                var textInMessage = messageSent.chatText.trim()
                if (textInMessage !== "") {
                    const newMessage = new Message({
                        _id: messagesId,
                        conversationId: convoId,
                        isEncrypted: false,
                        senderId: userSenderId,
                        chatText: messageSent.chatText,
                        datePosted: messageSent.datePosted,
                        dateUpdated: messageSent.dateUpdated,
                        cryptographicNonce: [],
                        encryptedChatText: [],
                        isServerMessage: false,
                        involvedIds: messageSent.involvedIds,
                        messageReactions: [],
                        inReplyTo: (messageSent.inReplyTo !== "" ? messageSent.inReplyTo._id : ""),
                        attatchments: messageSent.attatchments
                    });
                    newMessage.save().then(result => {
                        const forReturn = {
                            status: "SUCCESS",
                            message: "Sent Message"
                        }
                        console.log(`forReturn ${forReturn}`)
                        return callback(forReturn);
                    }).catch(err => {
                        console.log(err)
                        const forReturn = {
                            status: "FAILED",
                            message: "Error with saving message"
                        }
                        console.log(`forReturn ${forReturn}`)
                        return callback(forReturn);
                    });
                } else {
                    const forReturn = {
                        status: "FAILED",
                        message: "Message was empty."
                    }
                    console.log(`forReturn ${forReturn}`)
                    return callback(forReturn);
                }
            }
        }
    }).catch(err => {
        console.log(err)
        const forReturn = {
            status: "FAILED",
            message: "Error after finding conversation."
        }
        return callback(forReturn);
    })
}

function addOrRemoveReaction(messageId, reaction, toAdd, pubId, callback) {
    console.log("AORR")
    Message.findOne({_id: {$eq: messageId}}).then(messageFound => {
        if (!messageFound) {
            return callback({
                status: "FAILED",
                message: "Couldn't find message."
            });
        } else {
            const reactionAlready = messageFound.messageReactions.some(x => x.reaction == reaction && x.pubId == pubId)
            if (toAdd !== reactionAlready) {
                if (reactionAlready == false) {
                    Message.findOneAndUpdate({_id: {$eq: messageId}}, {$push: {messageReactions : {reaction: String(reaction), pubId: String(pubId)}}}).then(function () {
                        return callback({
                            status: "SUCCESS",
                            message: "Saved."
                        });
                    }).catch(err => {   
                        console.log(err)
                        return callback({
                            status: "FAILED",
                            message: "Failed to save.",
                            lastReaction: reactionAlready
                        });
                    })
                } else {
                    Message.findOneAndUpdate({_id: {$eq: messageId}}, {$pull: {messageReactions : {reaction: String(reaction), pubId: String(pubId)}}}).then(function () {
                        return callback({
                            status: "SUCCESS",
                            message: "Saved."
                        });
                    }).catch(err => {   
                        console.log(err)
                        return callback({
                            status: "FAILED",
                            message: "Failed to save.",
                            lastReaction: reactionAlready
                        });
                    })
                }
            } else {
                return callback({
                    status: "SUCCESS",
                    message: "Already the reaction."
                });
            }
        }
    }).catch(err => {
        console.log(err)
        return callback({
            status: "FAILED",
            message: "Error finding message."
        });
    })
}

function appNotActiveTimeOutForDisconnect(socketIdOfTheUser, pubId) {
    function afterTimeOutIfNotCancelled() {
        try {
            const socketFound = io.sockets.sockets.get(socketIdOfTheUser);
            io.to(socketIdOfTheUser).emit("timed-out-from-app-state")
            socketFound.disconnect()
            console.log(`Timed out from app state socket: ${socketIdOfTheUser}, ${pubId}`)
            const indexToCheckIfTimingOut = timeOutsOfSocketDisconnects.findIndex(x => x.socketIdOfTheUser == socketIdOfTheUser)
            timeOutsOfSocketDisconnects.splice(indexToCheckIfTimingOut, 1)
            console.log(timeOutsOfSocketDisconnects)
        } catch (err) {
            console.log(`Error disconnecting due to app state change: ${err}`)
        }
    }
    var indexIfAlreadyExists = timeOutsOfSocketDisconnects.findIndex(x => x.socketIdOfTheUser == socketIdOfTheUser)
    if (indexIfAlreadyExists == -1) {
        var timeoutID = setTimeout(afterTimeOutIfNotCancelled, 10000)
        timeOutsOfSocketDisconnects.push({socketIdOfTheUser: socketIdOfTheUser, timeoutID: timeoutID})
        console.log(timeOutsOfSocketDisconnects)
    }
}

// Get the objectID type
var ObjectID = require('mongodb').ObjectID;

//Remove this before release
app.use(cors({
    origin: '*'
}))

//For accepting post form data
const bodyParser = require('express').json;
app.use(bodyParser());

app.use('/user', UserRouter)
app.use('/tempRoute', TempRouter)
app.use('/conversations', ConversationsRouter)
app.use('/messages', MessagesRouter)
app.use('/publicApis', PublicApisRouter)
app.use('/feed', FeedRouter)
app.use('/admin', AdminRouter)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument)); //For API docs

const https = require('https');
const http = require('http')
const e = require('express');
const { tokenValidation } = require('./middleware/TokenHandler');

let server;

if (process.env.NO_HTTPS) {
    server = http.createServer(app)
} else {
    const options = {
        key: fs.readFileSync('./ssl/private.key'),
        cert: fs.readFileSync('./ssl/server.crt'),
        ca: [
          fs.readFileSync('./ssl/intermediate.crt'),
          fs.readFileSync('./ssl/root.crt')
        ]
    };

    if (process.env.SSL_PASSPHRASE_FILEPATH) {
        options.passphrase = fs.readFileSync('./ssl/passphrase.txt').toString()
    } else if (process.env.SSL_PASSPHRASE) {
        options.passphrase = process.env.SSL_PASSPHRASE
    } else {
        console.warn('SSL passphrase was not provided.')
    }
      
    server = https.createServer(options, app)
}


const handlePopularPosts = () => {
    handlerStatus = popularPostHandler();
}
setInterval(handlePopularPosts, 60*60*1000+5).unref(); //5 milisceonds bc why not

const io = require("socket.io")(server, {
    cors: { origin: "*" },
    'pingTimeout': 35000,
    'pingInterval': 10000
});

let currentFileUploads = {};

io.on("connection", (socket) => {
    //todo: for the socket being in its own file on front end, connect the socket, but have another self-made connect that sends id and uuids after.
    var idOnConnection = socket.handshake.query.idSentOnConnect;
    var uuidOfDevice = socket.handshake.query.uuidOfDevice;
    var pendingReactions = [];
    var reactionAdd = [];
    var reactionRemove = [];
    if (idOnConnection) {
        User.findOne({_id: {$eq: idOnConnection}}).then(userFound => {
            if (userFound) {
                if (uuidOfDevice) {
                    //--Start of connection stuff
                    let foundSameUUID = clients.clientList.find(client => client.deviceUUID == uuidOfDevice && client.pubId == userFound.secondId);
                    if (typeof foundSameUUID !== "undefined") {
                        try {
                            io.sockets.sockets.get(foundSameUUID.socketId).disconnect(true);
                        } catch(err) {
                            console.log("Error occured disconnecting socket of: ", foundSameUUID);
                        }
                        clients.removeClient(foundSameUUID.socketId, userFound.secondId);
                        console.log("Client should have been removed and disconnected.");
                    }
                    console.log("Connected:", idOnConnection, uuidOfDevice);
                    console.log(clients);
                    clients.saveClient(userFound.secondId, userFound._id, "", socket.id, uuidOfDevice, {name: userFound.name, displayName: userFound.displayName, imageKey: userFound.profileImageKey});
                    console.log(clients);
                    socket.emit("client-connected")
                    //--Online Stuff
                    //Initial Set Online
                    determineUsersForStatusSend(userFound._id, function(result) {
                        if (result == "Error") {
                            socket.emit("initial-set-online-error")
                        } else if (result == "None") {
                            socket.emit("initial-set-online-and-conversation-users-online", [])
                        } else {
                            //Success
                            if (result.length) {
                                io.sockets.to(result.map(x => x.socketId)).emit("user-in-conversation-online", {pubId: userFound.secondId, name: userFound.name, displayName: userFound.displayName, imageKey: userFound.profileImageKey})
                                let uniqueAccountsOnly = result.filter((element, index) => {
                                    return result.findIndex(x => x.pubId == element.pubId) === index;
                                });
                                socket.emit("initial-set-online-and-conversation-users-online", uniqueAccountsOnly.map(x => ({pubId: x.pubId, name: x.usersDetails.name, displayName: x.usersDetails.displayName, imageKey: x.usersDetails.imageKey})))
                            }
                        }
                    })
                    //-- socket 
                    socket.on('join-conversation', (conversationId) => {
                        Conversation.findOne({_id: {$eq: conversationId}}).then(convoToJoin => {
                            if (!convoToJoin) {
                                socket.emit("join-conversation-failed", "Could not find conversation.")
                            } else {
                                if (convoToJoin.members.some(x => x.equals(userFound._id))) {
                                    socket.join(conversationId)
                                    const index = clients.clientList.findIndex(x => x.socketId == socket.id)
                                    if (index !== -1) {
                                        clients.clientList[index].conversationId = conversationId
                                        console.log(`socket joined ${conversationId}`)
                                        socket.emit("client-joined-conversation")
                                    } else {
                                        socket.disconnect() // if their socket isn't found trigger a disconnect to prompt a reopen to the socket connection as the socket should have been found.
                                    }
                                } else {
                                    socket.emit("join-conversation-failed", "Client not found in conversation.")
                                }
                            }
                        }).catch(err => {
                            console.log(err)
                            socket.emit("join-conversation-failed", "Error finding conversation.")
                        })
                    })
                    //--message stuff
                    socket.on("send-message", (message) => {
                        Conversation.findOne({_id: {$eq: message.conversationId}}).then(convoFound => {
                            if (!convoFound) {
                                socket.emit("failed-to-send-message", "Couldn't find conversation.")
                            } else {
                                const thisUsersClient = clients.clientList.find(x => x.socketId == socket.id)
                                if (!thisUsersClient) {
                                    socket.disconnect()
                                } else {
                                    if (message.conversationId == thisUsersClient.conversationId) {
                                        let involvedIds = {};
                                        let inReplyTo = "";
                                        function checksComplete() {
                                            if (message.isEncrypted !== true) {
                                                if (message.chatText.trim().length !== 0) { //todo improve                                                  
                                                    const messagesId = new ObjectID()
                                                    console.log("Message Sending")
                                                    generateDate(function(datetime) {
                                                        var toSendToUsers = {
                                                            _id: messagesId,
                                                            publicId: userFound.secondId,
                                                            isEncrypted: false,
                                                            chatText: message.chatText,
                                                            datePosted: datetime,
                                                            dateUpdated: datetime,
                                                            cryptographicNonce: [],
                                                            encryptedChatText: [],
                                                            isServerMessage: false,
                                                            involvedIds: involvedIds,
                                                            messageReactions: [],
                                                            inReplyTo: inReplyTo,
                                                            attatchments: message.attatchments
                                                        }
                                                        socket.to(message.conversationId).emit("recieve-message", toSendToUsers)
                                                        saveToDataBase(toSendToUsers, message.conversationId, messagesId, userFound._id, function(messageSaved) {
                                                            console.log(messageSaved)
                                                            if (messageSaved.status !== "SUCCESS") {
                                                                socket.emit("message-sent-to-database", false, messageSaved.message, toSendToUsers)
                                                            } else {
                                                                socket.emit("message-sent-to-database", true, messageSaved.message, toSendToUsers)
                                                            }
                                                        })
                                                    })
                                                } else {
                                                    socket.emit("empty-text-sent")
                                                }
                                            } else {
                                                var encryptedChatText = message.encryptedChatText
                                                const allEncryptedKeysUUIDs = encryptedChatText.map(x => x.keysUniqueId)
                                                console.log("allEncryptedKeysUUIDs: ")
                                                console.log(allEncryptedKeysUUIDs)
                                                //following if checks for at least one encrypted string that isnt empty and one public encryption key uuid used
                                                if (message.cryptographicNonce.length == 24) {
                                                    const cryptographicNonce = Array.from(message.cryptographicNonce)
                                                    if (encryptedChatText.some(x => x.encryptedString.trim().length !== 0) && conversationData.publicEncryptionKeys.some(x => allEncryptedKeysUUIDs.includes(x.keysUniqueId))) {
                                                        const messagesId = new ObjectID()
                                                        console.log("Message Sending")
                                                        generateDate(function(datetime) {
                                                            var toSendToUsers = {
                                                                _id: messagesId,
                                                                publicId: userFound.secondId,
                                                                isEncrypted: true,
                                                                chatText: "",
                                                                datePosted: datetime,
                                                                dateUpdated: datetime,
                                                                cryptographicNonce: cryptographicNonce,
                                                                encryptedChatText: message.encryptedChatText,
                                                                isServerMessage: false,
                                                                involvedIds: involvedIds,
                                                                messageReactions: [],
                                                                inReplyTo: inReplyTo,
                                                                attatchments: message.attatchments
                                                            }
                                                            socket.to(message.conversationId).emit("recieve-message", toSendToUsers)
                                                            saveToDataBase(toSendToUsers, message.conversationId, messagesId, userFound._id, function(messageSaved) {
                                                                console.log(messageSaved)
                                                                if (messageSaved.status !== "SUCCESS") {
                                                                    socket.emit("message-sent-to-database", false, messageSaved.message, toSendToUsers)
                                                                } else {
                                                                    socket.emit("message-sent-to-database", true, messageSaved.message, toSendToUsers)
                                                                }
                                                            })
                                                        })
                                                    } else {
                                                        socket.emit("empty-text-sent")
                                                    }
                                                } else {
                                                    socket.emit("failed-to-send-message", "Bad nonce.")
                                                }
                                            }
                                        }
                                        if (message.inReplyTo !== "") { //add more checks around here if need be
                                            Message.findOne({_id: message.inReplyTo}).then(msgReplyingTo => {
                                                if (!msgReplyingTo || message.conversationId !== msgReplyingTo.conversationId) { //doesnt exist or not in conversation //TODO: make sure this works
                                                    socket.emit("failed-to-send-message", "Unable to find message being replied to.")
                                                } else {
                                                    inReplyTo = {
                                                        _id: msgReplyingTo._id,
                                                        publicId: "",
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
                                                    User.findOne({_id: msgReplyingTo.senderId}).then(userReplyingTo => {
                                                        if (!userReplyingTo) {
                                                            involvedIds.repliedToPubId = ""
                                                            inReplyTo.publicId = ""
                                                            inReplyTo.senderName = ""
                                                            inReplyTo.senderImageKey = ""
                                                            inReplyTo.senderDisplayName = ""
                                                            checksComplete()
                                                        } else {
                                                            involvedIds.repliedToPubId = userReplyingTo.secondId
                                                            inReplyTo.publicId = userReplyingTo.secondId
                                                            inReplyTo.senderName = userReplyingTo.name
                                                            inReplyTo.senderImageKey = userReplyingTo.profileImageKey
                                                            inReplyTo.senderDisplayName = userReplyingTo.displayName
                                                            checksComplete()
                                                        }
                                                    }).catch(err => {
                                                        console.log(err)
                                                        socket.emit("failed-to-send-message", "Error occured when finding user being replied to.")
                                                    })
                                                }
                                            }).catch(err => {
                                                console.log(err)
                                                socket.emit("failed-to-send-message", "Error occured when finding message being replied to.")
                                            })
                                        } else {
                                            checksComplete()
                                        }
                                    } else {
                                        socket.emit("client-not-connected-to-conversation")
                                    }
                                }
                            }
                        }).catch(err => {
                            console.log(err)
                            socket.emit("failed-to-send-message", "Error occured when finding conversation.")
                        })
                    })
                    // on front end spamming allowed so whenever one of the pendings stop as it is being spammed that emit would work, the sockets emiting after each completion would make sure the client gets what is correct.
                    socket.on('toggle-message-reaction', (messageId, reaction, toAddSent) => {
                        console.log("Tmr")
                        if (typeof toAddSent == "boolean") {
                            if (reaction == "") { //TODO: change to better later
                                socket.emit("failed-to-toggle-message-reaction", "Invalid reaction sent.");
                            } else {
                                Message.findOne({_id: messageId}).then(messageFound => {
                                    if (!messageFound) {
                                        socket.emit("failed-to-toggle-message-reaction", "Couldn't find message.");
                                    } else {
                                        const thisUsersClient = clients.clientList.find(x => x.socketId == socket.id)
                                        if (!thisUsersClient) {
                                            socket.disconnect();// if their socket isn't found trigger a disconnect to prompt a reopen to the socket connection as the socket should have been found.
                                        } else {
                                            if (thisUsersClient.conversationId == messageFound.conversationId) {
                                                //direct scoket emit maybe have something that stops spam after a few attempts
                                                if (toAddSent == true) {
                                                    io.to(messageFound.conversationId).emit("recieve-reaction-add", reaction, messageId, userFound._id); // TODO think of socket emit methods and what not to still show spam maybe
                                                } else {
                                                    io.to(messageFound.conversationId).emit("recieve-reaction-remove", reaction, messageId, userFound._id);
                                                }
                                                //main
                                                if (pendingReactions.some(x => x == reaction)) {
                                                    if (toAddSent == true) {
                                                        reactionRemove = reactionRemove.filter(x => x !== reaction);
                                                        reactionAdd.push(reaction);
                                                    } else {
                                                        reactionAdd = reactionAdd.filter(x => x !== reaction);
                                                        reactionRemove.push(reaction);
                                                    }
                                                } else {
                                                    pendingReactions.push(reaction);
                                                    const forRecallAORR = (toAdd) => {
                                                        addOrRemoveReaction(messageId, reaction, toAdd, userFound.secondId, function(sendBack) {
                                                            //this part first so the last emit is always the db one.
                                                            if (reactionAdd.some(x => x == reaction)) {
                                                                reactionAdd = reactionAdd.filter(x => x !== reaction)
                                                                forRecallAORR(true)
                                                            } else if (reactionRemove.some(x => x == reaction)) {
                                                                reactionRemove = reactionRemove.filter(x => x !== reaction)
                                                                forRecallAORR(false)
                                                            } else {
                                                                pendingReactions = pendingReactions.filter(x => x !== reaction)
                                                            }
                                                            //this part after as the recalls arent awaits anyway
                                                            if (sendBack.status == "FAILED") {
                                                                if (sendBack.message == "Disconnect.") {
                                                                    socket.disconnect();
                                                                } else if (sendBack.message == "Failed to save.") {
                                                                    if (sendBack.lastReaction == true) {
                                                                        io.to(messageFound.conversationId).emit("recieve-reaction-add", reaction, messageId, userFound._id);
                                                                    } else {
                                                                        io.to(messageFound.conversationId).emit("recieve-reaction-remove", reaction, messageId, userFound._id);
                                                                    }
                                                                } else {
                                                                    socket.emit("failed-to-toggle-message-reaction", sendBack.message)
                                                                }
                                                            } else {
                                                                if (toAdd == true) {
                                                                    io.to(messageFound.conversationId).emit("recieve-reaction-add", reaction, messageId, userFound._id);
                                                                } else {
                                                                    io.to(messageFound.conversationId).emit("recieve-reaction-remove", reaction, messageId, userFound._id);
                                                                }
                                                            }
                                                        })
                                                    }
                                                    forRecallAORR(toAddSent)
                                                }
                                            } else {
                                                socket.emit("client-not-connected-to-conversation");
                                            }                                          
                                        }
                                    }
                                }).catch(err => {
                                    console.log(err)
                                    socket.emit("failed-to-toggle-message-reaction", "Error finding message.")
                                })
                            }
                        } else {
                            socket.emit("failed-to-toggle-message-reaction", "To add or remove not clarified.");
                        }
                    })
                    socket.on('start-file-upload', (data) => {
                        //will have queued uploads kinda like wha discord got
                        var newUUID = uuidv4(); 
                        const thisUsersClient = clients.clientList.find(x => x.socketId == socket.id);
                        if (!thisUsersClient) {
                            socket.disconnect();// if their socket isn't found trigger a disconnect to prompt a reopen to the socket connection as the socket should have been found.
                        } else {
                            if (thisUsersClient["conversationId"] == data["conversationId"]) {
                                if (currentFileUploads.hasOwnProperty(socket.id)) {
                                    socket.emit("file-upload-in-progress"); // make queue mayb
                                } else {
                                    //todo more checks here i think
                                    currentFileUploads[socket.id] = {
                                        fileSize: data["fileSize"],
                                        uploadData: "",
                                        downloaded: 0
                                    };
                                    let filePosition = 0;
                                    try {
                                        //this part think abt bc on how it would queue but also resume a upload ykyk was thinking of some sort of id
                                    } catch (err) {
                                        console.log("New file.")
                                    }
                                }
                            } else {
                                
                            }
                        }
                    })
                    //--Inactive user stuff
                    //Function for if app comes back to foreground
                    socket.on('app-state-active', () => {
                        const indexToCheckIfTimingOut = timeOutsOfSocketDisconnects.findIndex(x => x.socketIdOfTheUser == socket.id)
                        if (indexToCheckIfTimingOut !== -1) {
                            try {
                                console.log(`Clearing timeout ${socket.id}`)
                                clearTimeout(timeOutsOfSocketDisconnects[indexToCheckIfTimingOut].timeoutID)
                                timeOutsOfSocketDisconnects.splice(indexToCheckIfTimingOut, 1)
                            } catch (err) {
                                console.log(err)
                            }
                        }
                    })
                    //Function for if app leaves foreground
                    socket.on('app-state-not-active', () => {
                        appNotActiveTimeOutForDisconnect(socket.id, userFound.secondId)
                    })
                    //--Disconnect
                    socket.on('disconnect', () => {
                        console.log('Disconnected');
                        const shouldSetOffline = clients.removeClient(socket.id, userFound.secondId);
                        console.log("Removed socket of pub id: " + userFound.secondId);
                        console.log(clients)
                        if (typeof shouldSetOffline !== "undefined") {
                            console.log("Another client, same account, but with different device.")
                        } else {
                            determineUsersForStatusSend(userFound._id, function(result) {
                                if (result == "Error") {
                                    console.log("Error getting users for set offline.")
                                } else if (result == "None") {
                                    console.log("None to set offline for.")
                                } else {
                                    //Success
                                    console.log("Setting user offline: " + userFound.secondId)
                                    if (result.length) {io.sockets.to(result.map(x => x.socketId)).emit("user-in-conversation-offline", userFound.secondId)}
                                }
                            })
                        }
                     });
                } else {
                    console.log("No device uuid sent");
                    socket.disconnect();
                }
            } else {
                console.log("No valid _id sent");
                socket.disconnect();
            }
        }).catch(err => {
            console.log(err);
            //probs change from disconnect to something else
            socket.disconnect();
        })
    } else {
        console.log("No user id sent");
        socket.disconnect();
    }
})

const serverMessage = (convoId, chatText, involvedIds, _id, datetime) => {
    const newMessage = new Message({
        _id: _id,
        conversationId: convoId,
        isEncrypted: false,
        senderId: "",
        chatText: chatText,
        datePosted: datetime,
        dateUpdated: datetime,
        encryptedChatText: [],
        isServerMessage: true,
        involvedIds: involvedIds,
        cryptographicNonce: [],
        messageReactions: [],
        inReplyTo: messageSent.inReplyTo,
        attatchments: messageSent.attatchments
    });
    newMessage.save().then(result => {
        return result;
    }).catch(err => {
        console.log(err)
        return "FAILED"
    });
}

app.post("/leaveConversations", (req, res) => {
    //passed values
    const idSent = req.body.idSent
    const conversationId = req.body.conversationId

    //main
    if (idSent == "" || conversationId == "") {
        res.json({
            status: "FAILED",
            message: "Issue with ids sent"
        })
    } else {
        User.find({_id: {$eq: idSent}}).then(userFound => {
            if (userFound.length) {
                Conversation.find({_id: {$eq: conversationId}}).then(convoFound => {
                    if (convoFound.length) {
                        if (convoFound[0].isDirectMessage !== true) {
                            if (convoFound[0].members.includes(idSent)) {
                                if (convoFound[0].members.length !== 1) {
                                    const idToTest = new ObjectID(idSent)
                                    const ownerIdToTest = new ObjectID(convoFound[0].ownerId)
                                    if (idToTest.equals(ownerIdToTest)) {
                                        res.json({
                                            status: "FAILED",
                                            message: "Please assign an owner before leaving."
                                        })
                                    } else {
                                        Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, { $pull: { members: String(idToTest) }}).then(function() { 
                                            console.log("Updated")
                                            getSocketToDisconnect(conversationId, idSent, function(toLeave) {
                                                if (toLeave == null || toLeave.length == 0) {
                                                    const serverMessagesId = new ObjectID()
                                                    //Get date
                                                    generateDate(function(datetime) {
                                                        io.sockets.in(conversationId).emit("user-left-conversation", userFound[0].secondId, serverMessagesId, datetime);
                                                        serverMessage(conversationId, "Left", {userThatLeft: userFound[0].secondId}, serverMessagesId, datetime)
                                                        res.json({
                                                            status: "SUCCESS",
                                                            message: "Successfully left.",
                                                        })
                                                    })
                                                } else {
                                                    var toLeaveItemsProcessed = 0
                                                    toLeave.forEach(function (item, index) {
                                                        const forAsync = async () => {
                                                            const socketFound = await io.sockets.sockets.get(toLeave[index])
                                                            socketFound.leave(conversationId);
                                                            toLeaveItemsProcessed++;
                                                            if (toLeaveItemsProcessed == toLeave.length) {
                                                                removeSocketFromClients(conversationId, userFound[0].secondId, function(socketRemoving) {
                                                                    if (socketRemoving !== null) {
                                                                        console.log("Socket removed from array")
                                                                        const serverMessagesId = new ObjectID()
                                                                        generateDate(function(datetime) {
                                                                            io.sockets.in(conversationId).emit("user-left-conversation", userFound[0].secondId, serverMessagesId, datetime);
                                                                            serverMessage(conversationId, "Left", {userThatLeft: userFound[0].secondId}, serverMessagesId, datetime)
                                                                            res.json({
                                                                                status: "SUCCESS",
                                                                                message: "Successfully left.",
                                                                            })
                                                                        })
                                                                    } else {
                                                                        console.log("Didn't remove from array")
                                                                        const serverMessagesId = new ObjectID()
                                                                        generateDate(function(datetime) {
                                                                            io.sockets.in(conversationId).emit("user-left-conversation", userFound[0].secondId, serverMessagesId, datetime);
                                                                            serverMessage(conversationId, "Left", {userThatLeft: userFound[0].secondId}, serverMessagesId, datetime)
                                                                            res.json({
                                                                                status: "SUCCESS",
                                                                                message: "Successfully left.",
                                                                            })
                                                                        })
                                                                    }
                                                                })
                                                            }
                                                        }
                                                        forAsync()
                                                    })  
                                                }
                                            })
                                        }).catch(err => {
                                            console.log(err)
                                            res.json({
                                                status: "FAILED",
                                                message: "Error leaving."
                                            })
                                        })
                                    }
                                } else {
                                    const conversationIdString = conversationId.toString()
                                    Message.deleteMany({conversationId: {$eq: conversationIdString}}).then(function() {
                                        Conversation.findOneAndDelete({_id: {$eq: conversationId}}).then(function() {
                                            getSocketToDisconnect(conversationId, idSent, function(toLeave) {
                                                if (toLeave == null || toLeave.length == 0) {
                                                    res.json({
                                                        status: "SUCCESS",
                                                        message: "Successfully left.",
                                                    })
                                                } else {
                                                    var toLeaveItemsProcessed = 0
                                                    toLeave.forEach(function (item, index) {
                                                        const forAsync = async () => {
                                                            const socketFound = await io.sockets.sockets.get(toLeave[index])
                                                            socketFound.leave(conversationId);
                                                            toLeaveItemsProcessed++;
                                                            if (toLeaveItemsProcessed == toLeave.length) {
                                                                const socketFound = io.sockets.sockets.get(toLeave)
                                                                socketFound.leave(conversationId);                                                
                                                                removeSocketFromClients(conversationId, userFound[0].secondId, function(socketRemoving) {
                                                                    if (socketRemoving !== null) {
                                                                        console.log("Socket removed from array")
                                                                        res.json({
                                                                            status: "SUCCESS",
                                                                            message: "Successfully left.",
                                                                        })
                                                                    } else {
                                                                        console.log("Didn't remove from array")
                                                                        res.json({
                                                                            status: "SUCCESS",
                                                                            message: "Successfully left.",
                                                                        })
                                                                    }
                                                                })
                                                            }
                                                        }
                                                        forAsync()
                                                    })
                                                }
                                            })
                                        }).catch(err => {
                                            console.log(err)
                                            res.json({
                                                status: "FAILED",
                                                message: "Error when deleting conversations."
                                            })
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                        res.json({
                                            status: "FAILED",
                                            message: "Error when deleting messages."
                                        })
                                    })
                                }
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Your not in the conversation"
                                })
                            }
                        } else {
                            res.json({
                                status: "FAILED",
                                message: "You cant leave DMs"
                            })
                        }
                    }
                }).catch(err => {
                    console.log(err)
                    res.json({
                        status: "FAILED",
                        message: "Error when deleting messages."
                    })
                })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error when deleting messages."
            })
        })
    }    
})

//remove from gc
app.post("/removeMember", (req,res) => {
    //sent
    const sentId = req.body.sentId
    const conversationId = req.body.conversationId
    const pubIdOfUserToRemove = req.body.pubIdOfUserToRemove
    
    //main
    if (sentId == "" || conversationId == "" || pubIdOfUserToRemove == "") {
        res.json({
            status: "FAILED",
            message: "Error with params passed"
        })
    } else {    
        User.find({_id: {$eq: sentId}}).then(thisUsersData => {
            if (thisUsersData.length) {
                User.find({secondId: {$eq: pubIdOfUserToRemove}}).then(toRemoveUsersData => {
                    if (toRemoveUsersData.length) {
                        Conversation.find({_id: {$eq: conversationId}}).then(convoData => {
                            if (convoData.length) {
                                if (convoData[0].isDirectMessage == false) {
                                    if (sentId == new ObjectID(convoData[0].ownerId)) {
                                        if (sentId !== toRemoveUsersData) {
                                            if (convoData[0].members.includes(toRemoveUsersData[0]._id)) {
                                                Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, { $pull: { members: toRemoveUsersData[0]._id }}).then(function() { 
                                                    console.log("Updated")
                                                    getSocketToDisconnect(conversationId, pubIdOfUserToRemove, function(toLeave) {
                                                        if (toLeave == null || toLeave.length == 0) {
                                                            const serverMessagesId = new ObjectID()
                                                            generateDate(function(datetime) {
                                                                io.sockets.in(conversationId).emit("user-kicked", thisUsersData[0].secondId, toRemoveUsersData[0].secondId, serverMessagesId, datetime)
                                                                serverMessage(conversationId, "User Kicked", {userThatKicked: thisUsersData[0].secondId, userThatGotKicked: toRemoveUsersData[0].secondId}, serverMessagesId, datetime)
                                                                res.json({
                                                                    status: "SUCCESS",
                                                                    message: "Successfully removed user.",
                                                                    data: {pubId: toRemoveUsersData[0].secondId}
                                                                })
                                                            })
                                                        } else {
                                                            var toLeaveItemsProcessed = 0
                                                            toLeave.forEach(function (item, index) {
                                                                const forAsync = async () => {
                                                                    const socketFound = await io.sockets.sockets.get(toLeave[index])
                                                                    socketFound.emit("removed-from-convo")
                                                                    socketFound.leave(conversationId);
                                                                    toLeaveItemsProcessed++;
                                                                    if (toLeaveItemsProcessed == toLeave.length) {
                                                                        removeSocketFromClients(conversationId, toRemoveUsersData[0].secondId, function(socketRemoving) {
                                                                            if (socketRemoving !== null) {
                                                                                console.log("Socket removed from array")
                                                                                const serverMessagesId = new ObjectID()
                                                                                generateDate(function(datetime) {
                                                                                    io.sockets.in(conversationId).emit("user-kicked", thisUsersData[0].secondId, toRemoveUsersData[0].secondId, serverMessagesId, datetime)
                                                                                    serverMessage(conversationId, "User Kicked", {userThatKicked: thisUsersData[0].secondId, userThatGotKicked: toRemoveUsersData[0].secondId}, serverMessagesId, datetime)
                                                                                    res.json({
                                                                                        status: "SUCCESS",
                                                                                        message: "Successfully removed user.",
                                                                                        data: {pubId: toRemoveUsersData[0].secondId}
                                                                                    })
                                                                                })
                                                                            } else {
                                                                                console.log("Didn't remove from array")
                                                                                const serverMessagesId = new ObjectID()
                                                                                generateDate(function(datetime) {
                                                                                    io.sockets.in(conversationId).emit("user-kicked", thisUsersData[0].secondId, toRemoveUsersData[0].secondId, serverMessagesId, datetime)
                                                                                    serverMessage(conversationId, "User Kicked", {userThatKicked: thisUsersData[0].secondId, userThatGotKicked: toRemoveUsersData[0].secondId}, serverMessagesId, datetime)
                                                                                    res.json({
                                                                                        status: "SUCCESS",
                                                                                        message: "Successfully removed user.",
                                                                                        data: {pubId: toRemoveUsersData[0].secondId}
                                                                                    })
                                                                                })
                                                                            }
                                                                        })
                                                                    }
                                                                }
                                                                forAsync()
                                                            })
                                                        }
                                                    })
                                                }).catch(err => {
                                                    console.log(err)
                                                    res.json({
                                                        status: "FAILED",
                                                        message: "Error occured while updating members."
                                                    })
                                                })
                                            } else {
                                                res.json({
                                                    status: "FAILED",
                                                    message: "User is not in conversation."
                                                })
                                            }
                                        } else {
                                            res.json({
                                                status: "FAILED",
                                                message: "Cant kick yourself, try leave instead."
                                            })
                                        }
                                    } else {
                                        res.json({
                                            status: "FAILED",
                                            message: "Only the owner can do this."
                                        })
                                    }
                                } else {
                                    res.json({
                                        status: "FAILED",
                                        message: "You cant remove members from a dm."
                                    })
                                }
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Couldn't find the conversation?"
                                })
                            }
                        })
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "Couldn't find user to add."
                        })
                    }
                })
            } else {
                res.json({
                    status: "FAILED",
                    message: "Error with user id passed."
                })
            }
        })
    }
})

//Toggle screenshots allowed
app.post("/changeGroupName", (req, res) => {
    //passed data
    const idSent = req.body.idSent
    const conversationId = req.body.conversationId
    const newName = req.body.newName

    //main
    if (idSent == "" || conversationId == "" || newName == "" || typeof newName !== "string") {
        res.json({
            status: "FAILED",
            message: "Issue with params sent"
        })
    } else {
        if (newName.length <= 25) {
            User.find({_id: {$eq: idSent}}).then(userFound => {
                if (userFound.length) {
                    Conversation.find({_id: {$eq: conversationId}}).then(convoFound => {
                        if (convoFound.length) {
                            if (convoFound[0].isDirectMessage == false) {
                                if (convoFound[0].conversationTitle !== newName) {
                                    Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, {conversationTitle: String(newName)}).then(function() {
                                        const serverMessagesId = new ObjectID()
                                        generateDate(function(datetime) {
                                            io.sockets.in(conversationId).emit("new-title", userFound[0].secondId, serverMessagesId, datetime)
                                            serverMessage(conversationId, "New Title", {userThatChangedIt: userFound[0].secondId}, serverMessagesId, datetime)
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Changed group name.",
                                                data: newName
                                            })
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                        res.json({
                                            status: "FAILED",
                                            message: "Error when updating."
                                        })
                                    })
                                } else {
                                    res.json({
                                        status: "FAILED",
                                        message: "This is already the name."
                                    })
                                }
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "You cant update the name of a dm."
                                })
                            }
                        } else {
                            res.json({
                                status: "FAILED",
                                message: "Issue finding conversation."
                            })
                    }
                    })
                } else {
                    res.json({
                        status: "FAILED",
                        message: "Couldn't find user."
                    })
                }
            })
        } else {
            res.json({
                status: "FAILED",
                message: "That's too long~"
            }) 
        }
    }
})

//Toggle screenshots allowed
app.post("/changeGroupDescription", (req, res) => {
    //passed data
    const idSent = req.body.idSent
    const conversationId = req.body.conversationId
    const newDescription = req.body.newDescription

    //main
    if (idSent == "" || conversationId == "" || newDescription == "" || typeof newDescription !== "string") {
        res.json({
            status: "FAILED",
            message: "Issue with params sent"
        })
    } else {
        if (newDescription.length <= 180) {
            User.find({_id: {$eq: idSent}}).then(userFound => {
                if (userFound.length) {
                    Conversation.find({_id: {$eq: conversationId}}).then(convoFound => {
                        if (convoFound.length) {
                            if (convoFound[0].isDirectMessage == false) {
                                if (convoFound[0].conversationDescription !== newDescription) {
                                    Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, {conversationDescription: String(newDescription)}).then(function() {
                                        const serverMessagesId = new ObjectID()
                                        generateDate(function(datetime) {
                                        io.sockets.in(conversationId).emit("new-description", userFound[0].secondId, serverMessagesId, datetime)
                                            serverMessage(conversationId, "New Description", {userThatChangedIt: userFound[0].secondId}, serverMessagesId, datetime)
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Changed group description.",
                                                data: newDescription
                                            })
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                        res.json({
                                            status: "FAILED",
                                            message: "Error when updating."
                                        })
                                    })
                                } else {
                                    res.json({
                                        status: "FAILED",
                                        message: "This is already the description."
                                    })
                                }
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "You cant update the description of a dm."
                                })
                            }
                        } else {
                            res.json({
                                status: "FAILED",
                                message: "Issue finding conversation."
                            })
                    }
                    })
                } else {
                    res.json({
                        status: "FAILED",
                        message: "Couldn't find user."
                    })
                }
            })
        } else {
            res.json({
                status: "FAILED",
                message: "That's too long~"
            }) 
        }
    }
})

//Toggle conversation encryption

app.post("/toggleConversationEncryption", (req,res) => {
    //passed data
    const idSent = req.body.idSent
    const conversationId = req.body.conversationId
    
    //main
    if (idSent == "" || conversationId == "") {
        res.json({
            status: "FAILED",
            message: "Error with params passed"
        })
    } else {    
        User.find({_id: {$eq: idSent}}).then(userFound => {
            if (userFound.length) {
                Conversation.find({_id: {$eq: conversationId}}).then(convoFound => {
                    if (convoFound.length) {
                        if (convoFound[0].isDirectMessage == false) {
                            if (idSent == new ObjectID(convoFound[0].ownerId)) {
                                if (convoFound[0].isEncrypted == true) {
                                    Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, {isEncrypted: false}).then(function() {
                                        const serverMessagesId = new ObjectID()
                                        generateDate(function(datetime) {
                                            io.sockets.in(conversationId).emit("encryption-toggled-off", userFound[0].secondId, serverMessagesId, datetime)
                                            serverMessage(conversationId, "Encryption Toggled Off", {userThatToggled: userFound[0].secondId}, serverMessagesId, datetime)
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Turned encryption off."
                                            })
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                        res.json({
                                            status: "FAILED",
                                            message: "Error when updating."
                                        })
                                    })
                                } else {
                                    Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, {isEncrypted: true}).then(function() {
                                        const serverMessagesId = new ObjectID()
                                        generateDate(function(datetime) {
                                            io.sockets.in(conversationId).emit("encryption-toggled-on", userFound[0].secondId, serverMessagesId, datetime)
                                            serverMessage(conversationId, "Encryption Toggled On", {userThatToggled: userFound[0].secondId}, serverMessagesId, datetime)
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Turned encryption on."
                                            })
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                        res.json({
                                            status: "FAILED",
                                            message: "Error when updating."
                                        })
                                    })
                                }
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Only the owner can do this."
                                })
                            }
                        } else {
                            if (idSent == new ObjectID(convoFound[0].members[0])) {
                                if (convoFound[0].isEncrypted == true) {
                                    Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, {isEncrypted: false}).then(function() {
                                        const serverMessagesId = new ObjectID()
                                        generateDate(function(datetime) {
                                            io.sockets.in(conversationId).emit("encryption-toggled-off", userFound[0].secondId, serverMessagesId, datetime)
                                            serverMessage(conversationId, "Encryption Toggled Off", {userThatToggled: userFound[0].secondId}, serverMessagesId, datetime)
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Turned encryption off."
                                            })
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                        res.json({
                                            status: "FAILED",
                                            message: "Error when updating."
                                        })
                                    })
                                } else {
                                    Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, {isEncrypted: true}).then(function() {
                                        const serverMessagesId = new ObjectID()
                                        generateDate(function(datetime) {
                                            io.sockets.in(conversationId).emit("encryption-toggled-on", userFound[0].secondId, serverMessagesId, datetime)
                                            serverMessage(conversationId, "Encryption Toggled On", {userThatToggled: userFound[0].secondId}, serverMessagesId, datetime)
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Turned encryption on."
                                            })
                                        })
                                    }).catch(err => {
                                        res.json({
                                            status: "FAILED",
                                            message: "Error when updating."
                                        })
                                    })
                                }
                            } else if (idSent == new ObjectID(convoFound[0].members[1])) {
                                if (convoFound[0].isEncrypted == true) {
                                    Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, {isEncrypted: false}).then(function() {
                                        const serverMessagesId = new ObjectID()
                                        generateDate(function(datetime) {
                                            io.sockets.in(conversationId).emit("encryption-toggled-off", userFound[0].secondId, serverMessagesId, datetime)
                                            serverMessage(conversationId, "Encryption Toggled Off", {userThatToggled: userFound[0].secondId}, serverMessagesId, datetime)
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Turned encryption off."
                                            })
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                        res.json({
                                            status: "FAILED",
                                            message: "Error when updating."
                                        })
                                    })
                                } else {
                                    Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, {isEncrypted: true}).then(function() {
                                        const serverMessagesId = new ObjectID()
                                        generateDate(function(datetime) {
                                            io.sockets.in(conversationId).emit("encryption-toggled-on", userFound[0].secondId, serverMessagesId, datetime)
                                            serverMessage(conversationId, "Encryption Toggled On", {userThatToggled: userFound[0].secondId}, serverMessagesId, datetime)
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Turned encryption on."
                                            })
                                        })
                                    }).catch(err => {
                                        res.json({
                                            status: "FAILED",
                                            message: "Error when updating."
                                        })
                                    })
                                }
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Error finding you in the dm."
                                })
                            }
                        }
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "Issue finding conversation."
                        })
                   }
                })
            } else {
                res.json({
                    status: "FAILED",
                    message: "Couldn't find user."
                })
            }
        })
    }
})

//add to gc
app.post("/addMember", (req,res) => {
    //sent
    const sentId = req.body.sentId
    const conversationId = req.body.conversationId
    const pubIdOfUserToAdd = req.body.pubIdOfUserToAdd
    
    //main
    if (sentId == "" || conversationId == "" || pubIdOfUserToAdd == "") {
        res.json({
            status: "FAILED",
            message: "Error with params passed"
        })
    } else {    
        User.find({_id: {$eq: sentId}}).then(thisUsersData => {
            if (thisUsersData.length) {
                User.find({secondId: {$eq: pubIdOfUserToAdd}}).then(toAddUsersData => {
                    if (toAddUsersData.length) {
                        Conversation.find({_id: {$eq: conversationId}}).then(convoData => {
                            if (convoData.length) {
                                if (convoData[0].isDirectMessage == false) {
                                    if (convoData[0].members.length <= 13) {
                                        if (convoData[0].members.includes(toAddUsersData[0]._id)) {
                                            res.json({
                                                status: "FAILED",
                                                message: "User is in conversation."
                                            })  
                                        } else {
                                            Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, { $push: { members: toAddUsersData[0]._id }}).then(function() { 
                                                console.log("Updated")
                                                const serverMessagesId = new ObjectID()
                                                generateDate(function(datetime) {
                                                    io.sockets.in(conversationId).emit("user-added", thisUsersData[0].secondId, toAddUsersData[0].secondId, serverMessagesId, datetime);
                                                    serverMessage(conversationId, "User Added", {userThatAdded: thisUsersData[0].secondId, userThatGotAdded: toAddUsersData[0].secondId}, serverMessagesId, datetime)
                                                    res.json({
                                                        status: "SUCCESS",
                                                        message: "Successfully added users.",
                                                        data: {name: toAddUsersData[0].name, displayName: toAddUsersData[0].displayName, pubId: toAddUsersData[0].secondId, imageKey: toAddUsersData[0].profileImageKey, isOwner: false}
                                                    })
                                                })
                                            }).catch(err => {
                                                console.log(err)
                                                res.json({
                                                    status: "FAILED",
                                                    message: "Error occured while updating members."
                                                })
                                            })
                                        }
                                    } else {
                                        res.json({
                                            status: "FAILED",
                                            message: "Max users."
                                        })
                                    }
                                } else {
                                    res.json({
                                        status: "FAILED",
                                        message: "You can't add members to a dm."
                                    })
                                }
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Couldn't find the conversation?"
                                })
                            }
                        })
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "Couldn't find user to add."
                        })
                    }
                })
            } else {
                res.json({
                    status: "FAILED",
                    message: "Error with user id passed."
                })
            }
        })
    }
})


app.post("/transferOwnerShip", (req, res) => {
    //passed values
    const idSent = req.body.idSent
    const convoId = req.body.convoId
    const idOfOther = req.body.idOfOther

    //main
    if (idSent == "" || convoId == "" || idOfOther == "") {
        res.json({
            status: "FAILED",
            message: "Issue with data sent"
        })
    } else {
        User.find({_id: {$eq: idSent}}).then(thisUsersData => {
            if (thisUsersData.length) {
                User.find({secondId: {$eq: idOfOther}}).then(userToBeOwner => {
                    if (userToBeOwner.length) {
                        Conversation.find({_id: {$eq: convoId}}).then(convoFound => {
                            if (convoFound.length) {
                                if (convoFound[0].isDirectMessage == false) {
                                    if (idSent == new ObjectID(convoFound[0].ownerId)) {
                                        Conversation.findOneAndUpdate({_id: {$eq: convoId}}, {ownerId: userToBeOwner[0]._id}).then(function() {
                                            const serverMessagesId = new ObjectID()
                                            generateDate(function(datetime) {
                                                io.sockets.in(convoId).emit("ownership-transferred", thisUsersData[0].secondId, userToBeOwner[0].secondId, serverMessagesId, datetime);
                                                serverMessage(convoId, "Ownership Transferred", {oldOwner: thisUsersData[0].secondId, newOwner: userToBeOwner[0].secondId}, serverMessagesId, datetime)
                                                res.json({
                                                    status: "SUCCESS",
                                                    message: "Owner Changed"
                                                })
                                            })
                                        }).catch(err => {
                                            console.log(err)
                                            res.json({
                                                status: "FAILED",
                                                message: "Error updating."
                                            })
                                        })
                                    } else {
                                        res.json({
                                            status: "FAILED",
                                            message: "Only the owner can do this."
                                        })
                                    }
                                } else {
                                    res.json({
                                        status: "FAILED",
                                        message: "DMs have a shared ownership."
                                    })
                                }
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Couldnt find conversation."
                                })
                            }   
                        }).catch(err => {
                            console.log(err)
                            res.json({
                                status: "FAILED",
                                message: "Error with finding conversation."
                            })
                        })
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "Couldn't find other user."
                        })
                    }
                }).catch(err => {
                    console.log(err)
                    res.json({
                        status: "FAILED",
                        message: "Error Finding Other User."
                    })
                })
            } else {
                res.json({
                    status: "FAILED",
                    message: "Couldn't find your user."
                })
            }
        }).catch(err => {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error Finding User."
            })
        })
    }       
})

//Post Profile Image
app.post('/postGroupIcon', upload.single('image'), async (req, res) => {
    if (!req.file) {
        console.log("No file recieved.")
        return res.send({
            status: "FAILED",
            message: "No file sent."
        });
    } else {
        console.log('File has been recieved: ', req.file.filename)
        let {userId, conversationId} = req.body;
        //check if user exists
        User.find({_id: {$eq: userId}}).then(userResult => {
            if (userResult.length) {
                Conversation.find({_id: {$eq: conversationId}}).then(convoFound => {
                    if (convoFound.length) {
                        if (convoFound[0].members.includes(userId)) {
                            if (convoFound[0].conversationImageKey !== '') {
                                //Remove old image key
                                let filepath = path.resolve(process.env.UPLOADED_PATH, convoFound[0].conversationImageKey);
                                imageHandler.deleteImage(filepath)
                            }
                            imageHandler.compressImage(req.file.filename).then(newImageKey => {
                                Conversation.findOneAndUpdate({_id: {$eq: conversationId}}, { conversationImageKey: newImageKey }).then(function(){
                                    console.log("SUCCESS1")
                                    const serverMessagesId = new ObjectID()
                                    generateDate(function(datetime) {
                                        io.sockets.in(conversationId).emit("group-icon-changed", userResult[0].secondId, serverMessagesId, datetime);
                                        serverMessage(conversationId, "Group Icon Changed", {userThatChangedIcon: userResult[0].secondId}, serverMessagesId, datetime)
                                        res.json({
                                            status: "SUCCESS",
                                            message: "Group Icon Updated",
                                        })
                                    })
                                })
                                .catch(err => {
                                    imageHandler.deleteImageByKey(newImageKey)
                                    console.log(err)
                                    res.json({
                                        status: "FAILED",
                                        message: "Error updating"
                                    })
                                });
                            }).catch(error => {
                                console.error('An error was thrown from ImageLibrary.compressImage while compressing image with filename:', req.file.filename)
                                console.error('The error was:', error)
                                imageHandler.deleteImage(req.file.path)
                                res.json({
                                    status: "FAILED",
                                    message: "Failed to compress image"
                                })
                            })
                        } else {
                            imageHandler.deleteImage(req.file.path)
                            res.json({
                                status: "FAILED",
                                message: "User couldn't be found in conversation."
                            })
                        }
                    } else {
                        imageHandler.deleteImage(req.file.path)
                        res.json({
                            status: "FAILED",
                            message: "Conversation couldn't be found?"
                        })
                    }
                }).catch(err => {
                    imageHandler.deleteImage(req.file.path)
                    console.log(err)
                    res.json({
                        status: "FAILED",
                        message: "Error searching for conversation."
                    })
                })
            } else {
                imageHandler.deleteImage(req.file.path)
                res.json({
                    status: "FAILED",
                    message: "An error occurred while getting user data!"
                })
            }
        })
        .catch(err => {
            imageHandler.deleteImage(req.file.path)
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Error searching for user"
            })
        });
    }
})

//get image key with user public ic
app.get('/getUsersDetailsWithPubIds/:pubId', (req, res) => { //Fix later (no limit to able to search for which may be an issue)
    const stringedPubIdsSent = req.params.pubId
    if (typeof stringedPubIdsSent === 'string' || stringedPubIdsSent instanceof String) {
        try {
            const pubIdsSent = stringedPubIdsSent.split(",")
            if (pubIdsSent.length !== 0) {
                var pubIdsSearched = 0
                var sendBack = []
                pubIdsSent.forEach(function (item, index) {
                    User.find({secondId: {$eq: pubIdsSent[index]}}).then(userFound => {
                        if (userFound.length) {
                            if (userFound[0].profileImageKey !== "") {
                                sendBack.push({
                                    name: userFound[0].name,
                                    displayName: userFound[0].displayName,
                                    imageKey: userFound[0].profileImageKey
                                })
                                pubIdsSearched++;
                                if (pubIdsSearched == pubIdsSent.length) {
                                    res.json({
                                        status: "SUCCESS",
                                        message: "Found all.",
                                        data: sendBack
                                    })
                                }
                            } else {
                                sendBack.push({
                                    name: userFound[0].name,
                                    displayName: userFound[0].displayName,
                                    imageKey: ""
                                })
                                pubIdsSearched++;
                                if (pubIdsSearched == pubIdsSent.length) {
                                    res.json({
                                        status: "SUCCESS",
                                        message: "Found all.",
                                        data: sendBack
                                    })
                                }
                            }
                        } else {
                            pubIdsSearched++;
                            if (pubIdsSearched == pubIdsSent.length) {
                                res.json({
                                    status: "SUCCESS",
                                    message: "Found all.",
                                    data: sendBack
                                })
                            }
                        }
                    }).catch(err => {
                        console.log(err);
                        res.json({
                            status: "FAILED",
                            message: "Error which was most likely one of the pubIds sent."
                        })
                    })
                })
            } else {
                res.json({
                    status: "FAILED",
                    message: "No pubIds sent."
                })
            }
        } catch (err) {
            console.log(err)
            res.json({
                status: "FAILED",
                message: "Issue probably with pubIds of sent"
            })
        }
    } else {
        res.json({
            status: "FAILED",
            message: "Issue with format of sent"
        })
    }
})

//get online users
app.get('/getOnlineUsersByDms', tokenValidation, (req, res) => { //Change to send back pubIds
    const idSent = req.tokenData;
    //
    const CreatedNewObjectIdForSetOffline = new ObjectID(idSent)
    console.log(CreatedNewObjectIdForSetOffline)

    if (CreatedNewObjectIdForSetOffline.toString() === idSent) {
        return res.json({
            status: "FAILED",
            message: 'idSent is not a valid ObjectID'
        })
    }

    Conversation.find({members: { $in: [CreatedNewObjectIdForSetOffline]}}).then(conversationsUserIsIn => {
        if (conversationsUserIsIn.length) {
            var itemsProcessed = 0
            var allOnline = []
            conversationsUserIsIn.forEach(function (item, index) {
                if (conversationsUserIsIn[index].isDirectMessage == true) {
                    var firstMember = conversationsUserIsIn[index].members[0]
                    var idOfOther
                    if (firstMember.equals(CreatedNewObjectIdForSetOffline)) {
                        idOfOther = conversationsUserIsIn[index].members[1]
                    } else {
                        idOfOther = conversationsUserIsIn[index].members[0]
                    }
                    User.find({_id: {$eq: idOfOther}}).then(otherUserFound => {
                        if (otherUserFound.length) {
                            getSocketToSendMessageTo(otherUserFound[0].secondId, function(socketsToSendTo) {
                                if (socketsToSendTo == null || socketsToSendTo.length == 0) {
                                    console.log("Socket returned was empty or something")
                                    itemsProcessed++;
                                    if (itemsProcessed == conversationsUserIsIn.length) {
                                        res.json({
                                            status: "SUCCESS",
                                            message: "Found Online Users.",
                                            data: allOnline
                                        })
                                    }
                                } else {
                                    var socketsProcessed = 0
                                    var validSockets = []
                                    socketsToSendTo.forEach(function (item, index) {
                                        validSockets.push(socketsToSendTo[index])
                                        socketsProcessed++;
                                        if (socketsProcessed == socketsToSendTo.length) {
                                            if (validSockets.length !== 0) {
                                                allOnline.push(otherUserFound[0].secondId)
                                                itemsProcessed++;
                                                if (itemsProcessed == conversationsUserIsIn.length) {
                                                    res.json({
                                                        status: "SUCCESS",
                                                        message: "Found Online Users.",
                                                        data: allOnline
                                                    })
                                                }
                                            } else {
                                                itemsProcessed++;
                                                if (itemsProcessed == conversationsUserIsIn.length) {
                                                    res.json({
                                                        status: "SUCCESS",
                                                        message: "Found Online Users.",
                                                        data: allOnline
                                                    })
                                                }
                                            }
                                        }
                                    })
                                }
                            })
                        } else {
                            itemsProcessed++;
                            if (itemsProcessed == conversationsUserIsIn.length) {
                                res.json({
                                    status: "SUCCESS",
                                    message: "Found Online Users.",
                                    data: allOnline
                                })
                            }
                        }
                    }).catch(err => {
                        console.log(err);
                        itemsProcessed++;
                        if (itemsProcessed == conversationsUserIsIn.length) {
                            res.json({
                                status: "SUCCESS",
                                message: "Found Online Users.",
                                data: allOnline
                            })
                        }
                    })
                } else {
                    itemsProcessed++;
                    if (itemsProcessed == conversationsUserIsIn.length) {
                        res.json({
                            status: "SUCCESS",
                            message: "Found Online Users.",
                            data: allOnline
                        })
                    }
                }
            })
        } else {
            console.log("No conversations to set online for.")
            res.json({
                status: "SUCCESS",
                message: "No conversations to set online for.",
                data: []
            })
        }
    }).catch(err => {
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error searching for online users"
        })
    })
})

//get online users
app.get('/getOnlineUsersInConversation/:idSent/:conversationId', (req, res) => {
    const idSent = req.params.idSent
    const conversationId = req.params.conversationId
    //
    Conversation.find({_id: {$eq: conversationId}}).then(conversationsUserIsIn => {
        if (conversationsUserIsIn.length) {
            const CreatedNewObjectIdForSetOffline = new ObjectID(idSent)
            console.log(CreatedNewObjectIdForSetOffline)
            if (conversationsUserIsIn[0].members.includes(CreatedNewObjectIdForSetOffline)) {
                var itemsProcessed = 0
                var allOnline = []
                if (conversationsUserIsIn[0].isDirectMessage == true) {
                    itemsProcessed++;
                    if (itemsProcessed == conversationsUserIsIn.length) {
                        res.json({
                            status: "SUCCESS",
                            message: "Found Online Users.",
                            data: allOnline
                        })
                    }
                } else {
                    if (conversationsUserIsIn[0].members == 1 || conversationsUserIsIn[0].members == 0) {
                        itemsProcessed++;
                        if (itemsProcessed == conversationsUserIsIn.length) {
                            res.json({
                                status: "SUCCESS",
                                message: "Found Online Users.",
                                data: allOnline
                            })
                        }
                    } else {
                        conversationsUserIsIn[0].members.forEach(function (item, index) {
                            getSocketToSendMessageTo(conversationsUserIsIn[index].members[index], function(socketsToSendTo) {
                                if (socketsToSendTo == null || socketsToSendTo.length == 0) {
                                    itemsProcessed++;
                                } else {
                                    var socketsChecked = 0
                                    socketsToSendTo.forEach(function (item, index) {
                                        try {
                                            if (io.sockets.sockets[socketsToSendTo[index]] !== undefined) {
                                                allOnline.push(idOfOther)
                                                socketsChecked++;
                                                if (socketsChecked == socketsToSendTo.length) {
                                                    itemsProcessed++;
                                                    if (itemsProcessed == conversationsUserIsIn.length) {
                                                        res.json({
                                                            status: "SUCCESS",
                                                            message: "Found Online Users.",
                                                            data: allOnline
                                                        })
                                                    }
                                                }
                                            } else {
                                                socketsChecked++;
                                                if (socketsChecked == socketsToSendTo.length) {
                                                    itemsProcessed++;
                                                    if (itemsProcessed == conversationsUserIsIn.length) {
                                                        res.json({
                                                            status: "SUCCESS",
                                                            message: "Found Online Users.",
                                                            data: allOnline
                                                        })
                                                    }
                                                }
                                            }
                                        } catch (e) {
                                            console.log(e)
                                            socketsChecked++;
                                            if (socketsChecked == socketsToSendTo.length) {
                                                itemsProcessed++;
                                                if (itemsProcessed == conversationsUserIsIn.length) {
                                                    res.json({
                                                        status: "SUCCESS",
                                                        message: "Found Online Users.",
                                                        data: allOnline
                                                    })
                                                }
                                            }
                                        }
                                    })
                                }
                            })
                        })
                    }
                }
            } else {
                res.json({
                    status: "FAILED",
                    message: "User not in convo."
                })
            }
        } else {
            res.json({
                status: "FAILED",
                message: "Issue finding conversation."
            })
        }
    }).catch(err => {
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error finding conversation."
        })
    })
})

app.get("/getImageOnServer/:imageKey", (req, res) => {
    const imageKey = req.params.imageKey
    
    if (typeof imageKey !== 'string') {
        res.json({
            status: "FAILED",
            message: "imageKey must be a string"
        })
    }

    try {
        const sanitizedImageKey = sanitizeFilename(imageKey)
        var filepath = path.resolve(process.env.UPLOADED_PATH, sanitizedImageKey)
        //filepath = filepath.replace(/\.[^/.]+$/, ".webp")
        
        const readableStream = fs.createReadStream(filepath, {encoding: 'base64'})
        const passThroughStream = new stream.PassThrough() // For stream error handling
        stream.pipeline(
            readableStream,
            passThroughStream, //For error handling
            (err) => {
                if (err) {
                    console.log(err) // Either no file or error
                    return res.json({
                        status: "FAILED",
                        message: "Error finding image."
                    }) 
                }
            }
        )
        passThroughStream.pipe(res)
    } catch (err) {
        console.log("Error getting image from on server.")
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error getting image from server."
        })
    }
});

app.get("/getRawImageOnServer/:imageKey", (req, res) => {
    const imageKey = req.params.imageKey

    if (typeof imageKey !== 'string') {
        res.json({
            status: "FAILED",
            message: "imageKey must be a string"
        })
    }
    
    try {
        const sanitizedImageKey = sanitizeFilename(imageKey)
        var filepath = path.resolve(process.env.UPLOADED_PATH, sanitizedImageKey)
        //filepath = filepath.replace(/\.[^/.]+$/, ".webp")
        
        const readableStream = fs.createReadStream(filepath)
        const passThroughStream = new stream.PassThrough() // For stream error handling
        stream.pipeline(
            readableStream,
            passThroughStream, //For error handling
            (err) => {
                if (err) {
                    console.log(err) // Either no file or error
                    return res.json({
                        status: "FAILED",
                        message: "Error finding image."
                    }) 
                }
            }
        )
        passThroughStream.pipe(res)
    } catch (err) {
        console.log("Error getting image from on server.")
        console.log(err)
        res.json({
            status: "FAILED",
            message: "Error getting image from server."
        })
    }
});

app.get('/checkIfRealSocialSquareServer', (req, res) => {
    res.json({
        status: "SUCCESS",
        message: "Yes. This is a real SocialSquare server."
    })
})

app.all('/{*splat}', (req, res) => {
  res.status(400).json({
    status: "FAILED",
    message: "Unknown route or method"
  })
})

module.exports = server;