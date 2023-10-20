const { Expo } = require('expo-server-sdk');
let expo = new Expo();

const RefreshToken = require('./models/RefreshToken');



function createMessages(userId, message, data, callback) {
    RefreshToken.find({userId: {$eq: userId}}, 'notificationKey').lean().then(refreshTokens => {
        const notificationKeys = refreshTokens.map(token => token.notificationKey)
        const messages = [];
        
        for (let i = 0; i < notificationKeys.length; i++) {
            if (Expo.isExpoPushToken(notificationKeys[i])) {
                messages.push({
                    to: notificationKeys[i],
                    sound: 'default',
                    title: message.title, // e.g "Post Upvoted"
                    body: message.body, // e.g "thekookiekov upvoted your post"
                    data: data // id of other and of post e.g "thekookiekovs id" "image posts id" "post type"
                })
            } else {
                console.error('Not valid token found at index', i, 'of notificationKeys array from RefreshTokens belonging to user with id:', userId, '. Notification key found:', notificationKeys[i])
            }
        }

        if (messages.length > 0) {
            console.log("messages returning")
            callback(messages)
        } else {
            console.log('No valid notification keys')
            return callback("Failed")
        }
    }).catch(error => {
        console.error('An error occurred while finding refresh tokens with userId:', userId, 'and projecting "notificationKey". The error was:', error)
        callback("Failed")
    })
}

function sendNotifications(userId, message, data) {
    createMessages(userId, message, data, async function(messages) {
        console.log("hi5")
        console.log(messages)
        if (messages !== "Failed") {
            let chunks = expo.chunkPushNotifications(messages);
            for (let chunk of chunks) {
                try {
                    let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    console.log(ticketChunk) 
                } catch (error) {
                    console.error(error);
                }
            }
        } else {
            console.log("Notification Failure")
        }
    })
}

exports.sendNotifications = sendNotifications;
