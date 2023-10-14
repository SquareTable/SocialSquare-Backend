const User = require('../models/User');
const Poll = require('../models/Poll');
const ImagePost = require('../models/ImagePost');
const Upvote = require('../models/Upvote')
const Downvote = require('../models/Downvote')
const Category = require('../models/Category')
const Thread = require('../models/Thread')
const PopularPosts = require('../models/PopularPosts');
const AccountReports = require('../models/AccountReports')
const PostReports = require('../models/PostReports');
const RefreshToken = require('../models/RefreshToken');
const Message = require('../models/Message');
const Comment = require('../models/Comment');

const HTTPWTLibrary = require('../libraries/HTTPWT');
const CONSTANTS = require('../constants');
const DEFAULTS = require('../defaults')
const HTTPWTHandler = new HTTPWTLibrary()

const HTTPLibrary = require('../libraries/HTTP');
const HTTPHandler = new HTTPLibrary();

const ImageLibrary = require('../libraries/Image');
const imageHandler = new ImageLibrary();

const ImagePostLibrary = require('../libraries/ImagePost');
const imagePostHandler = new ImagePostLibrary();

const PollPostLibrary = require('../libraries/PollPost');
const pollPostHandler = new PollPostLibrary();

const ThreadPostLibrary = require('../libraries/ThreadPost');
const threadPostHandler = new ThreadPostLibrary();

const ArrayLibrary = require('../libraries/Array');
const arrayHelper = new ArrayLibrary();

const UserLibrary = require('../libraries/User')
const userHandler = new UserLibrary();

const bcrypt = require('bcrypt')
const mongoose = require('mongoose')

const geoIPLite = require('geoip-lite')

const { sendNotifications } = require("../notificationHandler");

const { blurEmailFunction, mailTransporter } = require('../globalFunctions.js');

const { tokenValidation, refreshTokenEncryption, refreshTokenDecryption } = require("../middleware/TokenHandler");
const PollVote = require('../models/PollVote');

const { Expo } = require('expo-server-sdk')

class TempController {
    static #sendnotificationkey = (userId, notificationKey, refreshTokenId) => {
        return new Promise(resolve => {
            if (typeof notificationKey !== 'string') {
                return resolve(HTTPWTHandler.badInput(`notificationKey must be a string. Provided type: ${typeof notificationKey}`))
            }

            if (!Expo.isExpoPushToken(notificationKey)) {
                return resolve(HTTPWTHandler.badInput('notificationKey must be a valid Expo push token.'))
            }

            if (typeof refreshTokenId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`refreshTokenId must be a string. Provided type: ${typeof refreshTokenId}`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userData => {
                if (!userData) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }

                RefreshToken.findOne({_id: {$eq: refreshTokenId}}).lean().then(refreshTokenFound => {
                    if (!refreshTokenFound) {
                        return resolve(HTTPWTHandler.notFound('Could not find refresh token with provided id.'))
                    }

                    RefreshToken.findOneAndUpdate({_id: {$eq: refreshTokenId}}, {notificationKey}).then(() => {
                        return resolve(HTTPWTHandler.OK('Notification key saved.'))
                    }).catch(error => {
                        console.error('An error occurred while updating notificationKey field with:', notificationKey, 'for RefreshToken with id:', refreshTokenId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while saving notification key. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one refresh token with id:', refreshTokenId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while saving notification key. Please try again.'))
                })
            }).catch(err => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user to save notification key to.'))
            })
        })
    }

    static #changedisplayname  = (userId, desiredDisplayName) => {
        return new Promise(resolve => {
            if (typeof desiredDisplayName !== 'string') {
                return resolve(HTTPWTHandler.badInput(`Desired display name must be a string. Provided type: ${typeof desiredDisplayName}`))
            }
        
            desiredDisplayName = desiredDisplayName.trim();
        
            if (desiredDisplayName.length > CONSTANTS.MAX_USER_DISPLAY_NAME_LENGTH) {
                return HTTPWTHandler.badInput('Desired display name must be 20 characters or less.')
            }
        
            // Check if user exist
            User.findOne({ _id: {$eq: userId} }).lean().then((data) => {
                if (data) {
                    //User Exists
                    User.findOneAndUpdate({_id: {$eq: userId}}, {displayName: String(desiredDisplayName)}).then(function() {
                        return resolve(HTTPWTHandler.OK('Display name changed successfully.'))
                    }).catch(err => {
                        console.error('An error occurred while changing the display name of user with id:', userId, 'to:', desiredDisplayName, '. The error was:', err)
                        return resolve(HTTPWTHandler.serverError('An error occurred while updating display name. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('User not found'))
                }
            }).catch(err => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding existing user. Plesae try again.'))
            })
        })
    }

    static #changeemail = (userId, password, desiredEmail) => {
        return new Promise(resolve => {
            if (typeof password !== 'string') {
                return resolve(HTTPWTHandler.badInput(`password must be a string. Provided type: ${typeof password}`))
            }
        
            if (typeof desiredEmail !== 'string') {
                return resolve(HTTPWTHandler.badInput(`desiredEmail must be a string. Provided type: ${typeof desiredEmail}`))
            }
        
            password = password.trim();
            desiredEmail = desiredEmail.trim();
            
            if (password == "" || desiredEmail == "") {
                return resolve(HTTPWTHandler.badInput('Empty credentials supplied'))
            } else if (!CONSTANTS.VALID_EMAIL_TEST.test(desiredEmail)) {
                return resolve(HTTPWTHandler.badInput('Invalid desired email entered'))
            } else {
                User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                    if (!userFound) {
                        return resolve(HTTPWTHandler.notFound('Could not find user'))
                    }

                    User.findOne({ email: {$eq: desiredEmail} }).lean().then(result => {
                        // A email exists
                        if (result) {
                            return resolve(HTTPWTHandler.badInput('User with the desired email already exists'))
                        } else {
                            const hashedPassword = userFound.password;
                            bcrypt.compare(password, hashedPassword).then((result) => {
                                if (result) {
                                    // Password match
                                    User.findOneAndUpdate({_id: {$eq: userId}}, {email: String(desiredEmail)}).then(function(){
                                        return resolve(HTTPWTHandler.OK('Change Email Successful'))
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while changing email for user with id:', userId, 'to: ', String(desiredEmail), '. The error was:', err)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while updating email'))
                                    });
                                } else {
                                    return resolve(HTTPWTHandler.badInput('Invalid password entered'))
                                }
                            })
                            .catch(err => {
                                console.error('An error occured while comparing passwords:', err)
                                return resolve(HTTPWTHandler.serverError('An error occurred while comparing passwords'))
                            })
                        }
                    }).catch(error => {
                        console.error('An error occured while finding a user with email:', desiredEmail, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while checking for existing user with that email. Please try again.'))
                    })         
                }).catch(error => {
                    console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                })                                 
            }
        })
    }

    static #changepassword = (userId, currentPassword, newPassword, confirmNewPassword, IP, deviceType) => {
        return new Promise(resolve => {
            if (typeof currentPassword !== 'string') {
                return resolve(HTTPWTHandler.badInput(`currentPassword must be a string. Provided type: ${typeof currentPassword}`))
            }
        
            if (typeof newPassword !== 'string') {
                return resolve(HTTPWTHandler.badInput(`newPassword must be a string. Provided type: ${typeof newPassword}`))
            }
        
            if (typeof confirmNewPassword !== 'string') {
                return resolve(HTTPWTHandler.badInput(`confirmNewPassword must be a string. Provided type: ${typeof confirmNewPassword}`))
            }
        
        
            currentPassword = currentPassword.trim()
            newPassword = newPassword.trim()
            confirmNewPassword = confirmNewPassword.trim()
        
            if (currentPassword == "" || newPassword == "" || confirmNewPassword == "") {
                return resolve(HTTPWTHandler.badInput('Empty credentials supplied'))
            } else if (newPassword !== confirmNewPassword) {
                return resolve(HTTPWTHandler.badInput('Passwords do not match'))
            } else if (newPassword.length < CONSTANTS.MIN_USER_PASSWORD_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`Your new password must be longer than ${CONSTANTS.MIN_USER_PASSWORD_LENGTH} characters`))
            } else if (newPassword.length > CONSTANTS.MAX_USER_PASSWORD_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`Your new password cannot be more than ${CONSTANTS.MAX_USER_PASSWORD_LENGTH} characters`))
            } else {
                //Check if the user exists
                User.findOne({_id: {$eq: userId}}).lean()
                .then((data) => {
                    if (data) {
                        //User Exists
                        const hashedPassword = data.password;
                        bcrypt.compare(currentPassword, hashedPassword).then((result) => {
                            if (result) {
                                //Password match
                                const saltRounds = 10;
                                bcrypt.hash(newPassword, saltRounds).then((hashedPassword) => {
                                    const {token, refreshToken, encryptedRefreshToken} = userHandler.generateNewAuthAndRefreshTokens(data._id)
        
                                    const newRefreshTokenObject = {
                                        encryptedRefreshToken,
                                        userId: data._id,
                                        createdAt: Date.now(),
                                        admin: false
                                    }

                                    const formattedIP = HTTPHandler.formatIP(IP)
        
                                    if (data?.settings?.loginActivitySettings?.getIP) {
                                        newRefreshTokenObject.IP = formattedIP
                                    }
        
                                    if (data[0]?.settings?.loginActivitySettings?.getLocation) {
                                        const location = geoIPLite.lookup(formattedIP)
                                        newRefreshTokenObject.location = location.city + ', ' + location.country
                                    }
        
                                    if (data[0]?.settings?.loginActivitySettings?.getDeviceType) {
                                        newRefreshTokenObject.deviceType = deviceType
                                    }
        
                                    const newRefreshToken = new RefreshToken(newRefreshTokenObject)
        
                                    newRefreshToken.save().then(savedRefreshToken => {
                                        RefreshToken.deleteMany({encryptedRefreshToken: {$ne: encryptedRefreshToken}, userId: data._id, admin: false}).then(() => {
                                            User.findOneAndUpdate({_id: {$eq: userId}}, {password: hashedPassword}).then(() => {
                                                return resolve(HTTPWTHandler.OK('Changing password was a success!', {}, {token: `Bearer ${token}`, refreshToken: `Bearer ${refreshToken}`, refreshTokenId: String(savedRefreshToken._id)}))
                                            }).catch(error => {
                                                console.error('An error occurred while setting password to:', hashedPassword, 'for user with id:', userId, '. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while changing password. Please try again.'))
                                            })
                                        }).catch(error => {
                                            console.error('An error occurred while deleting all RefreshTokens that have a userId of:', data._id, 'and that do not have an encryptedRefreshToken:', encryptedRefreshToken, '. The error was:', error)
                                            return resolve(HTTPWTHandler.serverError('An error occurred while invalidating all other sessions. Please manually log out all other users from your account.'))
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while saving refresh token. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while saving refresh token. Please try again.'))
                                    })
                                }).catch((error) => {
                                    console.error('An error occured while hashing password:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while hashing password. Please try again.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.unauthorized('Invalid password entered!'))
                            }
                        }).catch((error) => {
                            console.error('An error occured while comparing passwords:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while comparing passwords'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('Cannot find user with userId provided'))
                    }
                }).catch((error) => {
                    console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user with id:', userId))
                })
            }
        })
    }

    static #changeusername = (userId, desiredUsername) => {
        return new Promise(resolve => {
            if (typeof desiredUsername !== 'string') {
                return resolve(HTTPWTHandler.badInput(`desiredUsername must be a string. Provided type: ${typeof desiredUsername}`))
            }

            if (!CONSTANTS.VALID_USERNAME_TEST.test(desiredUsername)) {
                return resolve(HTTPWTHandler.badInput('Invalid username entered'))
            }
        
            desiredUsername = desiredUsername.trim();
        
            if (desiredUsername == "") {
                return resolve(HTTPWTHandler.badInput('Username was not supplied'))
            } else {
                // Check if user exist
                User.findOne({_id: {$eq: userId}}).lean()
                .then((data) => {
                    if (data) {
                        //User Exists
                        User.findOne({name: {$eq: desiredUsername}}).lean().then(result => {
                            // A username exists
                            if (result) {
                                return resolve(HTTPWTHandler.conflict('User with the provided username already exists'))
                            } else {
                                User.findOneAndUpdate({_id: {$eq: userId}}, {name: String(desiredUsername)}).then(function(){
                                    return resolve(HTTPWTHandler.OK('Change Username Successful'))
                                })
                                .catch(err => {
                                    console.error('An error occured while updating user with id:', userId, ' to have a username:', desiredUsername, '. The error was:', err)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while updating your username. Please try again.'))
                                });
                            }
                        }).catch(error => {
                            console.error('An error occured while finding one user with name:', desiredUsername, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while checking for existing user. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('User with provided userId could not be found'))
                    }
                })
                .catch(err => {
                    console.error('An error occured while checking for a user with id:', userId, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                })
            }
        })
    }

    static #changebio = (userId, bio) => {
        return new Promise(resolve => {
            if (typeof bio !== 'string') {
                return resolve(HTTPWTHandler.badInput(`bio must be a string. Provided type" ${typeof bio}`))
            }
        
            if (bio.length > CONSTANTS.MAX_USER_BIO_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`Bio must be ${CONSTANTS.MAX_USER_BIO_LENGTH} or less characters`))
            }

            if (!CONSTANTS.VALID_BIO_TEST(bio)) {
                return resolve(HTTPWTHandler.badInput(`Bio must have ${CONSTANTS.MAX_USER_BIO_LINES} or less lines`))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then((data) => {
                if (data) {
                    User.findOneAndUpdate({_id: {$eq: userId}}, {bio: {$set: String(bio)}}).then(function(){
                        return resolve(HTTPWTHandler.OK('Change Bio Successful'))
                    })
                    .catch(err => {
                        console.error('An error occured while updating user with id:', userId, ' bio to:', bio, '. The error was:', err)
                        return resolve(HTTPWTHandler.serverError('An error occurred while updating bio. Please try again.'))
                    });
                } else {
                    return resolve(HTTPWTHandler.notFound('User with provided userId could not be found'))
                }
            })
            .catch(err => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while checking for existing user. Please try again.'))
            })
        })
    }

    static #searchpageusersearch = (userId, skip, val) => {
        return new Promise(resolve => {
            const limit = CONSTANTS.SEARCH_PAGE_USER_SEARCH_MAX_USERS_TO_RETURN;

            if (typeof skip !== 'number') {
                return resolve(HTTPWTHandler.badInput(`skip must be a number. Provided type: ${typeof skip}`))
            }

            if (typeof val !== 'string') {
                return resolve(HTTPWTHandler.badInput(`val must be a string. Provided type: ${typeof val}`))
            }


            //Check Input fields
            if (val == "") {
                return resolve(HTTPWTHandler.badInput('Search box empty!'))
            } else {
                function sendResponse(foundArray) {
                    return resolve(HTTPWTHandler.OK('Search successful', foundArray))
                }
                //Find User
                var foundArray = []
                User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                    if (userFound) {
                        User.find({$or: [ { name: {$regex: `^${val}`, $options: 'i'}}, { displayName: {$regex: `^${val}`, $options: 'i'}} ]}).skip(skip).limit(limit).lean().then(data =>{
                            if (data.length) {
                                var itemsProcessed = 0;
                                data.forEach(function (item, index) {
                                    if (data[index].blockedAccounts?.includes(userFound.secondId)) {
                                        itemsProcessed++;
                                    } else {
                                        foundArray.push(userHandler.returnPublicInformation(data[index], userFound))
                                    }
                                    itemsProcessed++;
                                    if(itemsProcessed === data.length) {
                                        console.log("Before Function")
                                        console.log(foundArray)
                                        sendResponse(foundArray);
                                    }
                                });
                            } else {
                                const message = skip > 0 ? 'No more results' : 'No results'
                                return resolve(HTTPWTHandler.notFound(message))
                            }
                        }).catch(err => {
                            console.error('An error occured while finding users with names or displaynames similar to:', val, '. The error was:', err)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding users. Please try again.'))
                        });
                    } else {
                        HTTPHandler.badInput(res, 'Your user could not be found')
                        return resolve(HTTPWTHandler.badInput('User could not be found with provided userId'))
                    }
                }).catch(error => {
                    console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                })
            }
        })
    }

    static #createpollpost = (userId, pollTitle, pollSubTitle, optionOne, optionOnesColor, optionTwo, optionTwosColor, optionThree, optionThreesColor, optionFour, optionFoursColor, optionFive, optionFivesColor, optionSix, optionSixesColor, totalNumberOfOptions, sentAllowScreenShots) => {
        return new Promise(resolve => {
            const allowedColors = ['Red', 'Orange', 'Yellow', 'Green', 'Purple']

            if (typeof pollTitle !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollTitle must be a string. Provided type: ${typeof pollTitle}`))
            }

            if (typeof pollSubTitle !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollSubTitle must be a string. Provided type: ${typeof pollSubTitle}`))
            }

            if (typeof optionOne !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionOne must be a string. Provided type: ${typeof optionOne}`))
            }

            if (!allowedColors.includes(optionOnesColor) && optionOnesColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionOnesColor must be either ${allowedColors.join(', ')} or be "Not Specified". Type provided: ${optionOnesColor}`))
            }

            if (typeof optionTwo !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionTwo must be a string. Provied type: ${typeof optionTwo}`))
            }

            if (!allowedColors.includes(optionTwosColor) && optionTwosColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionTwosColor must be either ${allowedColors.join(', ')} or be "Not Specified". Type provided: ${optionTwosColor}`))
            }

            if (typeof optionThree !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionThree must be a string. Provied type: ${typeof optionThree}`))
            }

            if (!allowedColors.includes(optionThreesColor) && optionThreesColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionThreesColor must be either ${allowedColors.join(', ')} or be "Not Specified". Type provided: ${optionThreesColor}`))
            }

            if (typeof optionFour !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionFour must be a string. Provied type: ${typeof optionFour}`))
            }

            if (!allowedColors.includes(optionFoursColor) && optionFoursColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionFoursColor must be either ${allowedColors.join(', ')} or be "Not Specified". Type provided: ${optionFoursColor}`))
            }

            if (typeof optionFive !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionFive must be a string. Provied type: ${typeof optionFive}`))
            }

            if (!allowedColors.includes(optionFivesColor) && optionFivesColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionFivesColor must be either ${allowedColors.join(', ')} or be "Not Specified". Type provided: ${optionFivesColor}`))
            }

            if (typeof optionSix !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionSix must be a string. Provied type: ${typeof optionSix}`))
            }

            if (!allowedColors.includes(optionSixesColor) && optionSixesColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionSixesColor must be either ${allowedColors.join(', ')} or be "Not Specified". Type provided: ${optionSixesColor}`))
            }

            const allowedNumbersOfOptions = ['Two', 'Three', 'Four', 'Five', 'Six']

            if (!allowedNumbersOfOptions.includes(totalNumberOfOptions)) {
                return resolve(HTTPWTHandler.badInput(`allowedNumbersOfOptions must be either ${allowedNumbersOfOptions.join(', ')}`))
            }

            pollTitle = pollTitle.trim()
            pollSubTitle = pollSubTitle.trim()
            optionOne = optionOne.trim()
            optionTwo = optionTwo.trim()
            optionThree = optionThree.trim()
            optionFour = optionFour.trim()
            optionFive = optionFive.trim()
            optionSix = optionSix.trim()

            if (pollTitle.length == 0) {
                return resolve(HTTPWTHandler.badInput('pollTitle must not be blank'))
            }

            if (pollSubTitle.length == 0) {
                return resolve(HTTPWTHandler.badInput('pollSubTitle must not be blank'))
            }

            if (optionOne.length == 0) {
                return resolve(HTTPWTHandler.badInput('optionOne must not be blank'))
            }

            if (optionTwo.length == 0) {
                return resolve(HTTPWTHandler.badInput('optionTwo must not be blank'))
            }

            const pollOptions = allowedNumbersOfOptions.indexOf(totalNumberOfOptions) + 2

            if (optionThree.length == 0 && pollOptions >= 3) {
                return resolve(HTTPWTHandler.badInput('optionThree must not be blank'))
            }

            if (optionFour.length == 0 && pollOptions >= 4) {
                return resolve(HTTPWTHandler.badInput('optionFour must not be blank'))
            }

            if (optionFive.length == 0 && pollOptions >= 5) {
                return resolve(HTTPWTHandler.badInput('optionFive must not be blank'))
            }

            if (optionSix.length == 0 && pollOptions == 6) {
                return resolve(HTTPWTHandler.badInput('optionSix must not be blank'))
            }

            //Create important ones
            const comments = []
            //
            //allowScreenShots set up
            console.log(sentAllowScreenShots)
            var allowScreenShots = sentAllowScreenShots
            if (sentAllowScreenShots == true) {
                console.log("sent allow ss was true")
                allowScreenShots = true
            } else if (sentAllowScreenShots == false) {
                console.log("sent allow ss was false")
                allowScreenShots = false
            } else {    
                console.log("Sent allow ss wasnt true or false so set true")
                allowScreenShots = true
            }
            console.log(`allowScreenShots ${allowScreenShots}`)
            //Check Input fields
            if (pollTitle == "" || pollSubTitle == "" || optionOne == "" || optionTwo == "") {
                return resolve(HTTPWTHandler.badInput('Empty input fields!'))
            } else {
                //Try to create a new post
                User.findOne({_id: {$eq: userId}}).lean().then(data => {
                    if (data) {
                        const pollObject = {
                            pollTitle,
                            pollSubTitle,
                            optionOne,
                            optionOnesColor,
                            optionTwo,
                            optionTwosColor,
                            optionThree,
                            optionThreesColor,
                            optionFour,
                            optionFoursColor,
                            optionFive,
                            optionFivesColor,
                            optionSix,
                            optionSixesColor,
                            totalNumberOfOptions,
                            creatorId: userId,
                            comments,
                            datePosted: Date.now(),
                            allowScreenShots: allowScreenShots
                        }

                        const newPoll = new Poll(pollObject);
                
                        newPoll.save().then(() => {
                            return resolve(HTTPWTHandler.OK('Poll creation successful'))
                        })
                        .catch(err => {
                            console.error('An error occured while creating a new poll post:', pollObject, '. The error was:', err)
                            return resolve(HTTPWTHandler.serverError('An error occurred while creating a poll'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('A user could not be found with provided userId'))
                    } 
                })
                .catch(err => {
                    console.error('An error occured while finding a user with _id:', userId, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                });
            }
        })
    }

    static #searchforpollposts = (userId, pubId, previousPostId) => {
        //userId is the ID of the user requesting the poll posts
        //pubId is the secondId of the user with the poll posts that are being searched for
        return new Promise(resolve => {
            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Provided type: ${typeof pubId}`))
            }

            if (typeof previousPostId !== 'string' && previousPostId !== undefined) {
                return resolve(HTTPWTHandler.badInput(`previousPostId must be either a string or undefined`))
            }
        
            //Check Input fields
            if (pubId == "") {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string'))
            } else {
                //Find User
                User.findOne({secondId: {$eq: pubId}}).lean().then(result => {
                    if (result) {
                        //User Exists
                        User.findOne({_id: {$eq: userId}}).lean().then(userGettingPollPosts => {
                            if (userGettingPollPosts) {
                                if (result.blockedAccounts?.includes(userGettingPollPosts.secondId)) {
                                    // User is blocked or the account is private but the user requesting doesn't follow the user so do not send posts
                                    return resolve(HTTPWTHandler.notFound('User could not be found.'))
                                } else if (result.privateAccount && !result.followers.includes(userGettingPollPosts.secondId)) {
                                    return resolve(HTTPWTHandler.notFound('No Poll Posts'))
                                } else {
                                    // User exists
                                    const dbQuery = {
                                        creatorId: {$eq: result._id}
                                    }

                                    if (previousPostId) {
                                        dbQuery._id = {$lt: new mongoose.Types.ObjectId(previousPostId)}
                                    }

                                    console.log('previousPostId:', previousPostId)
                                    console.log('dbQuery:', dbQuery)

                                    const time1 = performance.now()
                                    Poll.find(dbQuery).sort({datePosted: -1}).limit(CONSTANTS.NUM_POLLS_TO_SEND_PER_API_CALL).lean().then(data => pollPostHandler.processMultiplePostDataFromOneOwner(data, result, userGettingPollPosts)).then(data => {
                                        const time2 = performance.now()
                                        console.log('TIME TO PROCESS 10 POLLS:', time2 - time1, 'MILLISECONDS.')
                                        if (data.length) {
                                            const toSend = {
                                                posts: data,
                                                noMorePosts: data.length < CONSTANTS.NUM_POLLS_TO_SEND_PER_API_CALL
                                            }

                                            return resolve(HTTPWTHandler.OK('Poll search successful', toSend))
                                        } else {
                                            return resolve(HTTPWTHandler.OK('No more poll posts could be found', {posts: [], noMorePosts: true}))
                                        }
                                    }).catch(error => {
                                        console.error('An error occured while finding polls with a creatorId of:', result._id, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while finding posts. Please try again.'))
                                    })
                                }
                            } else {
                                return resolve(HTTPWTHandler.notFound('User could not be found.'))
                            }
                        }).catch(error => {
                            console.error('An error occured while finding user with ID:', userId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('User could not be found.'))
                    } 
                })
                .catch(err => {
                    console.error('An error occured while finding user with secondId:', pubId, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                });
            }
        })
    }

    static #pollpostcomment = (userId, comment, postId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            } 
        
            comment = comment.trim();
        
            if (comment.length == 0) {
                return resolve(HTTPWTHandler.badInput('comment cannot be blank'))
            }
        
            if (comment.length > CONSTANTS.MAX_USER_COMMENT_LENGTH) {
                return HTTPHandler.badInput(res, `comment cannot be longer than ${CONSTANTS.MAX_USER_COMMENT_LENGTH} characters.`)
            }

            if (!CONSTANTS.VALID_COMMENT_TEST.test(comment)) {
                return resolve(HTTPWTHandler.badInput(`comment must have less than ${CONSTANTS.MAX_USER_COMMENT_LINES} lines`))
            }
        
            //Find User
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (!result) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                Poll.findOne({_id: {$eq: postId}}).lean().then(pollFound => {
                    if (!pollFound) return resolve(HTTPWTHandler.notFound('Could not find poll post.'))

                    const newComment = {
                        commenterId: userId,
                        text: comment,
                        datePosted: Date.now(),
                        postId,
                        postFormat: "Poll"
                    }

                    const commentDocument = new Comment(newComment);

                    commentDocument.save().then(comment => {
                        comment.isOwner = true
                        return resolve(HTTPWTHandler.OK('Comment saved', comment))
                    }).catch(error => {
                        console.error('An error occurred while saving comment document:', newComment, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while saving comment. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding poll with id:', postId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll post. Please try again.'))
                })
            })
            .catch(err => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again'))
            });
        })
    }

    static #pollpostcommentreply = (userId, comment, postId, commentId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }
        
            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }
        
            comment = comment.trim();
        
            if (comment.length == 0) {
                return resolve(HTTPWTHandler.badInput('comment cannot be blank'))
            }
        
            if (comment.length > CONSTANTS.MAX_USER_COMMENT_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`comment must not be more than ${CONSTANTS.MAX_USER_COMMENT_LENGTH} long`))
            }

            if (!CONSTANTS.VALID_COMMENT_TEST.test(comment)) {
                return resolve(HTTPWTHandler.badInput(`comment must have less than ${CONSTANTS.MAX_USER_COMMENT_LINES} lines`))
            }
        
            //Find User
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Poll.findOne({_id: {$eq: postId}}).lean().then(data => {
                        if (data) {
                            var comments = data.comments
                            async function findThreads(sentIndex) {
                                const objectId = new mongoose.Types.ObjectId()
                                console.log(objectId)
                                const commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], datePosted: Date.now()}
                                Poll.findOneAndUpdate({_id: {$eq: postId}}, { $push: { [`comments.${sentIndex}.commentReplies`]: commentForPost } }).then(function(){
                                    commentForPost.commentId = String(commentForPost.commentId)
                                    commentForPost.commenterId = String(commentForPost.commenterId)
                                    commentForPost.isOwner = true;
                                    return resolve(HTTPWTHandler.OK('Comment upload successful', commentForPost))
                                })
                                .catch(err => {
                                    console.error('An error occured while adding reply to poll comment. Comment reply was:', commentForPost, '. The error was:', err)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while adding comment reply. Please try again.'))
                                });
                            }
                            var itemsProcessed = 0
                            comments.forEach(function (item, index) {
                                console.log(comments[index].commentId)
                                console.log(commentId)
                                if (comments[index].commentId == commentId) {
                                    if (itemsProcessed !== null) {
                                        console.log("Found at index:")
                                        console.log(index)
                                        findThreads(index)
                                        itemsProcessed = null
                                    }
                                } else {
                                    if (itemsProcessed !== null) {
                                        itemsProcessed++;
                                        if(itemsProcessed == comments.length) {
                                            return resolve(HTTPWTHandler.notFound("Couldn't find comment"))
                                        }
                                    }
                                }
                            });
                        } else {
                            return resolve(HTTPWTHandler.notFound('Could not find poll'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding one poll with id:', postId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                        })
                } else {
                    return resolve(HTTPWTHandler.badInput('Could not find user from userId provided'))
                } 
            })
            .catch(err => {
                console.error('An error occured while finding user with user id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            });
        })
    }

    static #searchforpollcomments = (userId, postId) => {
        return new Promise(resolve => {
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }
        
            //Check Input fields
            if (postId == "") {
                return resolve(HTTPWTHandler.badInput('postId cannot be blank'))
            } else {
                //Find User
                console.log(postId)
                function sendResponse(nameSendBackObject) {
                    console.log("Params Recieved")
                    console.log(nameSendBackObject)
                    //Convert the objectIds to strings so then they don't get messed up while serializing and deserializing while sending data to main thread to be sent to requesting client
                    const modifiedNameSendBackObject = nameSendBackObject.map(item => {
                        item.commentId = String(item.commentId)
                        item.commenterId = String(item.commenterId)
                        item.isOwner = String(userId) === String(item.commenterId)
                        return item
                    })
                    return resolve(HTTPWTHandler.OK('Comment search successful', modifiedNameSendBackObject))
                }

                Poll.findOne({_id: {$eq: postId}}).lean().then(data => {
                    if (data) {
                        var nameSendBackObject = [];
                        var comments = data.comments;
                        if (comments.length == 0) {
                            return resolve(HTTPWTHandler.OK('Comment search successful', []))
                        } else {
                            const uniqueUsers = Array.from(new Set(comments.map(item => item.commenterId)))

                            User.find({_id: {$in: uniqueUsers}}).lean().then(usersFromDatabase => {
                                const users = {};

                                usersFromDatabase.forEach(function (item, index) {
                                    users[usersFromDatabase[index]._id] = usersFromDatabase[index]
                                })

                                const uniqueUserIds = Array.from(new Set(Object.keys(users)))
                                comments.forEach(function (item, index) {
                                    if (uniqueUserIds.includes(comments[index].commenterId)) {
                                        var commentUpVotes = (comments[index].commentUpVotes.length - comments[index].commentDownVotes.length)
                                        var commentUpVoted = false
                                        if (comments[index].commentUpVotes.includes(userId)) {
                                            commentUpVoted = true
                                        }
                                        var commentDownVoted = false
                                        if (comments[index].commentDownVotes.includes(userId)) {
                                            commentDownVoted = true
                                        }

                                        const creatorOfComment = users[comments[index].commenterId]

                                        nameSendBackObject.push({
                                            commentId: comments[index].commentId,
                                            commenterName: creatorOfComment.name,
                                            commenterDisplayName: creatorOfComment.displayName,
                                            commentText: comments[index].commentsText,
                                            commentUpVotes: commentUpVotes,
                                            commentReplies: comments[index].commentReplies.length,
                                            datePosted: comments[index].datePosted,
                                            profileImageKey: creatorOfComment.profileImageKey,
                                            commentUpVoted: commentUpVoted,
                                            commentDownVoted: commentDownVoted
                                        })
                                    } else {
                                        console.error('A comment was found on poll with id:', postId, 'by user with id:', comments[index].commenterId, '. This user could not be found in the database. This comment should be deleted')
                                    }
                                })

                                sendResponse(nameSendBackObject)
                            }).catch(error => {
                                console.error('An error occurred while finding users with ids inside of array:', uniqueUsers, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding the creators of the comments. Please try again.'))
                            })
                        }
                    } else {
                        return resolve(HTTPWTHandler.notFound('Poll could not be found'))
                    }
                })
                .catch(err => {
                    console.error('An error occured while finding poll with id:', postId, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                });
            }
        })
    }

    static #voteonpoll = (userId, optionSelected, pollId) => {
        return new Promise(resolve => {
            if (typeof optionSelected !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionSelected must be a string. Provided type: ${typeof optionSelected}`))
            }
        
            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
            }
        
            const allowedOptionsToSelect = ['One', 'Two', 'Three', 'Four', 'Five', 'Six']
            if (!allowedOptionsToSelect.includes(optionSelected)) {
                return resolve(HTTPWTHandler.badInput(`optionSelected must be either ${allowedOptionsToSelect.join(', ')}`))
            }

            if (pollId.length == 0) {
                return resolve(HTTPWTHandler.badInput('pollId cannot be an empty string'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    //User exists
                    Poll.findOne({_id: {$eq: pollId}}).lean().then(data => {
                        if (data) {
                            if (data.creatorId == userId) {
                                return resolve(HTTPWTHandler.forbidden('You cannot vote on your own poll'))
                            }

                            if (data.totalNumberOfOptions === "Two" && (allowedOptionsToSelect.slice(2).includes(optionSelected))) {
                                //There are only two options and the optionSelected is Three or more
                                return resolve(HTTPWTHandler.badInput('Invalid vote'))
                            }

                            if (data.totalNumberOfOptions === "Three" && (allowedOptionsToSelect.slice(3).includes(optionSelected))) {
                                //There are only two options and the optionSelected is Three or more
                                return resolve(HTTPWTHandler.badInput('Invalid vote'))
                            }

                            if (data.totalNumberOfOptions === "Four" && (allowedOptionsToSelect.slice(4).includes(optionSelected))) {
                                //There are only two options and the optionSelected is Three or more
                                return resolve(HTTPWTHandler.badInput('Invalid vote'))
                            }

                            if (data.totalNumberOfOptions === "Five" && (allowedOptionsToSelect.slice(5).includes(optionSelected))) {
                                //There are only two options and the optionSelected is Three or more
                                return resolve(HTTPWTHandler.badInput('Invalid vote'))
                            }

                            PollVote.findOneAndUpdate({userId: {$eq: userId}, pollId: {$eq: pollId}}, {dateVoted: Date.now(), vote: optionSelected}, {upsert: true}).then(() => {
                                return resolve(HTTPWTHandler.OK('Added poll vote'))
                            }).catch(error => {
                                console.error('An error occurred while finding one and updating PollVote with filter filtering by userId:', userId, 'and pollId:', pollId, 'and update query updating dateVoted to Date.now() and vote to:', optionSelected, 'and upserts are enabled. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while adding vote to the poll. Please try again.'))
                            })
                        } else {
                            return resolve(HTTPWTHandler.notFound('Could not find poll'))
                        }
                    }).catch(error => {
                        console.error('An error occured while finding poll with id:', pollId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user with your id. Please try again.'))
            })
        })
    }

    static #removevoteonpoll = (userId, pollId) => {
        return new Promise(resolve => {
            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }

                Poll.findOne({_id: {$eq: pollId}}).lean().then(pollFound => {
                    if (!pollFound) {
                        return resolve(HTTPWTHandler.notFound('Could not find poll with provided pollId'))
                    }

                    PollVote.deleteMany({userId: {$eq: userId}, pollId: {$eq: pollId}}).then(() => {
                        return resolve(HTTPWTHandler.OK('Removed vote successfully'))
                    }).catch(error => {
                        console.error('An error occurred while deleting many PollVotes with userId:', userId, 'and pollId:', pollId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while removing vote from poll. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one poll with id:', pollId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #searchforpollpostsbyid = (userId, pollId) => {
        return new Promise(resolve => {
            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
            }
        
            //Check Input fields
            if (pollId == "" || userId == "") {
                return resolve(HTTPWTHandler.badInput('pollId or userId is an empty string. That is not allowed.'))
            } else {
                //Find User
                User.findOne({_id: {$eq: userId}}).lean().then(userRequesting => {
                    if (userRequesting) {
                        Poll.findOne({_id: {$eq: pollId}}).lean().then(data => {
                            if (data) {
                                User.findOne({_id: data.creatorId}).lean().then(pollOwner => {
                                    if (pollOwner) {
                                        pollPostHandler.processMultiplePostDataFromOneOwner([data], pollOwner, userRequesting).then(pollData => {
                                            return resolve(HTTPWTHandler.OK('Poll search successful', pollData[0]))
                                        }).catch(error => {
                                            console.error('An error occured while processing poll post. The error was:', error)
                                            return resolve(HTTPWTHandler.serverError('An error occurred while processing post data. Please try again.'))
                                        })
                                    } else {
                                        return resolve(HTTPWTHandler.notFound('Poll creator could not be found'))
                                    }
                                }).catch(error => {
                                    console.error('An error occured while finding user with id:', data.creatorId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll creator. Please try again.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('Poll could not be found'))
                            }
                        }).catch(error => {
                            console.error('An error occured while finding poll with id:', pollId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding poll post. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                    }
                }).catch(error => {
                    console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll post. Please try again.'))
                })
            }
        })
    }

    static #upvotepoll = (userId, pollId) => {
        return new Promise(resolve => {
            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
            }
        
            //Check Input fields
            if (userId == "" || pollId == "") {
                return resolve(HTTPWTHandler.badInput(`userId or pollId is an empty string. That is not allowed.`))
            } else {
                //Find User
                User.findOne({_id: {$eq: userId}}).lean().then(result => {
                    if (result) {
                        //User exists
                        Poll.findOne({_id: {$eq: pollId}}).lean().then(data => {
                            if (data) {
                                pollPostHandler.upvote(data, result).then(successMessage => {
                                    return resolve(HTTPWTHandler.OK(successMessage))
                                }).catch(error => {
                                    if (error.privateError) {
                                        console.error('An error occured while upvoting poll post. The error was:', error.privateError)
                                    }
                                    return resolve(HTTPWTHandler.serverError(error.publicError))
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('Poll could not be found'))
                            }
                        }).catch(error => {
                            console.error('An error occured while finding poll with id:', pollId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('Could not find user with provided userId. Possible error with user details?'))
                    }
                }).catch(error => {
                    console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again later.'))
                })
            }
        })
    }

    static #downvotepoll = (userId, pollId) => {
        return new Promise(resolve => {
            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
            }
        
            //Check Input fields
            if (userId == "" || pollId == "") {
                return resolve(HTTPWTHandler.badInput('Either userId or pollId is an empty string. This is not allowed.'))
            } else {
                //Find User
                User.findOne({_id: {$eq: userId}}).lean().then(result => {
                    if (result) {
                        //User exists
                        Poll.findOne({_id: {$eq: pollId}}).lean().then(data => {
                            if (data) {
                                pollPostHandler.downvote(data, result).then(successMessage => {
                                    return resolve(HTTPWTHandler.OK(successMessage))
                                }).catch(error => {
                                    if (error.privateError) {
                                        console.error('An error occured while downvoting poll post. The error was:', error.privateError)
                                    }
                                    return resolve(HTTPWTHandler.serverError(error.publicError))
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('Could not find poll'))
                            }
                        }).catch(error => {
                            console.error('An error occured while finding user with id:', pollId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('Could not find user with provided userId. Possible error with user details?'))
                    }
                }).catch(error => {
                    console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again later.'))
                })
            }
        })
    }

    static #getsinglepollcomment = (userId, postId, commentId) => {
        return new Promise(resolve => {
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof postId}`))
            }
        
            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`sentCommentId must be a string. Provided type: ${typeof commentId}`))
            }

            if (postId.length == 0) {
                return resolve(HTTPWTHandler.badInput(`postId must not be an empty string`))
            }

            if (commentId.length == 0) {
                return resolve(HTTPWTHandler.badInput(`commentId must not be an empty string`))
            }
        
            function sendResponse(nameSendBackObject) {
                console.log("Params Recieved")
                console.log(nameSendBackObject)
                HTTPHandler.OK(res, 'Comment search successful', nameSendBackObject)
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('User with provided userId could not be found'))
                }

                Poll.findOne({_id: {$eq: postId}}).lean().then(data => {
                    if (data) {
                        const comments = data.comments
                        const nameSendBackObject = [];

                        if (comments.length == 0) {
                            return resolve(HTTPWTHandler.notFound('No comments found on poll'))
                        } else {
                            function forAwaits(index) {
                                User.findOne({_id: comments[index].commenterId}).lean().then(result => {
                                    if (result) {
                                        var commentUpVotes = (comments[index].commentUpVotes.length - comments[index].commentDownVotes.length)
                                        var commentUpVoted = false
                                        if (comments[index].commentUpVotes.includes(userId)) {
                                            commentUpVoted = true
                                        }
                                        var commentDownVoted = false
                                        if (comments[index].commentDownVotes.includes(userId)) {
                                            commentDownVoted = true
                                        }
                                        nameSendBackObject.push({
                                            commentId: String(comments[index].commentId),
                                            commenterName: result.name,
                                            commenterDisplayName: result.displayName,
                                            commentText: comments[index].commentsText,
                                            commentUpVotes: commentUpVotes,
                                            commentDownVotes: comments[index].commentDownVotes,
                                            commentReplies: comments[index].commentReplies.length,
                                            datePosted: comments[index].datePosted,
                                            profileImageKey: result.profileImageKey,
                                            commentUpVoted: commentUpVoted,
                                            commentDownVoted: commentDownVoted,
                                            isOwner: String(comments[index].commenterId) === String(userId)
                                        })
                                        sendResponse(nameSendBackObject)
                                    } else {
                                        console.error('There is a comment with id:', commentId, "and it's owner is not found in the database. This comment should be deleted immediately.")
                                    }
                                }).catch(error => {
                                    console.error('An error occurred while finding one user with id:', comments[index].commenterId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again later.'))
                                })
                            }
                            var itemsProcessed  = 0
                            const index = comments.findIndex(comment => comment.commentId == commentId)

                            if (index === -1) {
                                return resolve(HTTPWTHandler.notFound('Comment could not be found'))
                            }

                            forAwaits(index)
                        }
                    } else {
                        return resolve(HTTPWTHandler.notFound('Poll could not be found'))
                    }
                })
                .catch(err => {
                    console.error('An error occured while finding poll with id:', postId, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                });
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #searchforpollcommentreplies = (userId, postId, commentId) => {
        return new Promise(resolve => {
            if (typeof postId !== 'string') {
                return HTTPHandler.badInput(res, `postId must be a string. Provided type: ${typeof postId}`)
            }
        
            if (typeof commentId !== 'string') {
                return HTTPHandler.badInput(res, `commentId must be a string. Provided type: ${typeof commentId}`)
            }
        
            if (postId.length == 0) {
                return HTTPHandler.badInput(res, 'postId must not be an empty string.')
            }
        
            if (commentId.length == 0) {
                return HTTPHandler.badInput(res, 'commentId must not be an empty string.')
            }
        
            function sendResponse(nameSendBackObject) {
                console.log("Params Recieved")
                console.log(nameSendBackObject)
                HTTPHandler.OK(res, 'Comment search successful', nameSendBackObject)
            }
        
            Poll.findOne({_id: {$eq: postId}}).then(data => {
                if (data) {
                    var nameSendBackObject = [];
                    var comments = data.comments;
                    if (comments.length == 0) {
                        return resolve(HTTPWTHandler.notFound('No comments'))
                    } else {
                        function forAwaits(index) {
                            var itemsProcessed = 0;
                            var commentReplies = comments[index].commentReplies;
                            if (commentReplies.length == 0) {
                                return resolve(HTTPWTHandler.notFound('No replies'))
                            } else {
                                console.log(commentReplies)
    
                                const uniqueUsers = Array.from(new Set(commentReplies.map(reply => reply.commenterId)))
    
                                User.find({_id: {$in: uniqueUsers}}).lean().then(usersFound => {
                                    const users = {}
                                    for (const user of usersFound) {
                                        users[String(user._id)] = user;
                                    }
    
                                    for (const item of commentReplies) {
                                        const commentUpVotes = (item.commentUpVotes.length - item.commentDownVotes.length)
                                        const commentUpVoted = item.commentUpVotes.includes(sentUserId)
                                        const commentDownVoted = item.commentDownVotes.includes(sentUserId)
    
                                        const user = users[item.commenterId]
    
                                        if (user) {
                                            nameSendBackObject.push({
                                                commentId: item.commentId,
                                                commenterName: user.name,
                                                commenterDisplayName: user.displayName,
                                                commentText: item.commentsText,
                                                commentUpVotes: commentUpVotes,
                                                commentDownVotes: item.commentDownVotes,
                                                datePosted: item.datePosted,
                                                profileImageKey: user.profileImageKey,
                                                commentUpVoted: commentUpVoted,
                                                commentDownVoted: commentDownVoted,
                                                isOwner: String(item.commenterId) === String(userId)
                                            })
                                        } else {
                                            console.error("A comment exists but it's creator's account has been deleted. This comment must be deleted immediately. Comment id:", item._id, ' User Id:', item.commenterId)
                                        }
                                    }

                                    sendResponse(nameSendBackObject)
                                }).catch(error => {
                                    console.error('An error occurred while finding users with an id inside of this array:', uniqueUsers, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding comment creators. Please try again.'))
                                })
                            }
                        }
                        var itemsProcessed = 0
                        comments.forEach(function (item, index) {
                            console.log(comments[index].commentId)
                            if (comments[index].commentId == sentCommentId) {
                                if (itemsProcessed !== null) {
                                    console.log("Found at index:")
                                    console.log(index)
                                    forAwaits(index)
                                    itemsProcessed = null
                                }
                            } else {
                                if (itemsProcessed !== null) {
                                    itemsProcessed++;
                                    if(itemsProcessed == comments.length) {
                                        return resolve(HTTPWTHandler.notFound('Could not find comment'))
                                    }
                                }
                            }
                        });
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound('Poll could not be found'))
                }
            })
            .catch(err => {
                console.error('An error occured while finding poll with id:', postId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
            });
        })
    }

    static #deletepoll = (userId, pollId) => {
        return new Promise(resolve => {
            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
            }
        
            if (pollId.length == 0) {
                return resolve(HTTPWTHandler.badInput('pollId must not be an empty string.'))
            }
        
            //Find User
            User.findOne({_id: {$eq: userId}}).lean().then(userDeletingPoll => {
                if (userDeletingPoll) {
                    Poll.findOne({_id: {$eq: pollId}}).lean().then(poll => {
                        if (poll) {
                            if (String(userId) === String(poll.creatorId)) {
                                mongoose.startSession().then(session => {
                                    session.startTransaction();

                                    Promise.all([
                                        Poll.deleteOne({_id: {$eq: pollId}}, {session}),
                                        Upvote.deleteMany({postId: pollId, postFormat: "Poll"}, {session}),
                                        Downvote.deleteMany({postId: pollId, postFormat: "Poll"}, {session}),
                                        PollVote.deleteMany({pollId: {$eq: pollId}}, {session})
                                    ]).then(() => {
                                        session.commitTransaction().then(() => {
                                            session.endSession().catch(error => {
                                                console.error('An error occurred while ending Mongoose session:', error)
                                            }).finally(() => {
                                                return resolve(HTTPWTHandler.OK('Successfully deleted poll'))
                                            })
                                        })
                                    }).catch(error => {
                                        session.abortTransaction().catch(error => {
                                            console.error('An error occurred while aborting Mongoose transaction:', error)
                                        }).finally(() => {
                                            session.endSession().catch(error => {
                                                console.error('An error occurred while ending Mongoose session:', error)
                                            }).finally(() => {
                                                console.error('An error occurred while deleting poll and associated data from poll with id:', pollId, '. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting poll. Please try again.'))
                                            })
                                        })
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while starting a mongoose session:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting poll. Please try again.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.forbidden('You are not authorised to delete this post.'))
                            }
                        } else {
                            return resolve(HTTPWTHandler.notFound('Could not find post.'))
                        }
                    }).catch(error => {
                        console.error('An error occured while finding poll with id:', pollId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again later.'))
            })
        })
    }

    static #postImage = (creatorId, title, description, sentAllowScreenShots, file) => {
        return new Promise(resolve => {
            if (!file) {
                return resolve(HTTPWTHandler.badInput('No file was sent.'))
            }
        
            const deleteFile = () => {
                imageHandler.deleteMulterTempImage(file.filename, false)
            }
        
            if (typeof title !== 'string') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`title must be a string. Provided type: ${typeof title}`))
            }
        
            if (typeof description !== 'string') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`description must be a string. Provided type: ${typeof description}`))
            }
            
            title = title.trim()
            description = description.trim()
            //console.log(file)
            console.log(title)
            console.log(description)
            console.log(creatorId)
            User.findOne({_id: creatorId}).lean().then(result => {
                if (result) {
                    //allowScreenShots set up
                    console.log(sentAllowScreenShots)
                    var allowScreenShots = sentAllowScreenShots
                    if (sentAllowScreenShots == true || allowScreenShots == "true") {
                        console.log("sent allow ss was true")
                        allowScreenShots = true
                    } else if (sentAllowScreenShots == false || allowScreenShots == "false") {
                        console.log("sent allow ss was false")
                        allowScreenShots = false
                    } else {    
                        console.log("Sent allow ss wasnt true or false so set true")
                        allowScreenShots = true
                    }
                    console.log(`allowScreenShots ${allowScreenShots}`)
        
                    imageHandler.compressImage(file.filename).then(imageKey => {
                        const newImagePostObject = {
                            imageKey,
                            imageTitle: title, 
                            imageDescription: description,
                            creatorId: creatorId,
                            comments: [],
                            datePosted: Date.now(),
                            allowScreenShots: allowScreenShots,
                        }

                        const newImage = new ImagePost(newImagePostObject);
        
                        newImage.save().then(result => {
                            return resolve(HTTPWTHandler.OK('Post successful'))
                        })
                        .catch(err => {
                            console.error('An error occured while saving post with newImagePostObject being:', newImagePostObject, '. The error was:', err)
                            imageHandler.deleteImageByKey(imageKey)
                            return resolve(HTTPWTHandler.serverError('An error occurred while saving post!'))
                        })
                    }).catch(error => {
                        console.error('An error was thrown from ImageLibrary.compressImage while compressing image with filename:', file.filename, '. The error was:', error)
                        imageHandler.deleteMulterTempImage(file.filename)
                        return resolve(HTTPWTHandler.serverError('Failed to compress image'))
                    })
                } else {
                    imageHandler.deleteMulterTempImage(file.filename)
                    return resolve(HTTPWTHandler.notFound('Could not find user with your id'))
                }
            }).catch(err => {
                imageHandler.deleteMulterTempImage(file.filename)
                console.error('An error occurred while finding user with id:', creatorId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #postProfileImage = (userId, file) => {
        return new Promise(resolve => {
            if (file) {
                return resolve(HTTPWTHandler.badInput('No file was sent.'))
            }
        
        
            console.log('File has been recieved: ', file.filename)
            //check if user exists
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    imageHandler.compressImage(file.filename).then(imageKey => {
                        if (result.profileImageKey != "") {
                            //Remove previous profile image if the user already has one
                            imageHandler.deleteImageByKey(result.profileImageKey)
                        }
                        User.findOneAndUpdate({_id: {$eq: userId}}, { profileImageKey: imageKey }).then(function(){
                            console.log("SUCCESS1")
                            return resolve(HTTPWTHandler.OK('Profile Image Updated'))
                        })
                        .catch(err => {
                            console.error('An error occurred while updating user with id:', userId, ' profileImageKey to:', imageKey, '. The error was:', err)
                            imageHandler.deleteImageByKey(imageKey)
                            return resolve(HTTPWTHandler.serverError('An error occurred while updating profile picture. Please try again.'))
                        });
                    }).catch(error => {
                        console.error('An error was thrown from ImageLibrary.compressImage while compressing image with filename:', file.filename, '. The error was:', error)
                        imageHandler.deleteMulterTempImage(file.filename)
                        return resolve(HTTPWTHandler.serverError('Failed to compress image. Please try again.'))
                    })
                } else {
                    imageHandler.deleteMulterTempImage(file.filename)
                    return resolve(HTTPWTHandler.notFound('User could not be found with provided userId'))
                }
            }).catch(err => { 
                console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
                imageHandler.deleteMulterTempImage(file.filename)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            });
        })
    }

    static #getImagesFromProfile = (userId, pubId, previousPostId) => {
        return new Promise(resolve => {
            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Type provided: ${typeof pubId}`))
            }
        
            if (pubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string.'))
            }

            if (typeof previousPostId !== 'string' && previousPostId !== undefined) {
                return resolve(HTTPWTHandler.badInput(`previousPostId must be a string or undefined. Type provided: ${typeof previousPostId}`))
            }

            if (previousPostId?.length === 0) {
                return resolve(HTTPWTHandler.badInput('previousPostId cannot be a blank string'))
            }
        
            const getImagesAndSendToUser = (postOwner, userRequesting) => {
                const dbQuery = {
                    creatorId: postOwner._id
                }

                if (previousPostId != undefined) {
                    dbQuery._id = {$lt: previousPostId}
                }

                ImagePost.find(dbQuery).sort({datePosted: -1}).limit(CONSTANTS.NUM_IMAGE_POSTS_TO_SEND_PER_API_CALL).lean().then(result => imagePostHandler.processMultiplePostDataFromOneOwner(result, postOwner, userRequesting)).then(result => {
                    if (result.length) {
                        const toSend = {
                            posts: result,
                            noMorePosts: result.length < CONSTANTS.NUM_IMAGE_POSTS_TO_SEND_PER_API_CALL
                        }

                        return resolve(HTTPWTHandler.OK('Posts found', toSend))
                    } else {
                        return resolve(HTTPWTHandler.OK('No more image posts could be found', {posts: [], noMorePosts: true}))
                    }
                }).catch(error => {
                    console.error('An error occured while getting user images from user with id:', postOwner._id, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while getting user image posts. Please try again.'))
                })
            }
        
            User.findOne({secondId: {$eq: pubId}}).lean().then(data => {
                User.findOne({_id: {$eq: userId}}).lean().then(secondData => {
                    console.log('Second Data:', secondData)
                    console.log('userId:', userId)
                    if (!data) {
                        return resolve(HTTPWTHandler.notFound('User could not be found'))
                    }

                    if (!secondData) {
                        return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                    }

                    const userPublicID = secondData.secondId;
                    const isOwner = userId == data._id.toString()
                    if (isOwner === true) {
                        getImagesAndSendToUser(data, secondData)
                    } else if (data.blockedAccounts?.includes(userPublicID)) {
                        return resolve(HTTPWTHandler.notFound('User not found.'))
                    } else {
                        if (data.privateAccount != true) {
                            getImagesAndSendToUser(data, secondData)
                        } else {
                            //ACCOUNT IS PRIVATE
                            const isFollowingUser = data.followers.includes(userPublicID);
                            if (isFollowingUser == true) {
                                //User is following this account so send posts
                                getImagesAndSendToUser(data, secondData)
                            } else {
                                //User is not following this account so DO NOT SEND POSTS
                                return resolve(HTTPWTHandler.notFound('This user has no image posts!'))
                            }
                        }
                    }
                }).catch(error => {
                    console.error('An error occurred while finding user with ID:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding user with secondId:', pubId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getProfilePic = (pubId) => {
        return new Promise(resolve => {
            User.findOne({secondId: {$eq: pubId}}).lean().then(data => { 
                if (data) { 
                    const profileKey = data.profileImageKey
                    if (profileKey !== "") {
                        return resolve(HTTPWTHandler.OK('Profile image found.', profileKey))
                    } else {
                        return resolve(HTTPWTHandler.notFound('No profile image.'))
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with pubId provided.'))
                }
            })
            .catch(err => { 
                console.error('An error occurred while finding one user with secondId:', pubId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again later.'))
            });
        })
    }

    static #imagepostcomment = (userId, comment, postId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`imageId must be a string. Provided type: ${typeof postId}`))
            }
        
            comment = comment.trim()
        
            if (comment.length == 0) {
                return resolve(HTTPWTHandler.badInput('comment must not be an empty string.'))
            }
        
            if (postId.length == 0) {
                return resolve(HTTPWTHandler.badInput('postId must not be an empty string'))
            }
        
            if (comment.length > CONSTANTS.MAX_USER_COMMENT_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`comment must not be more than ${CONSTANTS.MAX_USER_COMMENT_LENGTH} characters long`))
            }

            if (!CONSTANTS.VALID_COMMENT_TEST.test(comment)) {
                return resolve(HTTPWTHandler.badInput(`comment must have less than ${CONSTANTS.MAX_USER_COMMENT_LINES} lines`))
            }
        
            //Find User
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    const objectId = new mongoose.Types.ObjectId()
                    console.log(objectId)
                    const commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], commentReplies: [], datePosted: Date.now()}
                    ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $push: { comments: commentForPost } }).then(function(){
                        console.log("SUCCESS1")
                        commentForPost.commentId = String(commentForPost.commentId)
                        commentForPost.commenterId = String(commentForPost.commenterId)
                        commentForPost.isOwner = true;
                        return resolve(HTTPWTHandler.OK('Comment upload successful', commentForPost))
                    })
                    .catch(err => {
                        console.error('An error occurred while pushing comment object:', commentForPost, 'to comments field for image with id:', postId, '. The error was:', err)
                        return resolve(HTTPWTHandler.serverError('An error occurred while adding comment. Please try again.'))
                    });
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with userId provided'))
                } 
            })
            .catch(err => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            });
        })
    }

    static #imagepostcommentreply = (userId, comment, postId, commentId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }

            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }
        
            comment = comment.trim();
        
            if (comment.length == 0) {
                return resolve(HTTPWTHandler.badInput('comment cannot be an empty string.'))
            }
        
            if (postId.length == 0) {
                return resolve(HTTPWTHandler.badInput('postId cannot be an empty string.'))
            }

            if (commentId.length == 0) {
                return resolve(HTTPWTHandler.badInput('commentId cannot be an empty string.'))
            }
        
            if (comment.length > CONSTANTS.MAX_USER_COMMENT_LENGTH) {
                return HTTPHandler.badInput(res, `comment must not be more than ${CONSTANTS.MAX_USER_COMMENT_LENGTH} characters long`)
            }

            if (!CONSTANTS.VALID_COMMENT_TEST.test(comment)) {
                return resolve(HTTPWTHandler.badInput(`comment must have less than ${CONSTANTS.MAX_USER_COMMENT_LINES} lines`))
            }
        
            //Find User
            User.findOne({_id: userId}).lean().then(result => {
                if (result) {
                    ImagePost.findOne({_id: {$eq: postId}}).lean().then(data => {
                        if (data) {
                            var comments = data.comments
                            async function findThreads(sentIndex) {
                                var objectId = new mongoose.Types.ObjectId()
                                console.log(objectId)
                                var commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], datePosted: Date.now()}
                                ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $push: { [`comments.${sentIndex}.commentReplies`]: commentForPost } }).then(function(){
                                    console.log("SUCCESS1")
                                    commentForPost.commentId = String(commentForPost.commentId)
                                    commentForPost.commenterId = String(commentForPost.commenterId)
                                    commentForPost.isOwner = true;
                                    return resolve(HTTPWTHandler.OK('Comment upload successful', commentForPost))
                                })
                                .catch(err => {
                                    console.error('An error occurred while adding comment:', commentForPost, 'to:', `"comments.${sentIndex}.commentReplies`, 'of image post with id:', postId, '. The error was:', err)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while adding comment. Please try again later.'))
                                });
                            }
                            var itemsProcessed = 0
                            comments.forEach(function (item, index) {
                                console.log(comments[index].commentId)
                                console.log(commentId)
                                if (comments[index].commentId == commentId) {
                                    if (itemsProcessed !== null) {
                                        console.log("Found at index:")
                                        console.log(index)
                                        findThreads(index)
                                        itemsProcessed = null
                                    }
                                } else {
                                    if (itemsProcessed !== null) {
                                        itemsProcessed++;
                                        if(itemsProcessed == comments.length) {
                                            return resolve(HTTPWTHandler.notFound('Could not find comment.'))
                                        }
                                    }
                                }
                            });
                        } else {
                            return resolve(HTTPWTHandler.notFound('The image post could not be found'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding one image post with id:', postId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding image post. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with userId provided'))
                } 
            })
            .catch(err => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            });
        })
    }

    static #getimagepostcomments = (userId, postId) => {
        return new Promise(resolve => {
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }
        
            if (postId.length == 0) {
                return HTTPHandler.badInput(res, 'postId cannot be an empty string.')
            }
        
            function sendResponse(nameSendBackObject) {
                console.log("Params Recieved")
                console.log(nameSendBackObject)
                const modifiedNameSendBackObject = nameSendBackObject.map(comment => ({...comment, commentId: String(comment.commentId)}))
                return resolve(HTTPWTHandler.OK('Comment search successful', modifiedNameSendBackObject))
            }
        
            ImagePost.findOne({_id: {$eq: postId}}).lean().then(data => {
                if (data) {
                    var nameSendBackObject = [];
                    var comments = data.comments;
                    if (comments.length == 0) {
                        return resolve(HTTPWTHandler.OK('Comment search successful', []))
                    } else {
                        const uniqueCommenters = Array.from(new Set(comments.map(comment => comment.commenterId)))

                        User.find({_id: {$in: uniqueCommenters}}).lean().then(users => {
                            const usersObject = {};

                            for (const user of users) {
                                usersObject[String(user._id)] = user;
                            }

                            for (const comment of comments) {
                                const commentCreator = usersObject[String(comment.commenterId)]
                                if (commentCreator) {
                                    //If user could be found
                                    const commentUpVotes = (comment.commentUpVotes.length - comment.commentDownVotes.length)
                                    let commentUpVoted = false
                                    if (comment.commentUpVotes.includes(userId)) {
                                        commentUpVoted = true
                                    }
                                    let commentDownVoted = false
                                    if (comment.commentDownVotes.includes(userId)) {
                                        commentDownVoted = true
                                    }
                                    nameSendBackObject.push({
                                        commentId: comment.commentId,
                                        commenterName: commentCreator.name,
                                        commenterDisplayName: commentCreator.displayName,
                                        commentText: comment.commentsText,
                                        commentUpVotes: commentUpVotes,
                                        commentReplies: comment.commentReplies.length,
                                        datePosted: comment.datePosted,
                                        profileImageKey: commentCreator.profileImageKey,
                                        commentUpVoted: commentUpVoted,
                                        commentDownVoted: commentDownVoted,
                                        isOwner: String(comment.commenterId) === String(userId)
                                    })
                                } else {
                                    console.error('A comment was found from user with id:', comment.commenterId, ' but the user with that id could not be found. This comment should be deleted immediately.')
                                }
                            }

                            sendResponse(nameSendBackObject)
                        }).catch(error => {
                            console.error('An error occurred while finding users in array:', uniqueCommenters, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding comment creators.'))
                        })
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound('Image post could not be found'))
                }
            })
            .catch(err => {
                console.error('An error occurred while finding image post with id:', postId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding image post. Please try again later.'))
            });
        })
    }

    static #upvoteimage = (userId, imageId) => {
        return new Promise(resolve => {
            if (typeof imageId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`imageId must be a string. Provided type: ${typeof imageId}`))
            }
        
            if (imageId.length == 0) {
                return resolve(HTTPWTHandler.badInput('imageId cannot be an empty string.'))
            }
        
            //Confirm User
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    ImagePost.findOne({_id: {$eq: imageId}}).lean().then(post => {
                        if (post) {
                            User.findOne({_id: post.creatorId}).lean().then(user => {
                                if (user) {
                                    if (user._id.toString() === userId) {
                                        return resolve(HTTPWTHandler.forbidden('You cannot upvote your own post.'))
                                    }

                                    if (user.privateAccount === true) {
                                        if (!user.followers.includes(result.secondId)) {
                                            return resolve(HTTPWTHandler.forbidden("You must be following this account to upvote the accounts' posts"))
                                        }
                                    }

                                    Upvote.findOne({postFormat: "Image", postId: {$eq: imageId}, userPublicId: result.secondId}).lean().then(upvoted => {
                                        Downvote.deleteMany({postFormat: "Image", postId: {$eq: imageId}, userPublicId: result.secondId}).then(function() {
                                            if (upvoted) {
                                                Upvote.deleteMany({postFormat: "Image", postId: {$eq: imageId}, userPublicId: result.secondId}).then(function() {
                                                    return resolve(HTTPWTHandler.OK('Post UpVote removed'))
                                                }).catch(error => {
                                                    console.error('An error occured while deleting all upvotes from user with public id:', result.secondId, ' for image post with id:', imageId, '. The error was:', error)
                                                    return resolve(HTTPWTHandler.serverError('An error occurred while upvoting image post. Please try again.'))
                                                })
                                            } else {
                                                const upvote = new Upvote({
                                                    postId: imageId,
                                                    userPublicId: result.secondId,
                                                    interactionDate: Date.now(),
                                                    postFormat: "Image"
                                                })
                
                                                upvote.save().then(() => {
                                                    return resolve(HTTPWTHandler.OK('Post UpVoted'))
                                                }).catch(error => {
                                                    console.error('An error occurred while user with public id:', result.secondId, ' tried to upvote image post with id:', imageId, '. The error was:', error)
                                                    return resolve(HTTPWTHandler.serverError('An error occurred while upvoting image post. Please try again.'))
                                                })
                                            }
                                        }).catch(error => {
                                            console.error('An error occurred while removing all downvotes from user with public id:', result.secondId, ' for image post with id:', imageId, '. The error was:', error)
                                            return resolve(HTTPWTHandler.serverError('An error occurred while upvoting image post. Please try again.'))
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while finding upvotes from user with public id:', result.secondId, ' for image post with id:', imageId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while upvoting image post. Please try again.'))
                                    })
                                } else {
                                    return resolve(HTTPWTHandler.notFound('Could not find post creator.'))
                                }
                            }).catch(error => {
                                console.error('An error occurred while finding user with id:', post.ceratorId, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding post creator. Please try again.'))
                            })
                        } else {
                            return resolve(HTTPWTHandler.notFound('Post not found'))
                        }
                    }).catch(error => {
                        console.log('An error occurred while finding image post with id:', imageId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while upvoting image post. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided id.'))
                }
            }).catch(error => {
                console.error('Error getting user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #downvoteimage = (userId, imageId) => {
        return new Promise(resolve => {
            if (typeof imageId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`imageId must be a string. Provided type: ${typeof imageId}`))
            }
        
            if (imageId.length == 0) {
                return resolve(HTTPWTHandler.badInput('imageId cannot be an empty string.'))
            }
        

            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    ImagePost.findOne({_id: {$eq: imageId}}).lean().then(post => {
                        if (post) {
                            User.findOne({_id: post.creatorId}).lean().then(user => {
                                if (user) {
                                    if (user._id.toString() === userId) {
                                        return resolve(HTTPWTHandler.forbidden('You cannot downvote your own post'))
                                    }

                                    if (user.privateAccount === true && !user.followers.includes(result.secondId)) {
                                        //If the post creator's account is private and if the user trying to downvote the post is not following the account
                                        return resolve(HTTPWTHandler.forbidden('You must be following this account before you can downvote the post'))
                                    }

                                    Downvote.findOne({postFormat: "Image", postId: {$eq: imageId}, userPublicId: result.secondId}).lean().then(downvoted => {
                                        Upvote.deleteMany({postFormat: "Image", postId: {$eq: imageId}, userPublicId: result.secondId}).then(function() {
                                            if (downvoted) {
                                                Downvote.deleteMany({postFormat: "Image", postId: {$eq: imageId}, userPublicId: result.secondId}).then(function() {
                                                    return resolve(HTTPWTHandler.OK('Post DownVote removed'))
                                                }).catch(error => {
                                                    console.error('An error occurred while deleting all downvotes from user with public id:', result.secondId, ' for image post with id:', imageId, '. The error was:', error)
                                                    return resolve(HTTPWTHandler.serverError('An error occurred while downvoting image post. Please try again.'))
                                                })
                                            } else {
                                                const downvote = new Downvote({
                                                    postId: imageId,
                                                    userPublicId: result.secondId,
                                                    interactionDate: Date.now(),
                                                    postFormat: "Image"
                                                })
                
                                                downvote.save().then(() => {
                                                    return resolve(HTTPWTHandler.OK('Post DownVoted'))
                                                }).catch(error => {
                                                    console.error('An error occurred while user with public id:', result.secondId, ' tried to downvote image post with id:', imageId, '. The error was:', error)
                                                    return resolve(HTTPWTHandler.serverError('An error occurred while downvoting image post. Please try again.'))
                                                })
                                            }
                                        }).catch(error => {
                                            console.error('An error occurred while removing all upvotes from user with public id:', result.secondId, ' for image post with id:', imageId, '. The error was:', error)
                                            return resolve(HTTPWTHandler.serverError('An error occurred while downvoting image post. Please try again.'))
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while finding downvotes from user with public id:', result.secondId, ' for image post with id:', imageId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while downvoting image post. Please try again.'))
                                    })
                                } else {
                                    return resolve(HTTPWTHandler.notFound('Could not find post creator'))
                                }
                            }).catch(error => {
                                console.error('An error occurred while finding user with id:', post.creatorId, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding post creator. Please try again.'))
                            })
                        } else {
                            return resolve(HTTPWTHandler.notFound('Image post could not be found'))
                        }
                    }).catch(error => {
                        console.log('An error occurred while finding image post with id:', imageId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while downvoting image post. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getsingleimagecomment = (userId, postId, commentId) => {
        return new Promise(resolve => {
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }

            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }

            if (postId.length === 0) {
                return resolve(HTTPWTHandler.badInput('postId cannot be an empty string'))
            }

            if (commentId.length === 0) {
                return resolve(HTTPWTHandler.badInput('commentId cannot be an empty string'))
            }
        
            function sendResponse(nameSendBackObject) {
                console.log("Params Recieved")
                console.log(nameSendBackObject)
                nameSendBackObject[0].commentId = String(nameSendBackObject.commentId)
                HTTPHandler.OK(res, 'Comment search successful', nameSendBackObject)
            }

            User.findOne({_id: {$eq: userId}}).lean().then(user => {
                if (!user) {
                    return resolve(HTTPWTHandler.notFound('User could not be found with provided userId'))
                }

                ImagePost.findOne({_id: {$eq: postId}}).then(data => {
                    if (data) {
                        var comments = data.comments
                        var nameSendBackObject = [];
                        if (comments.length == 0) {
                            return resolve(HTTPWTHandler.notFound('No comments'))
                        } else {
                            function forAwaits(index) {
                                const comment = comments[index]
                                User.findOne({_id: comment.commenterId}).lean().then(result => {
                                    if (result) {
                                        if (result.privateAccount === true && !result.followers.includes(user.secondId)) {
                                            return resolve(HTTPWTHandler.forbidden('You cannot get this comment because you are not following the account that made the post that this comment belongs to'))
                                        }
                                        
                                        var commentUpVotes = (comment.commentUpVotes.length - comment.commentDownVotes.length)
                                        var commentUpVoted = false
                                        if (comment.commentUpVotes.includes(sentUserId)) {
                                            commentUpVoted = true
                                        }
                                        var commentDownVoted = false
                                        if (comment.commentDownVotes.includes(sentUserId)) {
                                            commentDownVoted = true
                                        }
                                        nameSendBackObject.push({
                                            commentId: comment.commentId,
                                            commenterName: result.name,
                                            commenterDisplayName: result.displayName,
                                            commentText: comment.commentsText,
                                            commentUpVotes: commentUpVotes,
                                            commentDownVotes: comment.commentDownVotes,
                                            commentReplies: comment.commentReplies.length,
                                            datePosted: comment.datePosted,
                                            profileImageKey: result.profileImageKey,
                                            commentUpVoted: commentUpVoted,
                                            commentDownVoted: commentDownVoted,
                                            isOwner: String(comment.commenterId) === String(userId)
                                        })
                                        sendResponse(nameSendBackObject)
                                    } else {
                                        console.error('Found a comment from user with id:', comment.commenterId, 'but that user does not exist in the database. This comment with id:', comment.commentId, 'must be deleted from the database immediately.')
                                        return resolve(HTTPWTHandler.notFound("Couldn't find comment creator."))
                                    }
                                }).catch(error => {
                                    console.error('An error occurred while finding one user with id:', comment.commenterId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding comment creator. Please try again.'))
                                })
                            }
                            var itemsProcessed  = 0
                            comments.forEach(function (item, index) {
                                console.log(comments[index].commentId)
                                if (comments[index].commentId == commentId) {
                                    if (itemsProcessed !== null) {
                                        console.log("Found at index:")
                                        console.log(index)
                                        forAwaits(index)
                                        itemsProcessed = null
                                    }
                                } else {
                                    if (itemsProcessed !== null) {
                                        itemsProcessed++;
                                        if(itemsProcessed == comments.length) {
                                            return resolve(HTTPWTHandler.notFound("Couldn't find comment"))
                                        }
                                    }
                                }
                            });
                        }
                    } else {
                        return resolve(HTTPWTHandler.notFound('Could not find image post'))
                    }
                })
                .catch(err => {
                    console.error('An error occurred while finding image post with id:', postId, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding image post. Please try again.'))
                });
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #searchforimagecommentreplies = (userId, postId, commentId) => {
        return new Promise(resolve => {
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }

            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }

            if (postId.length === 0) {
                return resolve(HTTPWTHandler.badInput('postId cannot be an empty string'))
            }

            if (commentId.length === 0) {
                return resolve(HTTPWTHandler.badInput('commentId cannot be an empty string'))
            }
        

            function sendResponse(nameSendBackObject) {
                console.log("Params Recieved")
                console.log(nameSendBackObject)
                const modifiedNameSendBackObject = nameSendBackObject.map(comment => ({...comment, commentId: String(commentId)}))
                return resolve(HTTPWTHandler.OK('Comment search successful', modifiedNameSendBackObject))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.badInput('User could not be found with provided userId'))
                }

                ImagePost.findOne({_id: {$eq: postId}}).lean().then(data => {
                    if (data) {
                        User.findOne({_id: {$eq: data.creatorId}}).lean().then(creatorFound => {
                            if (!creatorFound) {
                                console.error('An image post was found with id:', data._id, 'that belongs to user with id:', data.creatorId, ' but that user does not exist in the database. This image post should be deleted immediately.')
                                return resolve(HTTPWTHandler.notFound('Could not find post creator'))
                            }

                            if (creatorFound.privateAccount === true && !creatorFound.followers.includes(userFoumd.secondId)) {
                                return resolve(HTTPWTHandler.forbidden("You cannot get comments from this post since you are not following the post creator's account"))
                            }

                            var nameSendBackObject = [];
                            var comments = data.comments;
                            if (comments.length == 0) {
                                return resolve(HTTPWTHandler.notFound('No comments.'))
                            } else {
                                function forAwaits(index) {
                                    var commentReplies = comments[index].commentReplies;
                                    if (commentReplies.length == 0) {
                                        return resolve(HTTPWTHandler.notFound('No replies could be found.'))
                                    } else {
                                        const uniqueUsers = Array.from(new Set(commentReplies.map(comment => comment.commenterId)))
                                        
                                        User.find({_id: {$in: uniqueUsers}}).lean().then(users => {
                                            const usersObject = {}
        
                                            users.forEach(user => {
                                                usersObject[String(user._id)] = user;
                                            })
        
                                            commentReplies.forEach(function (item, index) {
                                                const comment = commentReplies[index];
                                                const creator = usersObject[comment.commenterId]
                                                if (creator) {
                                                    var commentUpVotes = (comment.commentUpVotes.length - comment.commentDownVotes.length)
                                                    var commentUpVoted = false
                                                    if (comment.commentUpVotes.includes(userId)) {
                                                        commentUpVoted = true
                                                    }
                                                    var commentDownVoted = false
                                                    if (comment.commentDownVotes.includes(userId)) {
                                                        commentDownVoted = true
                                                    }
                                                    nameSendBackObject.push({
                                                        commentId: comment.commentId,
                                                        commenterName: creator.name,
                                                        commenterDisplayName: creator.displayName,
                                                        commentText: comment.commentsText,
                                                        commentUpVotes: commentUpVotes,
                                                        commentDownVotes: comment.commentDownVotes,
                                                        datePosted: comment.datePosted,
                                                        profileImageKey: creator.profileImageKey,
                                                        commentUpVoted: commentUpVoted,
                                                        commentDownVoted: commentDownVoted,
                                                        isOwner: String(comment.commenterId) === String(userId)
                                                    })
                                                } else {
                                                    console.error('A comment was found with id:', comment.commentId, 'that was from a user with id:', comment.commenterId, '. That user cannot be found in the database, and such this comment should be deleted immediately.')
                                                }
                                            })
        
                                            sendResponse(nameSendBackObject);
                                        }).catch(error => {
                                            console.error('An error occurred while finding users with ids in array:', uniqueUsers, '. The error was:', error)
                                            return resolve(HTTPWTHandler.serverError('An error occurred while finding comment creators. Please try again.'))
                                        })
                                    }
                                }
                                var itemsProcessed = 0
                                comments.forEach(function (item, index) {
                                    console.log(comments[index].commentId)
                                    if (comments[index].commentId == sentCommentId) {
                                        if (itemsProcessed !== null) {
                                            console.log("Found at index:")
                                            console.log(index)
                                            forAwaits(index)
                                            itemsProcessed = null
                                        }
                                    } else {
                                        if (itemsProcessed !== null) {
                                            itemsProcessed++;
                                            if(itemsProcessed == comments.length) {
                                                return resolve(HTTPWTHandler.notFound("Couldn't find comment"))
                                            }
                                        }
                                    }
                                });
                            }
                        }).catch(error => {
                            console.error('An error occurred while finding user with id:', data.creatorId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('Could not find image post.'))
                    }
                })
                .catch(err => {
                    console.error('An error occurred while finding image with id:', postId, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding image post. Please try again.'))
                });
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #postcategorywithimage = (userId, categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, sentAllowScreenShots, file) => {
        return new Promise(resolve => {
            if (!file) {
                return resolve(HTTPWTHandler.badInput('No file sent.'))
            }
        
            const deleteFile = () => {
                imageHandler.deleteMulterTempImage(file.filename)
            }
        
            if (typeof categoryTitle !== 'string') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`categoryTitle must be a string. Provided type: ${typeof categoryTitle}`))
            }
        
            if (typeof categoryDescription !== 'string') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`categoryDescription must be a string. Provided type: ${typeof categoryDescription}`))
            }
        
            if (typeof categoryTags !== 'string') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`categoryTags must be a string. Provided type: ${typeof categoryTags}`))
            }
        
            if (typeof categoryNSFW !== 'boolean' && categoryNSFW !== 'false' && categoryNSFW !== 'true') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`categoryNSFW must be a boolean, "false", or "true"`))
            }
        
            if (typeof categoryNSFL !== 'boolean' && categoryNSFL !== 'false' && categoryNSFW !== 'true') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`categoryNSFL must be a boolean, "false", or "true"`))
            }
        
            if (typeof sentAllowScreenShots !== 'boolean' && sentAllowScreenShots !== 'false' && sentAllowScreenShots !== 'true') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`sentAllowScreenShots must be a boolean, "false", or "true"`))
            }
        
            if (categoryNSFW === "false") {
                categoryNSFW = false;
            }
        
            if (categoryNSFW === "true") {
                categoryNSFW = true;
            }
        
            if (categoryNSFL === "false") {
                categoryNSFL = false;
            }
        
            if (categoryNSFL === "true") {
                categoryNSFL = true;
            }
        
            if (sentAllowScreenShots === "false") {
                sentAllowScreenShots = false;
            }
            
            if (sentAllowScreenShots === "true") {
                sentAllowScreenShots = true;
            }
        
            categoryTitle = categoryTitle.trim()
            categoryDescription = categoryDescription.trim()
        
            if (categoryTitle.length == 0) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput('categoryTitle must not be an empty string.'))
            }
        
            if (categoryDescription.length == 0) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput('categoryDescription must not be an empty string.'))
            }
        
            if (categoryTitle.length > CONSTANTS.MAX_CATEGORY_TITLE_LENGTH) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`categoryTitle cannot be more than ${CONSTANTS.MAX_CATEGORY_TITLE_LENGTH} characters long.`))
            }
        
            if (categoryDescription.length > CONSTANTS.MAX_CATEGORY_DESCRIPTION_LENGTH) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`categoryDescription cannot be more than ${CONSTANTS.MAX_CATEGORY_DESCRIPTION_LENGTH} characters long.`))
            }

            if (!CONSTANTS.VALID_CATEGORY_TITLE_TEST.test(categoryTitle)) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(CONSTANTS.CATEGORY_TITLE_FAILED_TEST_ERROR_MESSAGE))
            }

            if (!CONSTANTS.VALID_CATEGORY_DESCRIPTION_TEST.test(categoryDescription)) {
                deleteFile();
                return resolve(HTTPWTHandler.badInput(`categoryDescription must have less than ${CONSTANTS.MAX_CATEGORY_DESCRIPTION_LINES} lines.`))
            }
        
            console.log('File has been recieved: ', file.filename)
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Category.findOne({categoryTitle: {'$regex': `^${categoryTitle}$`, $options: 'i'}}).lean().then(categoryFound => {
                        if (!categoryFound) { // category title not already used so allow it
                            imageHandler.compressImage(file.filename).then(imageKey => {
                                const newCategoryObject = {
                                    imageKey,
                                    categoryTitle: categoryTitle, 
                                    categoryDescription: categoryDescription,
                                    categoryTags: categoryTags,
                                    members: [userId],
                                    NSFW: categoryNSFW,
                                    NSFL: categoryNSFL,
                                    categoryOwnerId: userId,
                                    categoryOriginalCreator: userId,
                                    categoryModeratorIds: [],
                                    datePosted: Date.now(),
                                    allowScreenShots: allowScreenShots
                                };

                                const newCategory = new Category(newCategoryObject);
        
                                newCategory.save().then(() => {
                                    return resolve(HTTPWTHandler.OK('Creation successful'))
                                })
                                .catch(err => {
                                    imageHandler.deleteImageByKey(imageKey)
                                    console.error('An error occurred while saving new category with newCategoryObject:', newCategoryObject, '. The error was:', err)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while saving category. Please try again.'))
                                })
                            }).catch(error => {
                                console.error('An error was thrown from ImageLibrary.compressImage while compressing image with filename:', file.filename, '. The error was:', error)
                                deleteFile()
                                return resolve(HTTPWTHandler.serverError('Failed to compress image. Please try again.'))
                            })
                        } else {
                            deleteFile()
                            return resolve(HTTPWTHandler.conflict('A category with the chosen title already exists.'))
                        }   
                    }).catch(error => {
                        deleteFile()
                        console.error('An error occured while seeing if a category title already exists or not. The title to be checked was:', categoryTitle, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError("An error occurred while checking if a category already has your desired category's title. Please try again."))
                    })
                } else {
                    deleteFile()
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                deleteFile()
                console.error('An error occured while finding user with id: ', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #deleteimage = (userId, imageId) => {
        return new Promise(resolve => {
            if (typeof imageId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`imageId must be a string. Provided type: ${typeof imageId}`))
            }
        
            if (imageId.length == 0) {
                return resolve(HTTPWTHandler.badInput('imageId cannot be an empty string'))
            }
        
            //Confirm User
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    //User exists
                    ImagePost.findOne({_id: {$eq: imageId}}).lean().then(data => {
                        var findUser = data
                        if (findUser.creatorId.toString() === userId) {
                            ImagePost.deleteOne({_id: {$eq: imageId}}).then(function(){
                                Upvote.deleteMany({postId: {$eq: imageId}, postFormat: "Image"}).catch(error => {
                                    console.error('An error occured while deleting all upvotes for post with id:', imageId)
                                })
                                Downvote.deleteMany({postId: {$eq: imageId}, postFormat: "Image"}).catch(error => {
                                    console.error('An error occured while deleting all downvotes for post with id:', imageId)
                                })

                                imageHandler.deleteImageByKey(data.imageKey)

                                Promise.all([
                                    Upvote.deleteMany({postId: {$eq: imageId}, postFormat: "Image"}),
                                    Downvote.deleteMany({postId: {$eq: imageId}, postFormat: "Image"})
                                ]).then(() => {
                                    console.log('Upvotes and downvotes were successfully deleted for image post with id:', imageId)
                                }).catch(error => {
                                    console.error('An error occurred while removing upvotes and downvotes for image post with id:', imageId, '. The error was:', error)
                                }).finally(() => {
                                    return resolve(HTTPWTHandler.OK('Post was successfully deleted.'))
                                })
                            }).catch(err => {
                                console.error('An error occurred while deleting image post with id:', imageId, '. The error was:', err)
                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting image post. Please try again later.'))
                            });
                        } else {
                            return resolve(HTTPWTHandler.forbidden('This is not your image post. You cannot delete it.'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding image post with id:', imageId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting image post. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.badInput('Could not find user with your id'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #postcategorywithoutimage = (userId, categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, sentAllowScreenShots) => {
        return new Promise(resolve => {
            if (typeof categoryTitle !== 'string') {
                return resolve(HTTPWTHandler.badInput(`categoryTitle must be a string. Provided type: ${typeof categoryTitle}`))
            }
            
            if (typeof categoryDescription !== 'string') {
                return resolve(HTTPWTHandler.badInput(`categoryDescription must be a string. Provided type: ${typeof categoryDescription}`))
            }
        
            if (typeof categoryTags !== 'string') {
                return resolve(HTTPWTHandler.badInput(`categoryTags must be a string. Provided type: ${typeof categoryTags}`))
            }
        
            if (typeof categoryNSFW !== 'boolean' && categoryNSFW !== "false" && categoryNSFW !== "true") {
                return resolve(HTTPWTHandler.badInput('categoryNSFW must either be a boolean, "false", or "true"'))
            }
            
            if (typeof categoryNSFL !== 'boolean' && categoryNSFL !== "false" && categoryNSFL !== "true") {
                return resolve(HTTPWTHandler.badInput('categoryNSFL must either be a boolean, "false" or "true"'))
            }
        
            if (typeof sentAllowScreenShots !== 'boolean' && sentAllowScreenShots !== "false" && sentAllowScreenShots !== "true") {
                return resolve(HTTPWTHandler.badInput('sentAllowScreenShots must either be a boolean, "false" or "true"'))
            }
        
            if (categoryNSFW === "false") {
                categoryNSFW = false;
            }
        
            if (categoryNSFW === "true") {
                categoryNSFW = true;
            }
        
            if (categoryNSFL === "false") {
                categoryNSFL = false;
            }
        
            if (categoryNSFL === "true") {
                categoryNSFL = true;
            }
        
            if (sentAllowScreenShots === "false") {
                sentAllowScreenShots = false;
            }
            
            if (sentAllowScreenShots === "true") {
                sentAllowScreenShots = true;
            }
        
            categoryTitle = categoryTitle.trim()
            categoryDescription = categoryDescription.trim()
        
            if (categoryTitle.length == 0) {
                return resolve(HTTPWTHandler.badInput('categoryTitle must not be blank'))
            }
        
            if (categoryDescription.length == 0) {
                return resolve(HTTPWTHandler.badInput('categoryDescription must not be blank'))
            }
        
            if (categoryTitle.length > CONSTANTS.MAX_CATEGORY_TITLE_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`categoryTitle cannot be more than ${CONSTANTS.MAX_CATEGORY_TITLE_LENGTH} characters long.`))
            }
        
            if (categoryDescription.length > CONSTANTS.MAX_CATEGORY_DESCRIPTION_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`categoryDescription cannot be more than ${CONSTANTS.MAX_CATEGORY_DESCRIPTION_LENGTH} characters long.`))
            }

            if (!CONSTANTS.VALID_CATEGORY_TITLE_TEST.test(categoryTitle)) {
                return resolve(HTTPWTHandler.badInput(CONSTANTS.CATEGORY_TITLE_FAILED_TEST_ERROR_MESSAGE))
            }

            if (!CONSTANTS.VALID_CATEGORY_DESCRIPTION_TEST.test(categoryDescription)) {
                return resolve(HTTPWTHandler.badInput(`categoryDescription must have less than ${CONSTANTS.MAX_CATEGORY_DESCRIPTION_LINES} lines.`))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Category.findOne({categoryTitle: {'$regex': `^${categoryTitle}$`, $options: 'i'}}).lean().then(categoryFound => {
                        if (!categoryFound) { // category title not already used so allow it
                            const newCategoryObject = {
                                imageKey: "",
                                categoryTitle: categoryTitle, 
                                categoryDescription: categoryDescription,
                                categoryTags: categoryTags,
                                members: [userId],
                                NSFW: categoryNSFW,
                                NSFL: categoryNSFL,
                                categoryOwnerId: userId,
                                categoryOriginalCreator: userId,
                                categoryModeratorIds: [],
                                datePosted: Date.now(),
                                allowScreenShots: sentAllowScreenShots
                            }
        
                            const newCategory = new Category(newCategoryObject);
        
                            newCategory.save().then(result => {
                                return resolve(HTTPWTHandler.OK('Creation successful'))
                            })
                            .catch(err => {
                                console.error('An error occurred while saving new category with newCategoryObject:', newCategoryObject, '. The error was:', err)
                                return resolve(HTTPWTHandler.serverError('An error occurred while saving category. Please try again.'))
                            })
                        } else {
                            return resolve(HTTPWTHandler.conflict('A category with this name already exists.'))
                        }   
                    }).catch(error => {
                        console.error("An error occurred while doing regex ^categoryTitle with $options: 'i'. Category title was:", categoryTitle, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while checking if a category already exists with your desired category title. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #searchpagesearchcategories = (userId, val, lastCategoryId) => {
        return new Promise(resolve => {
            if (typeof val !== 'string') {
                return resolve(HTTPWTHandler.badInput(`val must be a string. Provided type: ${typeof val}`))
            }
        
            if (val.length == 0) {
                return resolve(HTTPWTHandler.badInput('Search box cannot be empty!'))
            }

            if (lastCategoryId !== undefined && typeof lastCategoryId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`lastCategoryId must be undefined or a string. Provided type: ${typeof lastCategoryId}`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }

                const dbQuery = {
                    categoryTitle: {$regex: `^${val}`, $options: 'i'}
                }

                if (lastCategoryId !== undefined) {
                    dbQuery._id = {$lt: new mongoose.Types.ObjectId(lastCategoryId)}
                }

                Category.find(dbQuery).sort({_id: -1}).limit(CONSTANTS.NUM_CATEGORIES_TO_SEND_PER_API_CALL).lean().then(data => {
                    const categories = data.map(category => {
                        return {
                            categoryTitle: category.categoryTitle,
                            categoryDescription: category.categoryDescription,
                            members: category.members.length,
                            categoryTags: category.categoryTags,
                            imageKey: category.imageKey,
                            NSFW: category.NSFW,
                            NSFL: category.NSFL,
                            datePosted: category.datePosted,
                            allowScreenShots: category.allowScreenShots,
                            categoryId: String(category._id)
                        }
                    })

                    const toSend = {
                        categories,
                        noMoreCategories: data.length < CONSTANTS.NUM_CATEGORIES_TO_SEND_PER_API_CALL
                    }

                    return resolve(HTTPWTHandler.OK('Search successful', toSend))
                }).catch(error => {
                    console.error('An error occurred while finding category with dbQuery:', dbQuery, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding categories. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getcategoryimage = (val) => {
        return new Promise(resolve => {
            if (typeof val !== 'string') {
                return resolve(HTTPWTHandler.badInput(`val must be a string. Provided type: ${typeof val}`))
            }
        
            if (val.length == 0) {
                return resolve(HTTPWTHandler.badInput('val cannot be an empty string.'))
            }
        
            Category.findOne({categoryTitle: {$eq: val}}).lean().then(data =>{
                if (data) {
                    var categoryImageKey = data.imageKey
                    console.log(categoryImageKey)
                    if (categoryImageKey !== "") {
                        return resolve(HTTPWTHandler.OK('Category image found.', categoryImageKey))
                    } else {
                        return resolve(HTTPWTHandler.notFound('No category image.'))
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound('Category could not be found'))
                }
            }).catch(error => {
                console.error('An error occurred while finding category with categoryTitle:', val, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding category. Please try again.'))
            })
        })
    }

    static #findcategorybyid = (userId, categoryId) => {
        return new Promise(resolve => {
            if (typeof categoryId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`categoryId must be a string. Provided type: ${typeof categoryId}`))
            }

            if (categoryId.length === 0) {
                return resolve(HTTPWTHandler.badInput('categoryId cannot be an empty string'))
            }
        
            //Find Category
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }

                Category.findOne({_id: {$eq: categoryId}}).lean().then(data =>{
                    if (data) {
                        let modPerms = false
                        let ownerPerms = false
                        let inCategory = false
                        if (data.categoryModeratorIds.includes(userId)) {
                            modPerms = true
                            ownerPerms = false
                        }
                        if (data.categoryOwnerId == userId) {
                            modPerms = true
                            ownerPerms = true
                        }
                        if (data.members.includes(userId)) {
                            inCategory = true
                        }
                        
                        const categoryData = {
                            categoryTitle: data.categoryTitle,
                            categoryDescription: data.categoryDescription,
                            members: data.members.length,
                            categoryTags: data.categoryTags,
                            imageKey: data.imageKey,
                            NSFW: data.NSFW,
                            NSFL: data.NSFL,
                            datePosted: data.datePosted,
                            modPerms: modPerms,
                            ownerPerms: ownerPerms,
                            inCategory: inCategory,
                            allowScreenShots: data.allowScreenShots,
                            categoryId: String(data._id)
                        }

                        return resolve(HTTPWTHandler.OK('Search successful', categoryData))
                    } else {
                        return resolve(HTTPWTHandler.notFound('Could not find category with that id.'))
                    }
                }).catch(err => {
                    console.error('An error occurred while finding category with id:', categoryId, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding category'))
                });
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #findcategoryfromprofile = (userId, pubId, previousCategoryId) => {
        return new Promise(resolve => {
            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Provided type: ${typeof pubId}`))
            }
        
            if (pubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string.'))
            }

            if (typeof previousCategoryId !== 'string' && previousCategoryId !== undefined) {
                return resolve(HTTPWTHandler.badInput(`previousCategoryId must be a string or undefined. Type provided: ${typeof previousCategoryId}`))
            }

            if (previousCategoryId?.length === 0) {
                return resolve(HTTPWTHandler.badInput('previousCategoryId cannot be an empty string.'))
            }
        
            function sendResponse(foundCategories) {
                console.log("Params Recieved")
                console.log(foundCategories)
                return resolve(HTTPWTHandler.OK('Categories search successful', {categories: foundCategories, noMoreCategories: foundCategories.length < CONSTANTS.NUM_CATEGORIES_TO_SEND_PER_API_CALL}))
            }

            //Find Categories
            var foundCategories = [];
            var itemsProcessed = 0;
            
            User.findOne({secondId: {$eq: pubId}}).lean().then(result => {
                if (result) {
                    User.findOne({_id: {$eq: userId}}).lean().then(userRequestingCategories => {
                        if (!userRequestingCategories || result.blockedAccounts?.includes(userRequestingCategories.secondId)) {
                            return resolve(HTTPWTHandler.notFound('User could not be found.'))
                        }

                        if (result.privateAccount && result.secondId !== userRequestingCategories.secondId && !result.followers.includes(userRequestingCategories.secondId)) {
                            return resolve(HTTPWTHandler.forbidden('You must be following this account to see what categories they belong too.'))
                        }

                        var profilesId = result._id
                        console.log("profilesId:")
                        console.log(profilesId)

                        const dbQuery = {
                            members: {$elemMatch: {$eq: String(profilesId)}}
                        }

                        if (previousCategoryId) {
                            dbQuery._id = {$lt: previousCategoryId}
                        }

                        Category.find(dbQuery).sort({_id: -1}).limit(CONSTANTS.NUM_CATEGORIES_TO_SEND_PER_API_CALL).lean().then(data =>{
                            console.log("Found categories")
                            console.log(data)
                            if (data.length) {
                                data.forEach(function (item, index) {
                                    foundCategories.push({
                                        categoryTitle: data[index].categoryTitle,
                                        categoryDescription: data[index].categoryDescription,
                                        members: data[index].members.length,
                                        categoryTags: data[index].categoryTags,
                                        imageKey: data[index].imageKey,
                                        NSFW: data[index].NSFW,
                                        NSFL: data[index].NSFL,
                                        datePosted: data[index].datePosted,
                                        inCategory: true,
                                        allowScreenShots: data[index].allowScreenShots,
                                        categoryId: String(data[index]._id)
                                    })
                                    itemsProcessed++;
                                    if(itemsProcessed === data.length) {
                                        sendResponse(foundCategories);
                                    }
                                })
                            } else {
                                return resolve(HTTPWTHandler.OK('No more categories could be found', {categories: [], noMoreCategories: true}))
                            }
                        })
                        .catch(err => {
                            console.error('An error occurred while finding categories where:', profilesId, 'is in members. The error was:', err)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding categories. Please try again.'))
                        });
                    }).catch(error => {
                        console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An erorr occurred while finding user with secondId:', pubId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #joincategory = (userId, categoryId) => {
        return new Promise(resolve => {
            if (typeof categoryId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`categoryId must be a string. Provided type: ${typeof categoryId}`))
            }
        
            if (categoryId.length == 0) {
                return resolve(HTTPWTHandler.badInput('categoryId must not be an empty string.'))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Category.findOne({_id: {$eq: categoryId}}).lean().then(data => {
                        if (data) {
                            if (data.members.includes(userId)) {
                                Category.findOneAndUpdate({_id: {$eq: categoryId}}, { $pull: { members : userId }}).then(function(){
                                    console.log("SUCCESS1")
                                    return resolve(HTTPWTHandler.OK('Left Category'))
                                }).catch(error => {
                                    console.error('An error occurred while pulling:', userId, 'from members for category with id:', categoryId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while removing you from the category. Please try again.'))
                                })
                            } else {
                                //Not in the category yet
                                Category.findOneAndUpdate({_id: {$eq: categoryId}}, { $addToSet: { members : userId }}).then(function(){
                                    console.log("SUCCESS1")
                                    return resolve(HTTPWTHandler.OK('Joined Category'))
                                }).catch(error => {
                                    console.error('An error occurred while using $addToSet to add:', userId, 'to the members array for category with id:', categoryId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while adding you to the category. Please try again.'))
                                })
                            }
                        } else {
                            return resolve(HTTPWTHandler.notFound('Could not find category'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding category with categoryId:', categoryId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding cateogry. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #posttextthread = (userId, threadTitle, threadSubtitle, threadTags, threadCategoryId, threadBody, threadNSFW, threadNSFL, sentAllowScreenShots) => {
        return new Promise(resolve => {
            if (typeof threadTitle !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadTitle must be a string. Provided type: ${typeof threadTitle}`))
            }
        
            if (typeof threadSubtitle !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadSubtitle must be a string. Provided type: ${typeof threadSubtitle}`))
            }
        
            if (typeof threadTags !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadTags must be a string. Provided type: ${typeof threadTags}`))
            }
        
            if (typeof threadCategoryId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadCategoryId must be a string. Provided type: ${typeof threadCategoryId}`))
            }
        
            if (typeof threadBody !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadBody must be a string. Provided type: ${typeof threadBody}`))
            }
        
            if (typeof threadNSFW !== 'boolean' && threadNSFW !== "false" && threadNSFW !== "true") {
                return resolve(HTTPWTHandler.badInput('threadNSFW must either be a boolean, "false", or "true"'))
            }
        
            if (typeof threadNSFL !== 'boolean' && threadNSFL !== "false" && threadNSFL !== "true") {
                return resolve(HTTPWTHandler.badInput('threadNSFL must either be a boolean, "false", or "true"'))
            }
        
            if (typeof sentAllowScreenShots !== 'boolean' && sentAllowScreenShots !== "false" && sentAllowScreenShots !== "true") {
                return resolve(HTTPWTHandler.badInput('sentAllowScreenShots must either be a boolean, "false", or "true"'))
            }
        
            if (threadNSFW === "false") {
                threadNSFW = false;
            }
        
            if (threadNSFL === "true") {
                threadNSFW = true;
            }
        
            if (threadNSFL === "false") {
                threadNSFL = false;
            }
        
            if (threadNSFL === "true") {
                threadNSFL = true;
            }
        
            if (sentAllowScreenShots === "false") {
                sentAllowScreenShots = false;
            }
        
            if (sentAllowScreenShots === "true") {
                sentAllowScreenShots = true;
            }
        
            threadBody = threadBody.trim();
            threadTitle = threadTitle.trim();
            threadSubtitle = threadSubtitle.trim();
            threadTags = threadTags.trim();
        
            if (threadTitle.length > CONSTANTS.MAX_THREAD_TITLE_LENGTH || threadTitle.length == 0) {
                return resolve(HTTPWTHandler.badInput(`threadTitle must be between 1 and ${CONSTANTS.MAX_THREAD_TITLE_LENGTH} characters long.`))
            }

            if (!CONSTANTS.VALID_THREAD_TITLE_TEST.test(threadTitle)) {
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_TITLE_FAILED_TEST_ERROR_MESSAGE))
            }
        
            if (threadSubtitle.length > CONSTANTS.MAX_THREAD_SUBTITLE_LENGTH || threadSubtitle.length == 0) {
                return resolve(HTTPWTHandler.badInput(`threadSubtitle must be between 1 and ${CONSTANTS.MAX_THREAD_SUBTITLE_LENGTH} characters long.`))
            }

            if (!CONSTANTS.VALID_THREAD_SUBTITLE_TEST.test(threadSubtitle)) {
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_SUBTITLE_FAILED_TEST_ERROR_MESSAGE))
            }
        
            if (threadBody.length > CONSTANTS.MAX_THREAD_BODY_LENGTH || threadBody.length == 0) {
                return resolve(HTTPWTHandler.badInput(`threadBody must be between 1 and ${CONSTANTS.MAX_THREAD_BODY_LENGTH} characters long`))
            }

            if (!CONSTANTS.VALID_THREAD_BODY_TEST.test(threadBody)) {
                return resolve(HTTPWTHandler.badInput(`threadBody must have less than ${CONSTANTS.MAX_THREAD_BODY_LINES} lines.`))
            }
        
            if (threadTags.length > CONSTANTS.MAX_THREAD_TAGS_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`threadTags must not be longer than ${CONSTANTS.MAX_THREAD_TAGS_LENGTH} characters`))
            }

            if (!CONSTANTS.VALID_THREAD_TAGS_TEST.test(threadTags)) {
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_TAGS_FAILED_TEST_ERROR_MESSAGE))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Category.findOne({_id: {$eq: threadCategoryId}}).then(data => {
                        if (data) {
                            const categoryNSFW = data.NSFW;
                            const categoryNSFL = data.NSFL;
        
                            if (threadNSFW && !categoryNSFW && !categoryNSFL) {
                                return resolve(HTTPWTHandler.forbidden('NSFW thread posts cannot be posted in non-NSFW categories.'))
                            }
        
                            if (threadNSFL && !categoryNSFL) {
                                return resolve(HTTPWTHandler.forbidden('NSFL thread posts cannot be posted in non-NSFL categories.'))
                            }
        
                            //allowScreenShots set up
                            const allowScreenShots = data.allowScreenShots ? sentAllowScreenShots : false;
                            console.log(`allowScreenShots ${allowScreenShots}`)

                            const newThreadObject = {
                                threadType: "Text",
                                comments: [],
                                creatorId: userId,
                                threadTitle: threadTitle,
                                threadSubtitle: threadSubtitle,
                                threadTags: threadTags,
                                threadCategoryId: threadCategoryId,
                                threadBody: threadBody,
                                threadImageKey: "",
                                threadImageDescription: "",
                                threadNSFW: threadNSFW,
                                threadNSFL: threadNSFL,
                                datePosted: Date.now(),
                                allowScreenShots: allowScreenShots
                            };

                            const newThread = new Thread(newThreadObject);
        
                            newThread.save().then(() => {
                                return resolve(HTTPWTHandler.OK('Creation successful'))
                            })
                            .catch(err => {
                                console.error('An error occurred while saving new thread with newThreadObject:', newThreadObject, '. The error was:', err)
                                return resolve(HTTPWTHandler.serverError('An error occurred while saving thread. Please try again.'))
                            })
                        } else {
                            return resolve(HTTPWTHandler.notFound('No category found!'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding category with id:', threadCategoryId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding category. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #postimagethread = (userId, threadTitle, threadSubtitle, threadTags, threadCategoryId, threadImageDescription, threadNSFW, threadNSFL, sentAllowScreenShots, file) => {
        return new Promise(resolve => {
            if (!file) {
                return resolve(HTTPWTHandler.badInput('No file sent.'))
            }
        
            const deleteImage = () => {
                imageHandler.deleteMulterTempImage(file.filename)
            }
        
            if (typeof threadTitle !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`threadTitle must be a string. Provided type: ${typeof threadTitle}`))
            }
        
            if (typeof threadSubtitle !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`threadSubtitle must be a string. Provided type: ${typeof threadSubtitle}`))
            }
        
            if (typeof threadTags !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`threadTags must be a string. Provided type: ${typeof threadTags}`))
            }
        
            if (typeof threadCategoryId !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`threadCategoryId must be a string. Provided type: ${typeof threadCategoryId}`))
            }
        
            if (typeof threadImageDescription !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`threadImageDescription must be a string. Provided type: ${typeof threadImageDescription}`))
            }
        
            if (typeof threadNSFW !== 'boolean' && threadNSFW !== "false" && threadNSFW !== "true") {
                deleteImage()
                return resolve(HTTPWTHandler.badInput('threadNSFW must either be a boolean, "false", or "true"'))
            }
        
            if (typeof threadNSFL !== 'boolean' && threadNSFL !== "false" && threadNSFL !== "true") {
                deleteImage()
                return resolve(HTTPWTHandler.badInput('threadNSFL must either be a boolean, "false", or "true"'))
            }
        
            if (typeof sentAllowScreenShots !== 'boolean' && sentAllowScreenShots !== "false" && sentAllowScreenShots !== "true") {
                deleteImage()
                return resolve(HTTPWTHandler.badInput('sentAllowScreenShots must either be a boolean, "false", or "true"'))
            }
        
            if (threadNSFW === "false") {
                threadNSFW = false
            }
        
            if (threadNSFW === "true") {
                threadNSFW = true
            }
        
            if (threadNSFL === "false") {
                threadNSFL = false
            }
        
            if (threadNSFL === "true") {
                threadNSFL = true
            }
        
            if (sentAllowScreenShots === "false") {
                sentAllowScreenShots = false
            }
        
            if (sentAllowScreenShots === "true") {
                sentAllowScreenShots = true
            }
        
            threadTitle = threadTitle.trim();
            threadSubtitle = threadSubtitle.trim();
            threadTags = threadTags.trim();
            threadCategoryId = threadCategoryId.trim();
            threadImageDescription = threadImageDescription.trim();
        
            if (threadTitle.length > CONSTANTS.MAX_THREAD_TITLE_LENGTH || threadTitle.length == 0) {
                deleteImage()
                return HTTPHandler.badInput(res, `threadTitle must be between 1 and ${CONSTANTS.MAX_THREAD_TITLE_LENGTH} characters long.`)
            }

            if (!CONSTANTS.VALID_THREAD_TITLE_TEST.test(threadTitle)) {
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_TITLE_FAILED_TEST_ERROR_MESSAGE))
            }
        
            if (threadSubtitle.length > CONSTANTS.MAX_THREAD_SUBTITLE_LENGTH || threadSubtitle.length == 0) {
                deleteImage()
                return HTTPHandler.badInput(res, `threadSubtitle must be between 1 and ${CONSTANTS.MAX_THREAD_SUBTITLE_LENGTH} characters long.`)
            }

            if (!CONSTANTS.VALID_THREAD_SUBTITLE_TEST.test(threadSubtitle)) {
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_SUBTITLE_FAILED_TEST_ERROR_MESSAGE))
            }
        
            if (threadTags.length > CONSTANTS.MAX_THREAD_TAGS_LENGTH) {
                deleteImage()
                return HTTPHandler.badInput(res, `threadTags must not be longer than ${CONSTANTS.MAX_THREAD_TAGS_LENGTH} characters`)
            }

            if (!CONSTANTS.VALID_THREAD_TAGS_TEST.test(threadTags)) {
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_TAGS_FAILED_TEST_ERROR_MESSAGE))
            }
        
            if (threadImageDescription.length > CONSTANTS.MAX_THREAD_IMAGE_DESCRIPTION_LENGTH || threadImageDescription.length == 0) {
                deleteImage()
                return HTTPHandler.badInput(res, `threadImageDescription must be between 1 and ${CONSTANTS.MAX_THREAD_IMAGE_DESCRIPTION_LENGTH} characters long`)
            }

            if (!CONSTANTS.VALID_THREAD_IMAGE_DESCRIPTION_TEST.test(threadImageDescription)) {
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_IMAGE_DESCRIPTION_FAILED_TEST_ERROR_MESSAGE))
            }
        
            console.log('File has been recieved: ', file.filename)
            console.log(userId)
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Category.findOne({_id: {$eq: threadCategoryId}}).lean().then(data => {
                        if (data) {
                            const categoryNSFW = data.NSFW;
                            const categoryNSFL = data.NSFL;
        
                            if (threadNSFW && !categoryNSFW && !categoryNSFL) {
                                deleteImage()
                                return resolve(HTTPWTHandler.forbidden('NSFW thread posts cannot be posted in non-NSFW categories.'))
                            }
        
                            if (threadNSFL && !categoryNSFL) {
                                deleteImage()
                                return resolve(HTTPWTHandler.forbidden('NSFL thread posts cannot be posted in non-NSFL categories.'))
                            }
        
                            imageHandler.compressImage(file.filename).then(imageKey => {
                                const newThreadObject = {
                                    threadType: "Images",
                                    comments: [],
                                    creatorId: creatorId,
                                    threadTitle: threadTitle,
                                    threadSubtitle: threadSubtitle,
                                    threadTags: threadTags,
                                    threadCategoryId: threadCategoryId,
                                    threadBody: "",
                                    threadImageKey: imageKey,
                                    threadImageDescription: threadImageDescription,
                                    threadNSFW: threadNSFW,
                                    threadNSFL: threadNSFL,
                                    datePosted: Date.now(),
                                    allowScreenShots: sentAllowScreenShots
                                };

                                const newThread = new Thread(newThreadObject);
        
                                newThread.save().then(() => {
                                    return resolve(HTTPWTHandler.OK('Creation successful'))
                                })
                                .catch(err => {
                                    imageHandler.deleteImageByKey(imageKey)
                                    console.error('An error occurred while saving a new thread post with an image with newThreadObject:', newThreadObject, 'to the database:', err)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while saving image thread. Please try again.'))
                                })
                            }).catch(error => {
                                console.error('An error was thrown from ImageLibrary.compressImage while compressing image with filename:', file.filename, '. The error was:', error)
                                deleteImage()
                                return resolve(HTTPWTHandler.serverError('Failed to compress image'))
                            })
                        } else {
                            deleteImage()
                            return resolve(HTTPWTHandler.notFound('Category could not be found'))
                        }
                    }).catch(error => {
                        deleteImage()
                        console.error('An error occured while finding category with id:', threadCategoryId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding thread. Please try again.'))
                    })
                } else {
                    deleteImage()
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                deleteImage()
                console.error('An error occurred while finding user with ID: ', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getthreadsfromcategory = (userId, categoryId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userRequesting => {
                if (userRequesting) {
                    Category.findOne({_id: {$eq: categoryId}}).lean().then(data =>{ 
                        if (data) {
                            Thread.find({threadCategoryId: {$eq: categoryId}}).lean().then(result => {
                                if (result) {
                                    const uniqueUsers = Array.from(new Set(result.map(item => item.creatorId)))

                                    User.find({_id: {$in: uniqueUsers}}).lean().then(users => {
                                        const usersFound = Array.from(new Set(users.map(user => String(user._id))))
                                        const creatorPosts = {}

                                        result.forEach(thread => {
                                            if (usersFound.includes(String(thread.creatorId))) {
                                                if (Array.isArray(creatorPosts[thread.creatorId])) {
                                                    creatorPosts[thread.creatorId].push(thread)
                                                } else {
                                                    creatorPosts[thread.creatorId] = [thread]
                                                }
                                            } else {
                                                console.error('A thread was found from user with id:', thread.creatorId, 'but that user does not exist in the database. The thread id is:', thread._id, '. This thread should be deleted immediately.')
                                            }
                                        })

                                        Promise.all(
                                            Object.entries(creatorPosts).map(([key, value]) => {
                                                //key is the user id
                                                //value is an array of the user's threads
                                                return threadPostHandler.processMultiplePostDataFromOneOwner(value, users.find(user => String(user._id) === key), userRequesting)
                                            })
                                        ).then(posts => {
                                            return resolve(HTTPWTHandler.OK('Posts found', [].concat(...posts)))
                                        }).catch(error => {
                                            console.error('An error occurred while processing data for thread posts. The error was:', error)
                                            return resolve(HTTPWTHandler.serverError('An error occurred while processing data. Please try again.'))
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while finding users with ids in this array:', uniqueUsers, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while finding comment creators. Please try again.'))
                                    })
                                } else {
                                    return resolve(HTTPWTHandler.notFound('This category does not have any threads.'))
                                }
                            }).catch(error => {
                                console.error('An error occurred while finding all threads from category with id:', categoryId, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding threads. Please try again.'))
                            })
                        } else {
                            return resolve(HTTPWTHandler.notFound('Category could not be found'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding category with id', categoryId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding category. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('User could not be found'))
                }
            }).catch(error => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getthreadsfromprofile = (userId, pubId, previousPostId) => {
        return new Promise(resolve => {
            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Type provided: ${typeof pubId}`))
            }

            if (pubId.length === 0) {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string.'))
            }

            if (typeof previousPostId !== 'string' && previousPostId !== undefined) {
                return resolve(HTTPWTHandler.badInput(`previousPostId must either be a string or undefined. Type provided: ${typeof previousPostId}`))
            }

            if (previousPostId?.length === 0) {
                return resolve(HTTPWTHandler.badInput('previousPostId must not be an empty string'))
            }

            User.findOne({secondId: {$eq: pubId}}).lean().then(userResult => {
                if (userResult) {
                    User.findOne({_id: {$eq: userId}}).lean().then(userRequestingThreads => {
                        if (userRequestingThreads && !userResult.blockedAccounts?.includes(userRequestingThreads.secondId)) {
                            if (userResult.privateAccount && !userResult.followers.includes(userRequestingThreads.secondId)) {
                                return resolve(HTTPWTHandler.notFound('This user has no thread posts!'))
                            }
                            var userid = userResult._id
                            console.log("user id:")
                            console.log(userid)

                            const dbQuery = {
                                creatorId: {$eq: userid}
                            }

                            if (previousPostId) {
                                dbQuery._id = {$lt: previousPostId}
                            }

                            Thread.find(dbQuery).sort({datePosted: -1}).limit(CONSTANTS.NUM_THREAD_POSTS_TO_SEND_PER_API_CALL).lean().then(result => {
                                if (result.length) {
                                    threadPostHandler.processMultiplePostDataFromOneOwner(result, userResult, userRequestingThreads).then(posts => {
                                        const toSend = {
                                            posts,
                                            noMorePosts: posts.length < CONSTANTS.NUM_THREAD_POSTS_TO_SEND_PER_API_CALL
                                        }

                                        return resolve(HTTPWTHandler.OK('Posts found', toSend))
                                    }).catch(error => {
                                        console.error('An error occurred while processing thread posts. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while getting thread posts. Please try again.'))
                                    })
                                } else {
                                    return resolve(HTTPWTHandler.notFound('No more thread posts could be found.', {posts: [], noMorePosts: true}))
                                }
                            }).catch(error => {
                                console.error('An error occurred while finding threads with creatorId:', userid, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding threads. Please try again.'))
                            })
                        } else {
                            return resolve(HTTPWTHandler.notFound('User not found.'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(err => {
                console.error('An error occurred while finding user with secondId:', pubId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #upvotethread = (userId, threadId) => {
        return new Promise(resolve => {
            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
            }
        
            //Find User
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Thread.findOne({_id: {$eq: threadId}}).lean().then(data => {
                        if (data) {
                            threadPostHandler.upvote(data, result).then(successMessage => {
                                return resolve(HTTPWTHandler.OK(successMessage))
                            }).catch(error => {
                                if (error.privateError) {
                                    console.error('An error occured while upvoting thread. The error was:', error)
                                }
                                return resolve(HTTPWTHandler.serverError(error.publicError))
                            })
                        } else {
                            return resolve(HTTPWTHandler.notFound('Thread not found'))
                        }
                    }).catch(error => {
                        console.error('An error occured while finding thread with id:', threadId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding thread. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('User could not be found with userId provided'))
                }
            }).catch(error => {
                console.error('An error occurred while finding a user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #downvotethread = (userId, threadId) => {
        return new Promise(resolve => {
            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
            }
        
            //Find User
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Thread.findOne({_id: {$eq: threadId}}).lean().then(data => {
                        if (data) {
                            threadPostHandler.downvote(data, result).then(successMessage => {
                                return resolve(HTTPWTHandler.OK(successMessage))
                            }).catch(error => {
                                if (error.privateError) {
                                    console.error('An error occured while downvoting thread. The error was:', error)
                                }
                                return resolve(HTTPWTHandler.serverError(error.publicError))
                            })
                        } else {
                            return resolve(HTTPWTHandler.notFound('Thread not found'))
                        }
                    }).catch(error => {
                        console.error('An error occured while finding thread with id:', threadId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding thread. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('User not found with provided userId'))
                }
            }).catch(error => {
                console.error('An error occured while finding a user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #threadpostcomment = (userId, comment, postId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }
        
            comment = comment.trim();
        
            if (comment.length == 0) {
                return resolve(HTTPWTHandler.badInput('comment cannot be blank'))
            }
        
            if (comment.length > CONSTANTS.MAX_USER_COMMENT_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`comment must not be more than ${CONSTANTS.MAX_USER_COMMENT_LENGTH} characters long`))
            }

            if (!CONSTANTS.VALID_COMMENT_TEST.test(comment)) {
                return resolve(HTTPWTHandler.badInput(`comment must have less than ${CONSTANTS.MAX_USER_COMMENT_LINES} lines`))
            }
        
            //Find User
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    var objectId = new mongoose.Types.ObjectId()
                    console.log(objectId)
                    var commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], commentReplies: [], datePosted: Date.now()}
                    Thread.findOneAndUpdate({_id: {$eq: postId}}, { $push: { comments: commentForPost } }).then(function(){
                        console.log("SUCCESS1")
                        commentForPost.commentId = String(commentForPost.commentId)
                        commentForPost.commenterId = String(commentForPost.commenterId)
                        commentForPost.isOwner = true;
                        return resolve(HTTPWTHandler.OK('Comment upload successful', commentForPost))
                    })
                    .catch(err => {
                        console.error('An error occurred while adding comment object:', commentForPost, "to thread's comments with id:", postId, '. The error was:', err)
                        return resolve(HTTPWTHandler.serverError('An error occurred while adding comment to post. Please try again.'))
                    });
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                } 
            })
            .catch(err => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            });
        })
    }

    static #threadpostcommentreply = (userId, comment, postId, commentId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }
        
            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }
        
            comment = comment.trim();
        
            if (comment.length == 0) {
                return resolve(HTTPWTHandler.badInput('comment cannot be blank'))
            }
        
            if (comment.length > CONSTANTS.MAX_USER_COMMENT_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`comment cannot be more than ${CONSTANTS.MAX_USER_COMMENT_LENGTH} characters`))
            }

            if (!CONSTANTS.VALID_COMMENT_TEST.test(comment)) {
                return resolve(HTTPWTHandler.badInput(`comment must have less than ${CONSTANTS.MAX_USER_COMMENT_LINES} lines`))
            }
        
            //Find User
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Thread.findOne({_id: {$eq: postId}}).lean().then(data => {
                        if (data) {
                            const comments = data.comments;

                            const commentIndex = comments.findIndex(item => String(item.commentId) === commentId)

                            if (commentIndex === -1) {
                                return resolve(HTTPWTHandler.badInput("Couldn't find comment"))
                            }

                            const objectId = new mongoose.Types.ObjectId()
                            console.log(objectId)
                            const commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], datePosted: Date.now()}
                            Thread.findOneAndUpdate({_id: {$eq: postId}}, { $push: { [`comments.${sentIndex}.commentReplies`]: commentForPost } }).then(function(){
                                console.log("SUCCESS1")
                                commentForPost.commentId = String(commentForPost.commentId)
                                commentForPost.commenterId = String(commentForPost.commenterId)
                                commentForPost.isOwner = true;
                                return resolve(HTTPWTHandler.OK('Comment upload successful', commentForPost))
                            })
                            .catch(err => {
                                console.error('An error occurred while pushing:', commentForPost, 'to:', `comments.${sentIndex}.commentReplies`, ' for thread with id:', postId, '. The error was:', err)
                                return resolve(HTTPWTHandler.serverError('An error occurred while adding comment. Please try again.'))
                            });
                        } else {
                            return resolve(HTTPWTHandler.notFound('Could not find thread'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding thread with id:', postId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding thread. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                } 
            })
            .catch(err => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            });
        })
    }

    static #searchforthreadcomments = (userId, postId) => {
        return new Promise(resolve => {
            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }
        
            if (postId.length == 0) {
                return resolve(HTTPWTHandler.badInput('postId cannot be blank'))
            }
        
            //Find User
            function sendResponse(nameSendBackObject) {
                console.log("Params Recieved")
                console.log(nameSendBackObject)
                HTTPHandler.OK(res, 'Comment search successful', nameSendBackObject)
            }
            
            Thread.findOne({_id: {$eq: postId}}).lean().then(data => {
                if (data) {
                    var nameSendBackObject = [];
                    var comments = data.comments;
                    if (comments.length == 0) {
                        return resolve(HTTPWTHandler.OK('Comment search successful', []))
                    } else {
                        var itemsProcessed = 0;
                        console.log(comments)
                        comments.forEach(function (item, index) {
                            User.findOne({_id: comments[index].commenterId}).lean().then(result => {
                                if (result) {
                                    console.log(data)
                                    console.log(data.comments[index].commentText)
                                    var commentUpVotes = (data.comments[index].commentUpVotes.length - data.comments[index].commentDownVotes.length)
                                    var commentUpVoted = false
                                    if (data.comments[index].commentUpVotes.includes(userId)) {
                                        commentUpVoted = true
                                    }
                                    var commentDownVoted = false
                                    if (data.comments[index].commentDownVotes.includes(userId)) {
                                        commentDownVoted = true
                                    }
                                    nameSendBackObject.push({
                                        commentId: String(data.comments[index].commentId), 
                                        commenterName: result.name, 
                                        commenterDisplayName: result.displayName, 
                                        commentText: data.comments[index].commentsText, 
                                        commentUpVotes: commentUpVotes, 
                                        commentDownVotes: data.comments[index].commentDownVotes, 
                                        commentReplies: data.comments[index].commentReplies.length, 
                                        datePosted: data.comments[index].datePosted, 
                                        profileImageKey: result.profileImageKey, 
                                        commentUpVoted: commentUpVoted, 
                                        commentDownVoted: commentDownVoted,
                                        isOwner: String(data.comments[index].commenterId) === String(userId)
                                    })
                                } else {
                                    console.error('A comment was found on thread post with id:', postId, " and the comment creator cannot be found. The comment creator's id is:", comments[index].commenterId)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while checking for comment creator'))
                                }
                                itemsProcessed++;
                                if(itemsProcessed === comments.length) {
                                    console.log("Before Function")
                                    console.log(nameSendBackObject)
                                    sendResponse(nameSendBackObject);
                                }
                            }).catch(error => {
                                console.error('An error occurred whole finding user with id:', comments[index].commenterId, '. The error was:', error)
                            })
                        })
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound('Thread could not be found'))
                }
            })
            .catch(err => {
                console.error('An error occurred while finding thread with id:', postId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding thread. Please try again.'))
            });
        })
    }

    static #getsinglethreadcomment = (userId, threadId, commentId) => {
        return new Promise(resolve => {
            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
            }
        
            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }
        
            if (threadId.length == 0) {
                return resolve(HTTPWTHandler.badInput('threadId must not be blank'))
            }
        
            if (commentId.length == 0) {
                return resolve(HTTPWTHandler.badInput('commentId must not be blank'))
            }
        
            //Find User

            function sendResponse(nameSendBackObject) {
                console.log("Params Recieved")
                console.log(nameSendBackObject)
                return resolve(HTTPWTHandler.OK('Comment search successful', nameSendBackObject))
            }

            Thread.findOne({_id: {$eq: threadId}}).lean().then(data => {
                if (!data) {
                    return resolve(HTTPWTHandler.notFound('Thread could not be found'))
                }

                const comments = data.comments;

                if (comments.length == 0) {
                    return resolve(HTTPWTHandler.notFound('No comments'))
                }

                const commentIndex = comments.findIndex(comment => String(comment.commentId) === commentId)

                if (commentIndex === -1) {
                    return resolve(HTTPWTHandler.notFound('Comment could not be found'))
                }

                const comment = comments[commentIndex];
                const nameSendBackObject = [];

                User.findOne({_id: {$eq: comment.commenterId}}).lean().then(creator => {
                    if (!creator) {
                        return resolve(HTTPWTHandler.notFound('Comment creator could not be found'))
                    }

                    var commentUpVotes = (comment.commentUpVotes.length - comment.commentDownVotes.length)
                    var commentUpVoted = false
                    if (comment.commentUpVotes.includes(userId)) {
                        commentUpVoted = true
                    }
                    var commentDownVoted = false
                    if (comment.commentDownVotes.includes(userId)) {
                        commentDownVoted = true
                    }
                    nameSendBackObject.push({
                        commentId: String(comment.commentId),
                        commenterName: creator.name,
                        commenterDisplayName: creator.displayName,
                        commentText: comment.commentsText,
                        commentUpVotes: commentUpVotes,
                        commentDownVotes: comment.commentDownVotes,
                        commentReplies:comment.commentReplies.length,
                        datePosted: commentdatePosted,
                        profileImageKey: creator.profileImageKey,
                        commentUpVoted: commentUpVoted,
                        commentDownVoted: commentDownVoted,
                        isOwner: String(comment.commenterId) === String(userId)
                    })
                    sendResponse(nameSendBackObject)
                }).catch(error => {
                    console.error('An error occurred while finding one user with id:', comment.commenterId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding comment creator. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one thread with id:', threadId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding thread. Please try again.'))
            })
        })
    }

    static #searchforthreadcommentreplies = (userId, threadId, commentId) => {
        return new Promise(resolve => {
            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
            }
        
            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }
        
            if (threadId.length == 0) {
                return resolve(HTTPWTHandler.badInput('threadId cannot be blank'))
            }
        
            if (commentId.length == 0) {
                return resolve(HTTPWTHandler.badInput('commentId cannot be blank'))
            }
        
        
            //Find User
            function sendResponse(nameSendBackObject) {
                console.log("Params Recieved")
                console.log(nameSendBackObject)

                if (nameSendBackObject.length == 0) {
                    return resolve(HTTPWTHandler.notFound('No comment replies'))
                }
                return resolve(HTTPWTHandler.OK('Comment search successful', nameSendBackObject))
            }

            Thread.findOne({_id: {$eq: threadId}}).lean().then(data => {
                if (data) {
                    const nameSendBackObject = [];
                    const comments = data.comments;

                    if (comments.length == 0) {
                        return resolve(HTTPWTHandler.badInput('No comments'))
                    }

                    const commentIndex = comments.findIndex(comment => String(comment.commentId) === commentId)

                    if (commentIndex === -1) {
                        return resolve(HTTPWTHandler.notFound('Comment could not be found'))
                    }

                    const comment = comments[commentIndex]
                    const commentReplies = comment.commentReplies;

                    if (commentReplies.length == 0) {
                        return resolve(HTTPWTHandler.notFound('No comment replies'))
                    }

                    const uniqueCreators = Array.from(new Set(commentReplies.map(comment => comment.commenterId)))

                    User.find({_id: {$in: uniqueCreators}}).lean().then(creators => {
                        const creatorObject = {};
                        creators.forEach(creator => {
                            creatorObject[String(creator._id)] = creator
                        })

                        commentReplies.forEach(comment => {
                            const commentCreator = creatorObject[String(comment.commenterId)]
                            
                            if (commentCreator) {
                                const commentUpVotes = (commentReplies[index].commentUpVotes.length - commentReplies[index].commentDownVotes.length)
                                const commentUpVoted = comment.commentUpVotes.includes(userId)
                                const commentDownVoted = comment.commentDownVotes.includes(userId)
                                nameSendBackObject.push({
                                    commentId: comment.commentId,
                                    commenterName: commentCreator.name,
                                    commenterDisplayName: commentCreator.displayName,
                                    commentText: comment.commentsText,
                                    commentUpVotes: commentUpVotes,
                                    commentDownVotes: comment.commentDownVotes,
                                    datePosted: comment.datePosted,
                                    profileImageKey: commentCreator.profileImageKey,
                                    commentUpVoted: commentUpVoted,
                                    commentDownVoted: commentDownVoted,
                                    isOwner: String(comment.commenterId) === String(userId)
                                })
                            }
                        })

                        sendResponse(nameSendBackObject)
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find thread'))
                }
            }).catch(err => {
                console.error('An error occurred while finding thread with id:', threadId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding thread. Please try again.'))
            });
        })
    }

    static #getthreadbyid = (userId, threadId) => {
        return new Promise(resolve => {
            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
            }
        
            if (threadId.length == 0) {
                return resolve(HTTPWTHandler.badInput('threadId cannot be blank.'))
            }
        
            Thread.findOne({_id: {$eq: threadId}}).lean().then(result => {
                if (result) {
                    Category.findOne({_id: result.threadCategoryId}).lean().then(data =>{ 
                        if (data) {
                            var categoryImageKey = data.imageKey
                            if (data.imageKey == "") {
                                categoryImageKey = null
                            }

                            User.findOne({_id: result.creatorId}).lean().then(data => {
                                if (data) {
                                    User.findOne({_id: {$eq: userId}}).lean().then(userRequestingThread => {
                                        if (userRequestingThread) {
                                            if (data.blockedAccounts?.includes(userRequestingThread.secondId)) {
                                                return resolve(HTTPWTHandler.notFound('Could not find thread creator'))
                                            }

                                            if (data.privateAccount === true && !data.followers.includes(userRequestingThread.secondId)) {
                                                return resolve(HTTPWTHandler.forbidden("You must be following the thread's creator to view this thread."))
                                            }

                                            threadPostHandler.processMultiplePostDataFromOneOwner([result], data, userRequestingThread).then(posts => {
                                                const post = {
                                                    ...posts[0],
                                                    categoryImageKey
                                                }
                                                return resolve(HTTPWTHandler.OK('Posts found', post))
                                            }).catch(error => {
                                                console.error('An error occured while processing thread. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while getting thread. Please try again.'))
                                            })
                                        } else {
                                            return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                                        }
                                    }).catch(error => {
                                        console.error('An error occured while finding a user with id:', userId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                                    })
                                } else {
                                    return resolve(HTTPWTHandler.notFound('Could not find thread creator.'))
                                }
                            }).catch(error => {
                                console.error('An error occurred while finding user with id:', result.creatorId, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding thread creator. Please try again.'))
                            })
                        } else {
                            return resolve(HTTPWTHandler.notFound('Could not find category for thread.'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding category with id:', result.threadCategoryId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding category. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find thread'))
                }
            }).catch(error => {
                console.error('An error occured while trying to find thread with id:', threadId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding thread post. Please try again.'))
            })
        })
    }

    static #deletethread = (userId, threadId) => {
        return new Promise(resolve => {
            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
            }
        
            if (threadId.length == 0) {
                return resolve(HTTPWTHandler.badInput('threadId cannot be blank.'))
            }
        
        
            User.findOne({_id: {$eq: userId}}).lean().then(user => {
                if (user) {
                    //User exists
                    Thread.findOne({_id: {$eq: threadId}}).lean().then(thread => {
                        if (thread) {
                            if (String(thread.creatorId) === String(userId)) {
                                if (thread.threadType === 'Images') {
                                    imageHandler.deleteImageByKey(thread.threadImageKey)
                                }

                                Thread.deleteOne({_id: thread._id}).then(function(){
                                    Promise.all([
                                        Upvote.deleteMany({postId: thread._id, postFormat: 'Thread'}),
                                        Downvote.deleteMany({postId: thread._id, postFormat: 'Thread'})
                                    ]).catch(error => {
                                        console.error('An error occured while deleting all votes from thread post with id:', thread._id, '. The error was:', error)
                                    }).finally(() => {
                                        return resolve(HTTPWTHandler.OK('Deleted'))
                                    })
                                }).catch(err => {
                                    console.error('An error occurred while deleting thread with id:', thread._id, '. The error was:', err)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting thread. Please try again.'))
                                });
                            } else {
                                return resolve(HTTPWTHandler.forbidden("You cannot delete someone else's posts"))
                            }
                        } else {
                            return resolve(HTTPWTHandler.notFound('Could not find thread'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding thread with id:', threadId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding thread. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #upvotecomment = (userId, format, postId, commentId) => {
        return new Promise(resolve => {
            const supportedFormats = ["Image", "Poll", "Thread"]

            if (!supportedFormats.includes(format)) {
                return resolve(HTTPWTHandler.badInput(`format must be either ${supportedFormats.join(', ')}`))
            }

            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }

            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }

            if (postId.length === 0) {
                return resolve(HTTPWTHandler.badInput('postId cannot be blank'))
            }

            if (commentId.length === 0) {
                return resolve(HTTPWTHandler.badInput('commentId cannot be blank'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    //User exists
                    if (format == "Poll") {
                        Poll.findOne({_id: {$eq: postId}}).lean().then(poll => {
                            if (poll) {
                                User.findOne({_id: {$eq: poll.creatorId}}).lean().then(pollCreator => {
                                    if (!pollCreator) {
                                        return resolve(HTTPWTHandler.notFound('Could not find poll creator'))
                                    }

                                    if (pollCreator.privateAccount === true && !pollCreator.followers.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('Could not find comment'))
                                    }

                                    if (pollCreator.blockedAccounts?.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('User not found'))
                                    }

                                    const comments = poll.comments;
                                    if (comments.length == 0) {
                                        return resolve(HTTPWTHandler.notFound('No comments could be found'))
                                    }

                                    const commentIndex = comments.findIndex(comment => String(comment.commentId) === commentId)

                                    if (commentIndex === -1) {
                                        return resolve(HTTPWTHandler.notFound('Comment could not be found'))
                                    }

                                    const comment = comments[commentIndex];

                                    User.findOne({_id: {$eq: comment.commenterId}}).lean().then(commentCreator => {
                                        if (!commentCreator) {
                                            return resolve(HTTPWTHandler.notFound('Could not find comment creator'))
                                        }

                                        if (commentCreator.blockedAccounts?.includes(result.secondId)) {
                                            return resolve(HTTPWTHandler.notFound('User not found'))
                                        }

                                        if (comment.commentUpVotes.includes(userId)) {
                                            //User has upvoted
                                            Poll.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentUpVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment UpVote removed'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${commentIndex}.commentUpVotes`, 'in poll with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing current comment upvote. Please try again.'))
                                            });
                                        } else if (comment.commentDownVotes.includes(userId)) {
                                            Poll.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentDownVotes`] : userId }, $addToSet: { [`comments.${commentIndex}.commentUpVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment UpVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${commentIndex}.commentDownVotes`, 'and adding to set:', userId, 'to:', `comments.${commentIndex}.commentUpVotes`, 'on post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while upvoting post comment. Please try again.'))
                                            });
                                        } else {
                                            Poll.findOneAndUpdate({_id: {$eq: postId}}, { $addToSet: { [`comments.${commentIndex}.commentUpVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment UpVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while adding to set:', userId, 'into:', `comments.${commentIndex}.commentUpVotes`, 'on poll with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while upvoting post comment. Please try again.'))
                                            });
                                        }
                                    }).catch(error => {
                                        console.error('An error occurred while finding one user with id:', comment.commenterId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while finding comment creator.'))
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while finding one user with id:', poll.creatorId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding the poll creator. Please try again.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('Could not find poll post.'))
                            }
                        }).catch(error => {
                            console.error('An error occurred while finding poll with id:', postId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding poll post. Please try again.'))
                        })
                    } else if (format == "Image") {
                        ImagePost.findOne({_id: {$eq: postId}}).lean().then(imagePost => {
                            if (imagePost) {
                                User.findOne({_id: {$eq: imagePost.creatorId}}).lean().then(postCreator => {
                                    if (!postCreator) {
                                        return resolve(HTTPWTHandler.notFound('Could not find post creator'))
                                    }

                                    if (postCreator.privateAccount === true && !postCreator.followers.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('Could not find comment'))
                                    }

                                    if (postCreator.blockedAccounts?.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('User not found'))
                                    }

                                    const comments = imagePost.comments;

                                    if (comments.length == 0) {
                                        return resolve(HTTPWTHandler.notFound('No comments could be found'))
                                    }

                                    const commentIndex = comments.findIndex(comment => String(comment.commentId) === commentId)
                                    if (commentIndex === -1) {
                                        return resolve(HTTPWTHandler.notFound('Comment could not be found'))
                                    }

                                    const comment = comments[commentIndex]

                                    User.findOne({_id: {$eq: comment.commenterId}}).lean().then(commentCreator => {
                                        if (!commentCreator) {
                                            return resolve(HTTPWTHandler.notFound('Could not find comment creator'))
                                        }

                                        if (commentCreator.blockedAccounts?.includes(result.secondId)) {
                                            return resolve(HTTPWTHandler.notFound('User not found'))
                                        }

                                        if (comment.commentUpVotes.includes(userId)) {
                                            //User has upvoted
                                            ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentUpVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment UpVote removed'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${commentIndex}.commentUpVotes`, 'on image post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing post comment upvote. Please try again.'))
                                            });
                                        } else if (comment.commentDownVotes.includes(userId)) {
                                            ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentDownVotes`] : userId}, $addToSet: { [`comments.${commentIndex}.commentUpVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment UpVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while adding to set:', userId, 'to:', `comments.${commentIndex}.commentUpVotes`, 'and pull:', userId, 'from:', `comments.${commentIndex}.commentDownVotes`, 'on image post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing downvote and adding upvote to image post comment. Please try again.'))
                                            });
                                        } else {
                                            ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $addToSet: { [`comments.${commentIndex}.commentUpVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment UpVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pushing:', userId, 'to:', `comments.${commentIndex}.commentUpVotes`, 'on image post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while upvoting post comment. Please try again.'))
                                            });
                                        }
                                    }).catch(error => {
                                        console.error('An error occurred while finding one user with id:', comment.commenterId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while finding one user with id:', imagePost.creatorId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again later.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('Could not find image post.'))
                            }
                        }).catch(error => {
                            console.error('An error occurred while finding image post with id:', postId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding image post. Please try again.'))
                        })
                    } else if (format == "Thread") {
                        Thread.findOne({_id: {$eq: postId}}).lean().then(thread => {
                            if (thread) {
                                User.findOne({_id: {$eq: thread.creatorId}}).lean().then(postCreator => {
                                    if (!postCreator) {
                                        return resolve(HTTPWTHandler.notFound('Could not find the post creator'))
                                    }

                                    if (postCreator.privateAccount === true && !postCreator.followers.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('Could not find comment'))
                                    }

                                    if (postCreator.blockedAccounts?.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('User not found'))
                                    }

                                    const comments = thread.comments;

                                    if (comments.length == 0) {
                                        return resolve(HTTPWTHandler.notFound('This thread post has no comments'))
                                    }

                                    const commentIndex = comments.findIndex(comment => String(comment.commentId) === commentId)

                                    if (commentIndex === -1) {
                                        return resolve(HTTPWTHandler.notFound('Could not find comment'))
                                    }

                                    const comment = comments[commentIndex]

                                    User.findOne({_id: {$eq: comment.commenterId}}).lean().then(commentCreator => {
                                        if (!commentCreator) {
                                            return resolve(HTTPWTHandler.notFound('Could not find comment creator'))
                                        }

                                        if (commentCreator.blockedAccounts?.includes(result.secondId)) {
                                            return resolve(HTTPWTHandler.notFound('User not found'))
                                        }

                                        if (comment.commentUpVotes.includes(userId)) {
                                            //User has upvoted
                                            Thread.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentUpVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment UpVote removed'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${commentIndex}.commentUpVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing upvote from post. Please try again.'))
                                            });
                                        } else if (comment.commentDownVotes.includes(userId)) {
                                            Thread.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentDownVotes`] : userId }, $addToSet: { [`comments.${commentIndex}.commentUpVotes`] : userId}}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment UpVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentDownVotes`, 'and adding to set:', userId, 'to:', `comments.${commentIndex}.commentUpVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing downvote and adding upvote to thread post. Please try again.'))
                                            });
                                        } else {
                                            Thread.findOneAndUpdate({_id: {$eq: postId}}, { $addToSet: { [`comments.${commentIndex}.commentUpVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment UpVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while adding to set:', userId, 'to:', `comments.${commentIndex}.commentUpVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while adding upvote to post. Please try again.'))
                                            });
                                        }
                                    }).catch(error => {
                                        console.error('An error occurred while finding one user with id:', comment.commenterId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while finding comment creator. Please try again.'))
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while finding one user with id:', thread.creatorId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding thread creator. Please try again.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('Thread could not be found'))
                            }
                        }).catch(error => {
                            console.error('An error occurred while finding thread with id:', postId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding thread post. Please try again.'))
                        })
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with userId provided'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #downvotecomment = (userId, format, postId, commentId) => {
        return new Promise(resolve => {
            const supportedFormats = ["Image", "Poll", "Thread"]

            if (!supportedFormats.includes(format)) {
                return resolve(HTTPWTHandler.badInput(`format must be either ${supportedFormats.join(', ')}`))
            }

            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }

            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }

            if (postId.length === 0) {
                return resolve(HTTPWTHandler.badInput('postId cannot be blank'))
            }

            if (commentId.length === 0) {
                return resolve(HTTPWTHandler.badInput('commentId cannot be blank'))
            }


            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    //User exists
                    if (format == "Poll") {
                        Poll.findOne({_id: {$eq: postId}}).then(poll => {
                            if (poll) {
                                User.findOne({_id: {$eq: poll.creatorId}}).lean().then(postCreator => {
                                    if (!postCreator) {
                                        return resolve(HTTPWTHandler.notFound('Could not find post creator'))
                                    }

                                    if (postCreator.privateAccount === true && !postCreator.followers.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('Could not find comment'))
                                    }

                                    if (postCreator.blockedAccounts?.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('User not found'))
                                    }

                                    const comments = poll.comments;
                                    if (comments.length == 0) {
                                        return resolve(HTTPWTHandler.notFound('No comments could be found for this poll post'))
                                    }

                                    const commentIndex = comments.findIndex(comment => String(comment.commentId) === commentId)
                                    if (commentIndex === -1) {
                                        return resolve(HTTPWTHandler.badInput('Comment could not be found'))
                                    }

                                    const comment = comments[commentIndex]

                                    User.findOne({_id: comment.commenterId}).lean().then(commentCreator => {
                                        if (!commentCreator) {
                                            return resolve(HTTPWTHandler.notFound('Could not find comment creator'))
                                        }

                                        if (commentCreator.blockedAccounts?.includes(result.secondId)) {
                                            return resolve(HTTPWTHandler.notFound('User not found'))
                                        }

                                        if (comment.commentDownVotes.includes(userId)) {
                                            //User has upvoted
                                            Poll.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentDownVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment DownVote removed'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${commentIndex}.commentDownVotes`, 'from poll with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing downvote from poll post. Please try again.'))
                                            });
                                        } else if (comment.commentUpVotes.includes(userId)) {
                                            Poll.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentUpVotes`] : userId }, $addToSet: { [`comments.${commentIndex}.commentDownVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment DownVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${commentIndex}.commentUpVotes`, 'and adding to set:', userId, 'to:', `comments.${commentIndex}.commentDownVotes`, 'on poll with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing upvote and adding downvote to poll post. Please try again.'))
                                            });
                                        } else {
                                            Poll.findOneAndUpdate({_id: {$eq: postId}}, { $addToSet: { [`comments.${commentIndex}.commentDownVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment DownVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while adding to set:', userId, ' to:', `comments.${commentIndex}.commentDownVotes`, 'on poll with id:', postId, '. The error was:', err)
                                            });
                                        }
                                    }).catch(error => {
                                        console.error('An error occurred while finding one user with id:', comment.commenterId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while finding comment creator. Please try again.'))
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while finding one user with id:', poll.creatorId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll creator. Please try again.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('Could not find poll post.'))
                            }
                        }).catch(error => {
                            console.error('An error occurred while finding poll post with id:', postId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding poll post. Please try again.'))
                        })
                    } else if (format == "Image") {
                        ImagePost.findOne({_id: {$eq: postId}}).lean().then(imagePost => {
                            if (imagePost) {
                                User.findOne({_id: {$eq: imagePost.creatorId}}).lean().then(postCreator => {
                                    if (!postCreator) {
                                        return resolve(HTTPWTHandler.notFound('Could not find post creator'))
                                    }

                                    if (postCreator.privateAccount === true && !postCreator.followers.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('Could not find comment'))
                                    }

                                    if (postCreator.blockedAccounts?.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('User not found'))
                                    }

                                    const comments = imagePost.comments;
                                    if (comments.length == 0) {
                                        return resolve(HTTPWTHandler.notFound('This post has no comments'))
                                    }

                                    const commentIndex = comments.findIndex(comment => String(comment.commentId) === commentId)
                                    if (commentIndex === -1) {
                                        return resolve(HTTPWTHandler.notFound('Could not find comment'))
                                    }

                                    const comment = comments[commentIndex];

                                    User.findOne({_id: comment.commenterId}).lean().then(commentCreator => {
                                        if (!commentCreator) {
                                            return resolve(HTTPWTHandler.notFound('Could not find comment creator.'))
                                        }

                                        if (commentCreator.blockedAccounts?.includes(result.secondId)) {
                                            return resolve(HTTPWTHandler.notFound('User not found'))
                                        }

                                        if (comment.commentDownVotes.includes(userId)) {
                                            //User has upvoted
                                            ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentDownVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment DownVote removed'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${commentIndex}.commentDownVotes`, 'from image post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing downvote from image post. Please try again.'))
                                            });
                                        } else if (comment.commentUpVotes.includes(userId)) {
                                            ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentUpVotes`] : userId }, $addToSet: { [`comments.${commentIndex}.commentDownVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment DownVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${commentIndex}.commentUpVotes`, 'and adding to set:', userId, 'to:', `comments.${commentIndex}.commentDownVotes`, 'on image post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing upvote and adding downvote to post. Please try again.'))
                                            });
                                        } else {
                                            ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $addToSet: { [`comments.${commentIndex}.commentDownVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment DownVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while adding to set:', userId, 'to:', `comments.${commentIndex}.commentDownVotes`, 'from image post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while downvoting post. Please try again.'))
                                            });
                                        }
                                    }).catch(error => {
                                        console.error('An error occurred while finding one user with id:', comment.commenterId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while finding comment creator. Please try again.'))
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while finding one user with id:', imagePost.creatorId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding post creator. Please try again.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('Could not find image post'))
                            }
                        }).catch(error => {
                            console.error('An error occurred while finding image post with id:', postId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding image post. Please try again.'))
                        })
                    } else if (format == "Thread") {
                        Thread.findOne({_id: {$eq: postId}}).lean().then(thread => {
                            if (thread) {
                                User.findOne({_id: thread.creatorId}).lean().then(postCreator => {
                                    if (!postCreator) {
                                        return resolve(HTTPWTHandler.notFound('Could not find the thread creator'))
                                    }

                                    if (postCreator.privateAccount === true && !postCreator.followers.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('Could not find comment'))
                                    }

                                    if (postCreator.blockedAccounts?.includes(result.secondId)) {
                                        return resolve(HTTPWTHandler.notFound('User not found'))
                                    }

                                    const comments = thread.comments;
                                    if (comments.length == 0) {
                                        return resolve(HTTPWTHandler.notFound('This thread post has no comments'))
                                    }

                                    const commentIndex = comments.findIndex(comment => String(comment.commentId) === commentId)
                                    if (commentIndex === -1) {
                                        return resolve(HTTPWTHandler.notFound('Comment could not be found'))
                                    }

                                    const comment = comments[commentIndex]

                                    User.findOne({_id: comment.commenterId}).lean().then(commentCreator => {
                                        if (!commentCreator) {
                                            return resolve(HTTPWTHandler.notFound('Could not find comment creator'))
                                        }

                                        if (commentCreator.blockedAccounts?.includes(result.secondId)) {
                                            return resolve(HTTPWTHandler.notFound('User not found'))
                                        }

                                        if (comment.commentDownVotes.includes(userId)) {
                                            //User has downvoted
                                            Thread.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentDownVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment DownVote removed'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${commentIndex}.commentDownVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing downvote from thread post. Please try again.'))
                                            });
                                        } else if (comment.commentUpVotes.includes(userId)) {
                                            Thread.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${commentIndex}.commentUpVotes`] : userId }, $addToSet: { [`comments.${commentIndex}.commentDownVotes`] : userId}}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment DownVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while pulling:', userId, 'from:', `comments.${commentIndex}.commentUpVotes`, 'and adding to set:', userId, 'to:', `comments.${commentIndex}.commentDownVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing upvote and adding downvote to thread post. Please try again.'))
                                            });
                                        } else {
                                            Thread.findOneAndUpdate({_id: {$eq: postId}}, { $addToSet: { [`comments.${commentIndex}.commentDownVotes`] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Comment DownVoted'))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while adding to set:', userId, 'to:', `comments.${commentIndex}.commentDownVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while downvoting thread post. Please try again.'))
                                            });
                                        }
                                    }).catch(error => {
                                        console.error('An error occurred while finding one user with id:', comment.commenterId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while finding the comment creator. Please try again.'))
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while finding one user with id:', thread.creatorId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding thread creator. Please try again.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('Thread could not be found'))
                            }
                        }).catch(error => {
                            console.error('An error occurred while finding thread with id:', postId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding thread post. Please try again.'))
                        })
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with userId provided'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #toggleFollowOfAUser = (userId, userToFollowPubId) => {
        return new Promise(resolve => {
            if (typeof userToFollowPubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userToFollowPubId must be a string. Provided type: ${typeof userToFollowPubId}`))
            }
        
            if (userToFollowPubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('userToFollowPubId cannot be a blank string.'))
            }
        
            //Check for userId validity and get user for their pub Id
            User.findOne({_id: {$eq: userId}}).lean().then(userFollowingFound => {
                if (userFollowingFound) {
                    //Check for other user for validity and to make sure they exist
                    User.findOne({secondId: {$eq: userToFollowPubId}}).lean().then(userGettingFollowed => {
                        if (!userGettingFollowed || userGettingFollowed.blockedAccounts?.includes(userFollowingFound.secondId)) {
                            //If the user could not be found or if the user has blocked the user trying to follow
                            return resolve(HTTPWTHandler.notFound('User not found'))
                        }

                        if (userId === String(userGettingFollowed._id)) {
                            return resolve(HTTPWTHandler.forbidden('You cannot follow yourself'))
                        }

                        if (userGettingFollowed.followers.includes(userFollowingFound.secondId)) {
                            //Already following account

                            mongoose.startSession().then(session => {
                                session.startTransaction();

                                const dbUpdates = [
                                    {
                                        updateOne: {
                                            filter: {_id: {$eq: userGettingFollowed._id}},
                                            update: {$pull : {followers: userFollowingFound.secondId}}
                                        }
                                    },
                                    {
                                        updateOne: {
                                            filter: {_id: {$eq: userId}},
                                            update: { $pull : {following: userGettingFollowed.secondId}}
                                        }
                                    }
                                ]
    
                                User.bulkWrite(dbUpdates, {session}).then(() => {
                                    session.commitTransaction().then(() => {
                                        session.endSession().catch(error => {
                                            console.error('An error occurred while ending Mongoose session:', error)
                                        }).finally(() => {
                                            return resolve(HTTPWTHandler.OK('UnFollowed user'))
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while commiting transaction and ending session. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while unfollowing account. Please try again.'))
                                    })
                                }).catch(error => {
                                    session.abortTransaction().catch(error => {
                                        console.error('An error occurred while aborting transaction:', error)
                                    }).finally(() => {
                                        session.endSession().catch(error => {
                                            console.error('An error occurred while ending mongoose session:', error)
                                        }).finally(() => {
                                            console.error('An error occurred while unfollowing account using bulkWrite on the User collection. The updates array was:', dbUpdates, '. The error was:', error)
                                            return resolve(HTTPWTHandler.serverError('An error occurred while unfollowing user. Please try again.'))
                                        })
                                    })
                                })
                            }).catch(error => {
                                console.error('An error occurred while starting mongoose session. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while unfollowing account. Please try again.'))
                            })
                        } else {
                            //Is not following account
                            if (userGettingFollowed.privateAccount == true) {
                                if (!userGettingFollowed.accountFollowRequests.includes(userFollowingFound.secondId)) {
                                    //Request to follow the account
                                    User.findOneAndUpdate({_id: userGettingFollowed._id}, {$addToSet: {accountFollowRequests: userFollowingFound.secondId}}).then(function() {
                                        if (userFollowingFound.settings.notificationSettings.SendFollowRequests && userGettingFollowed.settings.notificationSettings.FollowRequests) {
                                            //If the user following has SENDING follow requests notifications ON and user getting followed has follow requests notifications ON
                                            var notifMessage = {
                                                title: "New Follow Request",
                                                body: userFollowingFound.name + " has requested to follow you."
                                            }
                                            var notifData = {
                                                type: "Follow request",
                                                pubIdOfFollower: userFollowingFound.secondId
                                            }
                                            sendNotifications(userGettingFollowed._id, notifMessage, notifData)
                                        }
                                        return resolve(HTTPWTHandler.OK('Requested To Follow User'))
                                    }).catch(err => {
                                        console.error('An error occurred while adding to set:', userFollowingFound.secondId, 'to accountFollowRequests on user with id:', userGettingFollowed._id, '. The error was:', err)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while sending follow request to user. Please try again.'))
                                    })
                                } else {
                                    //Remove request to follow the account
                                    User.findOneAndUpdate({_id: userGettingFollowed._id}, {$pull: {accountFollowRequests: userFollowingFound.secondId}}).then(function() {
                                        return resolve(HTTPWTHandler.OK('Removed Request To Follow User'))
                                    }).catch(err => {
                                        console.error('An error occurred while pulling:', userFollowingFound.secondId, 'from accountFollowRequests for user with id:', userGettingFollowed._id, '. The error was:', err)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while removing request to follow user. Please try again.'))
                                    })
                                }
                            } else {
                                mongoose.startSession().then(session => {
                                    session.startTransaction();

                                    const dbUpdates = [
                                        {
                                            updateOne: {
                                                filter: {_id: {$eq: userGettingFollowed._id}},
                                                update: {$addToSet : {followers: userFollowingFound.secondId}}
                                            }
                                        },
                                        {
                                            updateOne: {
                                                filter: {_id: {$eq: userId}},
                                                update: { $addToSet : {following: userGettingFollowed.secondId}}
                                            }
                                        }
                                    ]
    
                                    User.bulkWrite(dbUpdates, {session}).then(() => {
                                        var notifMessage = {
                                            title: "New Follower",
                                            body: userFollowingFound[0].name + " has followed you."
                                        }
                                        var notifData = {
                                            type: "Follow",
                                            pubIdOfFollower: userFollowingFound[0].secondId
                                        }
                                        sendNotifications(userGettingFollowed[0]._id, notifMessage, notifData)

                                        session.commitTransaction().then(() => {
                                            session.endSession().catch(error => {
                                                console.error('An error occurred while ending mongoose session:', error)
                                            }).finally(() => {
                                                return resolve(HTTPWTHandler.OK('Followed User'))
                                            })
                                        }).catch(error => {
                                            console.error('An error occurred while commiting transaction and ending session. The error was:', error)
                                            return resolve(HTTPWTHandler.serverError('An error occurred while following account. Please try again.'))
                                        })
                                    }).catch(error => {
                                        session.abortTransaction().catch(error => {
                                            console.error('An error occurred while aborting transaction:', error)
                                        }).finally(() => {
                                            session.endSession().catch(error => {
                                                console.error('An error occurred while ending Mongoose session. The error was:', error)
                                            }).finally(() => {
                                                console.error('An error occurred while following not-private account using bulkWrite on the User collection. The updates array was:', dbUpdates, '. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while following user. Please try again.'))
                                            })
                                        })
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while starting a mongoose session. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while following account. Please try again.'))
                                })
                            }
                        }
                    }).catch(err => {
                        console.error('An error occurred while finding user with secondId:', userToFollowPubId, '. The error was:', err)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user to follow. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(err => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
            })
        })
    }

    static #reloadUsersDetails = (userId, usersPubId) => {
        return new Promise(resolve => {
            if (typeof usersPubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`usersPubId must be a string. Provided type: ${typeof usersPubId}`))
            }

            if (usersPubId.length === 0) {
                return resolve(HTTPWTHandler.badInput('usersPubId cannot be an empty string.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userSearching => {
                if (userSearching) {
                    const userSearchingPubId = userSearching.secondId;
        
                    User.findOne({secondId: {$eq: usersPubId}}).lean().then(userData => {
                        if (userData) {
                            //could do a user search ig but no need really
                            if (userData.blockedAccounts?.includes(userSearchingPubId)) {
                                return resolve(HTTPWTHandler.notFound('User not found.'))
                            } else {
                                const userDataToSend = {
                                    name: userData.name,
                                    displayName: userData.name,
                                    followers: userData.followers.length,
                                    following: userData.following.length,
                                    totalLikes: userData.totalLikes,
                                    profileKey: userData.profileImageKey,
                                    badges: userData.badges
                                };
        
                                if (userData.privateAccount == true) {
                                    if (userData.accountFollowRequests.includes(userSearchingPubId)) {
                                        //User has requested to follow this account
        
                                        const toSend = {
                                            ...userDataToSend,
                                            userIsFollowing: 'Requested'
                                        }
        
                                        return resolve(HTTPWTHandler.OK('Found', toSend))
                                    } else {
                                        //User has not requested to follow this private account
                                        if (userData.followers.includes(userSearchingPubId)) {
                                            // User is following this account
        
                                            const toSend = {
                                                ...userDataToSend,
                                                userIsFollowing: true
                                            }
        
                                            return resolve(HTTPWTHandler.OK('Found', toSend))
                                        } else {
                                            //User is not following this private account
        
                                            const toSend = {
                                                ...userDataToSend,
                                                userIsFollowing: false
                                            }
        
                                            return resolve(HTTPWTHandler.OK('Found', toSend))
                                        }
                                    }
                                } else {
                                    if (userData.followers.includes(userSearchingPubId)) {
        
                                        const toSend = {
                                            ...userDataToSend,
                                            userIsFollowing: true
                                        }
        
                                        return resolve(HTTPWTHandler.OK('Found', toSend))
                                    } else {
        
                                        const toSend = {
                                            ...userDataToSend,
                                            userIsFollowing: false
                                        }
        
                                        return resolve(HTTPWTHandler.OK('Found', toSend))
                                    }    
                                }      
                            }
                        } else {
                            return resolve(HTTPWTHandler.notFound('Could not find user with pubId'))
                        }
                    }).catch(err => {
                        console.error('An error occurred while finding user with secondId:', usersPubId, '. The error was:', err)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #earnSpecialBadge = (userId, badgeEarnt) => {
        return new Promise(resolve => {
            //Check if an actual special badge was passed
            if (badgeEarnt == "homeScreenLogoPressEasterEgg") { // Will add more badges here when we make more
                User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                    if (userFound) {
                        //User found
                        if (userFound.badges.findIndex(x => x.badgeName == badgeEarnt) !== -1) {
                            //Badge already earnt
                            return resolve(HTTPWTHandler.badInput('Badge already earnt.'))
                        } else {
                            //Badge not earnt
                            const badge = {
                                badgeName: badgeEarnt,
                                dateRecieved: Date.now()
                            }

                            User.findOneAndUpdate({_id: {$eq: userId}}, { $push : {badges: badge}}).then(function() {
                                return resolve(HTTPWTHandler.OK('Badge earnt.'))
                            }).catch(err => {
                                console.error('An error occurred while pushing badge object:', badge, 'to badges array for user with id:', userId, '. The error was:', err)
                                return resolve(HTTPWTHandler.serverError('An error occurred while adding badge to your account. Please try again.'))
                            })
                        }
                    } else {
                        return resolve(HTTPWTHandler.notFound('Could not find user withh provided userId'))
                    }
                }).catch(err => {
                    console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                })
            } else {
                return resolve(HTTPWTHandler.badInput('Wrong badge was given.'))
            }
        })
    }

    static #getuserbyid = (userId, pubId) => {
        return new Promise(resolve => {
            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Provided type: ${typeof pubId}`))
            }
        
            if (pubId.length === 0) {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string.'))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(requestingUser => {
                if (requestingUser) {
                    User.findOne({secondId: {$eq: pubId}}).lean().then(userFound => {
                        if (userFound) {
                            if (userFound.blockedAccounts?.includes(requestingUser.secondId)) {
                                return resolve(HTTPWTHandler.notFound('User not found.'))
                            }

                            const dataToSend = userHandler.returnPublicInformation(userFound, requestingUser)
                            return resolve(HTTPWTHandler.OK('User found.', dataToSend))
                        } else {
                            return resolve(HTTPWTHandler.notFound('User not found.'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding user with secondId:', pubId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userRequestingId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #makeaccountprivate = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then((userFound) => {
                if (userFound) {
                    // User exists
                    User.findOneAndUpdate({_id: {$eq: userId}}, {privateAccount: true}).then(function() {
                        return resolve(HTTPWTHandler.OK('Account is now private.'))
                    }).catch((error) => {
                        console.error('An error occurred while making user private (setting privateAccount to true) for user with id:', userId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while making your account private. Please try again.'))
                    })
                } else {
                    // User does not exist
                    return resolve(HTTPWTHandler.notFound('User with provided userId could not be found'))
                }
            }).catch((error) => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #makeaccountpublic = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (userFound) {
                    //User found
                    const accountsRequestingToFollow = userFound.accountFollowRequests

                    const dbUpdates = [
                        {
                            updateOne: {
                                filter: {_id: {$eq: userId}},
                                update: {$set: {privateAccount: false}}
                            }
                        }
                    ]

                    if (accountsRequestingToFollow) {
                        //Add all accounts' public ids requesting to follow to the user's followers list, add user's public id to each account requesting to follow's following list, and empty accountFollowRequests array
                        dbUpdates.push({
                            updateOne: {
                                filter: {_id: {$eq: userId}},
                                update: {$push: {followers: {$each: accountsRequestingToFollow}}, $set: {accountFollowRequests: []}}
                            }
                        })

                        for (const accountPubId of accountsRequestingToFollow) {
                            dbUpdates.push({
                                updateOne: {
                                    filter: {secondId: {$eq: accountPubId}},
                                    update: {$push: {following: userFound.secondId}}
                                }
                            })
                        }
                    }

                    mongoose.startSession().then(session => {
                        session.startTransaction();

                        User.bulkWrite(dbUpdates, {session}).then(() => session.commitTransaction()).then(() => {
                            session.endSession().catch(error => {
                                console.error('An error occurred while ending the Mongoose session:', error)
                            }).finally(() => {
                                return resolve(HTTPWTHandler.OK('Account is now public.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while making bulkWrite database updates to the User collection and commiting transaction. The updates were:', dbUpdates, '. The error was:', error)
                            session.abortTransaction().catch(error => {
                                console.error('An error occurred while aborting a Mongoose transaction:', error)
                            }).finally(() => {
                                session.endSession().catch(error => {
                                    console.error('An error occurred while ending a Mongoose session:', error)
                                }).finally(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while adding users that requested to follow you to your followers list. Please try again.'))
                                })
                            })
                        })
                    }).catch(error => {
                        console.error('An error occurred while starting Mongoose session. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while making your account public. Please try again.'))
                    })
                } else {
                    //User not found
                    return resolve(HTTPWTHandler.notFound('User not found.'))
                }
            }).catch((error) => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getfollowrequests = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (userFound) {
                    return resolve(HTTPWTHandler.OK('Found user', userFound.accountFollowRequests))
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #denyfollowrequest = (userId, accountFollowRequestDeniedPubID) => {
        return new Promise(resolve => {
            if (typeof accountFollowRequestDeniedPubID !== 'string') {
                return resolve(HTTPWTHandler.badInput(`accountFollowRequestDeniedPubID must be a string. Provided type: ${typeof accountFollowRequestDeniedPubID}`))
            }
        
            if (accountFollowRequestDeniedPubID.length == 0) {
                return resolve(HTTPWTHandler.badInput('accountFollowRequestDeniedPubID cannot be a blank string.'))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (userFound) {
                    if (userFound.accountFollowRequests.includes(accountFollowRequestDeniedPubID)) {
                        User.findOneAndUpdate({_id: {$eq: userId}}, {$pull: {accountFollowRequests: accountFollowRequestDeniedPubID}}).then(function() {
                            return resolve(HTTPWTHandler.OK('Request denied.'))
                        }).catch(err => {
                            console.error('An error occurred while pulling:', accountFollowRequestDeniedPubID, 'from:', 'accountFollowRequests', 'for user with id:', userId, '. The error was:', err)
                            return resolve(HTTPWTHandler.serverError('An error occurred while denying the follow request. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('Follow request could not be found.'))
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(err => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #acceptfollowrequest = (userId, accountFollowRequestAcceptedPubID) => {
        return new Promised(resolve => {
            if (typeof accountFollowRequestAcceptedPubID !== 'string') {
                return resolve(HTTPWTHandler.badInput(`accountFollowRequestAcceptedPubID must be a string. Provided type: ${typeof accountFollowRequestAcceptedPubID}`))
            }
        
            if (accountFollowRequestAcceptedPubID.length == 0) {
                return resolve(HTTPWTHandler.badInput('accountFollowRequestAcceptedPubID cannot be a blank string.'))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
        
                if (!userFound.accountFollowRequests.includes(accountFollowRequestAcceptedPubID)) {
                    //The follow request was not found in the user's list of follow requests
                    return resolve(HTTPWTHandler.notFound('Follow request could not be found.'))
                }
        
                const dbUpdates = [
                    {
                        updateOne: {
                            filter: {_id: {$eq: userId}},
                            update: {$push: {followers: accountFollowRequestAcceptedPubID}, $pull: {accountFollowRequests: accountFollowRequestAcceptedPubID}}
                        }
                    },
                    {
                        updateOne: {
                            filter: {_id: {$eq: accountFollowRequestAcceptedPubID}},
                            update: {$push: {following: userFound.secondId}}
                        }
                    }
                ]

                mongoose.startSession().then(session => {
                    session.startTransaction();

                    User.bulkWrite(dbUpdates, {session}).then(() => session.commitTransaction()).then(() => {
                        session.endSession().catch(error => {
                            console.error('An error occurred while ending Mongoose session. The error was:', error)
                        }).finally(() => {
                            return resolve(HTTPWTHandler.OK('Follow request accepted.'))
                        })
                    }).catch(error => {
                        session.abortTransaction().catch(error => {
                            console.error('An error occurred while aborting Mongoose transaction. The error was:', error)
                        }).finally(() => {
                            session.endSession().catch(error => {
                                console.error('An error occurred while ending Mongoose session. The error was:', error)
                            }).finally(() => {
                                console.error('An error occurred while making the following bulkWrite database updates on the User collection:', dbUpdates, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while accepting the follow request. Please try again.'))
                            })
                        })
                    })
                }).catch(error => {
                    console.error('An error occurred while starting a Mongoose session. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while accepting follow request. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #removefollowerfromaccount = (userId, userToRemovePubId) => {
        return new Promise(resolve => {
            if (typeof userToRemovePubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userToRemovePubId must be a string. Provided type: ${typeof userToRemovePubId}`))
            }
        
            if (userToRemovePubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('userToRemovePubId cannot be a blank string.'))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }

                if (!userFound.followers.includes(userToRemovePubId)) {
                    return resolve(HTTPWTHandler.notFound("This user doesn't follow you"))
                }
        
                User.findOne({secondId: {$eq: userToRemovePubId}}).lean().then(userToRemoveFound => {
                    if (!userToRemoveFound) {
                        User.findOneAndUpdate({_id: {$eq: userId}}, {$pull: {followers: userToRemovePubId}}).then(() => {
                            return resolve(HTTPWTHandler.OK('Follower has been removed.'))
                        }).catch(error => {
                            console.error('An error occurred while pulling:', userToRemovePubId, 'from the followers list for user with id:', userId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while removing follower. Please try again.'))
                        })
                    }
        
                    const dbUpdates = [
                        {
                            updateOne: {
                                filter: {_id: {$eq: userId}},
                                update: {$pull: {followers: userToRemovePubId}}
                            }
                        },
                        {
                            updateOne: {
                                filter: {secondId: {$eq: userToRemovePubId}},
                                update: {$pull: {following: userFound.secondId}}
                            }
                        }
                    ]

                    mongoose.startSession().then(session => {
                        session.startTransaction();

                        User.bulkWrite(dbUpdates, {session}).then(() => session.commitTransaction()).then(() => {
                            session.endSession().catch(error => {
                                console.error('An error occurred while ending Mongoose session. The error was:', error)
                            }).finally(() => {
                                return resolve(HTTPWTHandler.OK('Follower has been removed.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while making a bulkWrite operation to the database on the User collection and committing transaction. The dbUpdates to be made were:', dbUpdates, '. The error was:', error)
                            session.abortTransaction().catch(error => {
                                console.error('An error occurred while aborting Mongoose transaction. The error was:', error)
                            }).finally(() => {
                                session.endSession().catch(error => {
                                    console.error('An error occurred while ending Mongoose session. The error was:', error)
                                }).finally(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while removing follower. Please try again.'))
                                })
                            })
                        })
                    }).catch(error => {
                        console.error('An error occurred while starting Mongoose session. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while removing follower. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one user with secondId:', userToRemovePubId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user to remove. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #blockaccount = (userId, userToBlockPubId) => {
        return new Promise(resolve => {
            if (typeof userToBlockPubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userToBlockPubId must be a string. Provided type: ${typeof userToBlockPubId}`))
            }
        
            if (userToBlockPubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('userToBlockPubId cannot be an empty string.'))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('User with provided userId could not be found'))
                }
        
                User.findOne({secondId: {$eq: userToBlockPubId}}).lean().then(userToBlockFound => {
                    if (!userToBlockFound) {
                        return resolve(HTTPWTHandler.notFound('User to block could not be found'))
                    }
        
                    const dbUpdates = [
                        {
                            updateOne: {
                                filter: {_id: {$eq: userId}},
                                update: {$pull: {followers: userToBlockFound.secondId}, $push: {blockedAccounts: userToBlockFound.secondId}}
                            }
                        },
                        {
                            updateOne: {
                                filter: {secondId: {$eq: userToBlockPubId}},
                                update: {$pull: {following: userFound.secondId}}
                            }
                        }
                    ]

                    mongoose.startSession().then(session => {
                        session.startTransaction();

                        User.bulkWrite(dbUpdates, {session}).then(() => session.commitTransaction()).then(() => {
                            session.endSession().catch(error => {
                                console.error('An error occurred while ending Mongoose session. The error was:', error)
                            }).finally(() => {
                                return resolve(HTTPWTHandler.OK('Blocked user.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while making a bulkWrite operation on the User collection. The database updates were:', dbUpdates, '. The error was:', error)
                            session.abortTransaction().catch(error => {
                                console.error('An error occurred while aborting Mongoose transaction. The error was:', error)
                            }).finally(() => {
                                session.endSession().catch(error => {
                                    console.error('An error occurred while ending Mongoose session. The error was:', error)
                                }).finally(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while blocking user. Please try again.'))
                                })
                            })
                        })
                    }).catch(error => {
                        console.error('An error occurred while starting Mongoose session. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while blocking an account. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one user with secondId:', userToBlockPubId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user to block. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getuserblockedaccounts = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (userFound) {
                    return resolve(HTTPWTHandler.OK('Found blocked accounts', userFound?.blockedAccounts || []))
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #unblockaccount = (userId, userToUnblockPubId) => {
        return new Promise(resolve => {
            if (typeof userToUnblockPubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userToUnblockPubId must be a string. Provided type: ${typeof userToUnblockPubId}`))
            }
        
            if (userToUnblockPubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('userToUnblockPubId must not be an empty string.'))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (userFound) {
                    User.findOneAndUpdate({_id: {$eq: userId}}, {$pull: {blockedAccounts: userToUnblockPubId}}).then(() => {
                        return resolve(HTTPWTHandler.OK('User has been unblocked.'))
                    }).catch(error => {
                        console.error('An error occurred while pulling:', userToUnblockPubId, 'from:', 'blockedAccounts', 'for user with id:', userId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while unblocking user. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with userId provided.'))
                }
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #enableAlgorithm = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with userId provided'))
                }
        
                let newSettings = {...userFound.settings};
                newSettings.algorithmSettings.enabled = true;
                User.findOneAndUpdate({_id: {$eq: userId}}, {settings: newSettings}).then(() => {
                    return resolve(HTTPWTHandler.OK('Algorithm has now been enabled.'))
                }).catch(error => {
                    console.error('An error occurred while updating settings for user with id:', userId, '. The old settings were:', userFound.settings, ' The new settings are:', newSettings, '. The error was:', error)
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getAuthenticationFactorsEnabled = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
        
                return resolve(HTTPWTHandler.OK('Authentication factors found.', {authenticationFactorsEnabled: userFound.authenticationFactorsEnabled, MFAEmail: userFound.MFAEmail ? blurEmailFunction(userFound.MFAEmail) : null}))
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #disableAlgorithm = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
        
                let newSettings = {...userFound.settings}
                newSettings.algorithmSettings.enabled = false;

                User.findOneAndUpdate({_id: {$eq: userId}}, {settings: newSettings}).then(() => {
                    return resolve(HTTPWTHandler.OK('Algorithm has now been disabled.'))
                }).catch(error => {
                    console.error('An error occurred while updating algorithm settings for user with id:', userId, ' Old settings:', userFound.settings, 'New settings:', newSettings, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while disabling algorithm. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #reloadProfileEssentials = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
        
                const sendBackForReload = userHandler.filterUserInformationToSend(userFound)
                return resolve(HTTPWTHandler.OK('Reload Information Successful.', sendBackForReload))
            }).catch(err => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #turnOffEmailMultiFactorAuthentication = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (userFound) {
                    User.findOneAndUpdate({_id: {$eq: userId}}, {$pull: {authenticationFactorsEnabled: 'Email'}, $unset: {MFAEmail: "this removes the MFAEmail field"}}).then(function() {
                        var emailData = {
                            from: process.env.SMTP_EMAIL,
                            to: userFound.email,
                            subject: "Email Multi-Factor Authentication Turned Off",
                            text: `Email Multi-Factor authentication has now been turned off for your account. If you did not request for this to happen, someone else may be logged into your account. If so, change your password immediately.`,
                            html: `<p>Email Multi-Factor authentication has now been turned off for your account. If you did not request for this to happen, someone else may be logged into your account. If so, change your password immediately.</p>`
                        };
        
                        mailTransporter.sendMail(emailData, function(error, response) {
                            if (error) {
                                console.error('An error occured while sending an email to user with ID:', userId, '. The error was:', error, ' The emailData was:', emailData)
                            }
                        })

                        return resolve(HTTPWTHandler.OK('Email multi-factor authentication has been turned off successfully.'))
                    }).catch(error => {
                        console.error('An error occurred while pulling:', 'Email', 'from:', 'authenticationFactorsEnabled', 'and unsetting the field:', 'MFAEmail', 'for user with id:', userId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while turning off email multi-factor authentication. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('User not found.'))
                }
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #deleteaccount = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('User with provided userId could not be found'))
                }
        
                PopularPosts.findOne({}).lean().then(async popularPostDocument => {
                    const popularPosts = popularPostDocument.popularPosts
                    const newPopularPosts = popularPosts.filter(post => post.creatorId.toString() !== userId)

                    Promise.all([
                        ImagePost.find({creatorId: {$eq: userId}}, 'imageKey').lean(),
                        Thread.find({creatorId: {$eq: userId}}, 'threadImageKey threadType').lean(),
                        Poll.find({creatorId: {$eq: userId}}, '_id').lean()
                    ]).then(([imagePosts, threadPosts, pollPosts]) => {
                        const imageKeys = imagePosts.map(post => post.imageKey)
                        const threadImageKeys = threadPosts.filter(post => post.threadType === "Images").map(post => post.threadImageKey)
                        const pollPostIds = pollPosts.map(post => String(post._id))

                        mongoose.startSession().then(session => {
                            session.startTransaction()
    
                            Promise.all([
                                popularPosts.length !== newPopularPosts.length ? PopularPosts.findOneAndUpdate({}, {popularPosts: newPopularPosts}, {session}) : Promise.resolve('Popular posts do not need to be updated'),
                                userFound?.profileImageKey ? fs.promises.unlink(path.resolve(process.env.UPLOADED_PATH, userFound.profileImageKey)) : Promise.resolve('Profile Image Deleted'),
                                ...imageKeys.map(key => fs.promises.unlink(path.resolve(process.env.UPLOADED_PATH, key))),
                                ImagePost.deleteMany({creatorId: {$eq: userId}}, {session}),
                                Poll.deleteMany({creatorId: {$eq: userId}}, {session}),
                                PollVote.deleteMany({userId: {$eq: userId}}, {session}),
                                PollVote.deleteMany({postId: {$in: pollPostIds}}, {session}),
                                ...threadImageKeys.map(key => fs.promises.unlink(path.resolve(process.env.UPLOADED_PATH, key))),
                                Thread.deleteMany({creatorId: {$eq: userId}}, {session}),
                                Message.deleteMany({senderId: {$eq: userId}}, {session}),
                                User.bulkWrite([
                                    {
                                        updateMany: {
                                            filter: {followers: userFound.secondId},
                                            update: {$pull: {followers: userFound.secondId}}
                                        }
                                    },
                                    {
                                        updateMany: {
                                            filter: {following: userFound.secondId},
                                            update: {$pull: {following: userFound.secondId}}
                                        }
                                    },
                                    {
                                        updateMany: {
                                            filter: {blockedAccounts: userFound.secondId},
                                            update: {$pull: {blockedAccounts: userFound.secondId}}
                                        }
                                    },
                                    {
                                        updateMany: {
                                            filter: {accountFollowRequests: userFound.secondId},
                                            update: {$pull: {accountFollowRequests: userFound.secondId}}
                                        }
                                    },
                                    {
                                        deleteOne: {
                                            filter: {_id: {$eq: userId}},
                                        }
                                    }
                                ], {session}),
                                Downvote.deleteMany({userPublicId: userFound.secondId}, {session}),
                                Upvote.deleteMany({userPublicId: userFound.secondId}, {session}),
                                AccountReports.deleteMany({reporterId: {$eq: userId}}, {session}),
                                PostReports.deleteMany({reporterId: {$eq: userId}}, {session}),
                                RefreshToken.deleteMany({userId: {$eq: userId}}, {session}),
                                Category.updateMany({}, {$pull: {members: userId}}, {session}),
                            ]).then(() => session.commitTransaction()).then(() => {
                                console.log('User with id:', userId, 'has been successfully deleted along with all associated data.')
                                session.endSession().catch(error => {
                                    console.error('An error occurred while ending session after deleting account. The error was:', error)
                                }).finally(() => {
                                    return resolve(HTTPWTHandler.OK('Successfully deleted account and all associated data.'))
                                })
                            }).catch(error => {
                                session.abortTransaction().catch(error => {
                                    console.error('An error occurred while aborting transaction after deleting account. The error was:', error)
                                }).finally(() => {
                                    session.endSession().catch(error => {
                                        console.error('An error occurred while ending session after deleting account data. The error was:', error)
                                    }).finally(() => {
                                        console.error('An error occured while deleting account data for user with id:', userId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting data. Please try again.'))
                                    })
                                })
                            })
                        }).catch(error => {
                            console.log('An error occurred while starting Mongoose session. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while deleting account. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while getting posts with images before deleting account. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding images to delete. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding popular posts. The error was:', error)
                    return resolve(HTPWTHandler.serverError('An error occurred while finding popular posts. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occured while finding user with id:', userID + '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #checkIfCategoryExists = (categoryTitle) => {
        return new Promise(resolve => {
            Category.exists({categoryTitle: {'$regex': `^${categoryTitle}$`, $options: 'i'}}).then(category => {
                if (category) {
                    return resolve(HTTPWTHandler.OK(true))
                } else {
                    return resolve(HTTPWTHandler.OK(false))
                }
            }).catch(error => {
                console.error('An error occured while checking if a category existed with title:', categoryTitle, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred. Please try again.'))
            })
        })
    }

    static #uploadNotificationsSettings = (userId, notificationSettings) => {
        return new Promise(resolve => {
            if (typeof notificationSettings !== 'object' || notificationSettings === null || Array.isArray(notificationSettings)) {
                return resolve(HTTPWTHandler.badInput(`notificationSettings must be an object. Is null: ${notificationSettings === null} Is array: ${Array.isArray(notificationSettings)} Type provided: ${typeof notificationSettings}`))
            }
        
            const allowedKeys = [
                'GainsFollower'
            ]
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (userFound) {
                    for (let [key, value] of Object.entries(notificationSettings)) {
                        if (!allowedKeys.includes(key) || typeof value !== 'boolean') {
                            delete notificationSettings[key]
                        }
                    }
        
                    const newUserSettings = {
                        ...userFound.settings,
                        notificationSettings: {
                            ...userFound.settings.notificationSettings,
                            ...notificationSettings
                        }
                    }
        
                    User.findOneAndUpdate({_id: {$eq: userID}}, {settings: newUserSettings}).then(function() {
                        return resolve(HTTPWTHandler.OK('Notification settings updated successfully.'))
                    }).catch(error => {
                        console.error('An error occured while changing notification settings for user with ID:', userId, '. The error was:', error);
                        return resolve(HTTPWTHandler.serverError('An error occurred while updating notification settings.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('User not found.'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with ID:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getUserNotificationSettings = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('User with provided userId could not be found'))
                }
        
                const toSend = {...DEFAULTS.userNotificationSettings, ...userFound?.settings?.notificationSettings || {}}
        
                return resolve(HTTPWTHandler.OK('Notification settings retrieved successfully.', toSend))
            }).catch(error => {
                console.error('An error occurred while finding user with ID:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #reportUser = (reporterId, reportType, reporteePubId) => {
        return new Promise(resolve => {
            if (typeof reporteePubId !== 'string') {
                return resolve(HTPTWTHandler.badInput(`reporteePubId must be a string. Provided type: ${typeof reporteePubId}`))
            }
        
            if (reporteePubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('reporteePubId cannot be a blank string.'))
            }
        
            if (typeof reportType !== 'object' || Array.isArray(reportType) || reportType === null) {
                return resolve(HTTPWTHandler.badInput(`reportType must be an object. Is array: ${Array.isArray(reportType)} Is null: ${reportType === null} Provided type: ${typeof reportType}`))
            }
        
            if (!Object.hasOwn(reportType, 'topic')) {
                return resolve(HTTPWTHandler.badInput(`reportType object must have a topic key`))
            }
        
            if (!Object.hasOwn(reportType, 'subTopic')) {
                return resolve(HTTPWTHandler.badInput(`reportType object must have a subTopic key`))
            }
        
            if (!DEFAULTS.validReportOptions[reportType?.topic]?.includes(reportType?.subTopic)) {
                return resolve(HTTPWTHandler.badInput('Invalid report options provided.'))
            }
        
            User.findOne({_id: {$eq: reporterId}}).lean().then(reporterFound => {
                if (!reporterFound) {
                    return resolve(HTTPWTHandler.notFound('User could not be found with provided userId'))
                }
        
                User.findOne({secondId: {$eq: reporteePubId}}).lean().then(reporteeFound => {
                    if (!reporteeFound) {
                        return resolve(HTTPWTHandler.notFound('Could not find user to report.'))
                    }
        
                    if (String(reporterFound._id) === String(reporteeFound._id)) {
                        return resolve(HTTPWTHandler.forbidden('You cannot report yourself'))
                    }
        
                    console.log(`Valid report passed by: ${reporterFound.name} about ${reporteeFound.name} with the reasoning being: ${reportType.topic}-${reportType.subTopic}`)
        
                    const report = {
                        reportedAccountPubId: reporteePubId,
                        reporterId: reporterId,
                        topic: reportType.topic,
                        subTopic: reportType.subTopic
                    }
        
                    const newUserReport = new AccountReports(report)
                    
                    newUserReport.save().then(() => {
                        return resolve(HTTPWTHandler.OK('Successfully sent report'))
                    }).catch(error => {
                        console.error('An error occurred while saving user report. The report was:', report, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while saving account report. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one user with secondId:', reporteePubId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user to report. Please try again later.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', reporterId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again later.'))
            })
        })
    }

    static #getUserActivity = (userId, skip, voteType, postFormat) => {
        return new Promise(async resolve => {
            let userFound;
            let posts;
            let votes;
            let creators;
            let promises;

            if (typeof skip !== 'string' && skip !== undefined) {
                return resolve(HTTPWTHandler.badInput(`skip must be a string or undefined. Provided type: ${typeof skip}`))
            }

            if (voteType !== 'down' && voteType !== 'up') {
                return resolve(HTTPWTHandler.badInput('voteType must be either "down" or "up"'))
            }

            const supportedPostFormats = ['Image', 'Poll', 'Thread']

            if (!supportedPostFormats.includes(postFormat)) {
                return resolve(HTTPWTHandler.badInput('Post type is not a valid post type'))
            }

            try {
                userFound = await User.findOne({_id: {$eq: userId}}).lean()
            } catch (error) {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            }

            const votesDBQuery = {
                userPublicId: {$eq: userFound.secondId},
                postFormat: {$eq: postFormat}
            }

            if (skip !== undefined) {
                votesDBQuery._id = {$lt: new mongoose.Types.ObjectId(skip)}
            }

            console.log('Votes DB Query:', votesDBQuery)

            if (voteType === 'up') {
                try {
                    votes = await Upvote.find(votesDBQuery).sort({_id: -1}).limit(CONSTANTS.GET_USER_ACTIVITY_API_LIMIT).lean()
                } catch(error) {
                    console.error('An error occurred while finding all upvotes with a votesDBQuery of:', votesDBQuery, 'and a limit of:', CONSTANTS.GET_USER_ACTIVITY_API_LIMIT, ', and sorting by _id of -1. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding upvotes. Please try again.'))
                }
            } else {
                try {
                    votes = await Downvote.find(votesDBQuery).sort({_id: -1}).limit(CONSTANTS.GET_USER_ACTIVITY_API_LIMIT).lean()
                } catch(error) {
                    console.error('An error occurred while finding all downvotes with a votesDBQuery of:', votesDBQuery,  'and a limit of:', CONSTANTS.GET_USER_ACTIVITY_API_LIMIT, ', and sorting by _id of -1. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding downvotes. Please try again.'))
                }
            }

            const lastVoteId = votes.length > 0 ? votes[votes.length - 1]._id.toString() : null
            const noMoreVotes = votes.length < CONSTANTS.GET_USER_ACTIVITY_API_LIMIT

            const postIds = votes.map(vote => vote.postId)

            if (postFormat === 'Image') {
                try {
                    posts = await ImagePost.find({_id: {$in: postIds}}).lean()
                } catch(error) {
                    console.error('An error occurred while finding image posts with _ids that are $in:', postIds, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding image posts. Please try again.'))
                }
            } else if (postFormat === 'Poll') {
                try {
                    posts = await Poll.find({_id: {$in: postIds}}).lean()
                } catch(error) {
                    console.error('An error occurred while finding poll posts with _ids that are $in:', postIds, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll posts. Please try again.'))
                }
            } else if (postFormat === 'Thread') {
                try {
                    posts = await Thread.find({_id: {$in: postIds}}).lean()
                } catch(error) {
                    console.error('An error occurred while finding thread posts with _ids that are $in:', postIds, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding thread posts. Please try again.'))
                }
            }

            const uniqueCreators = Array.from(new Set(posts.map(post => post.creatorId)))


            try {
                creators = await User.find({_id: {$in: uniqueCreators}}).lean()
            } catch(error) {
                console.error('An error occurred while finding users with _ids $in:', uniqueCreators, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding users. Please try again.'))
            }

            const creatorObject = {};
            const postsObject = {};

            creators.forEach(creator => {
                const stringifiedUserId = String(creator._id)

                if (creator.privateAccount === true && !creator.followers.includes(userFound.secondId)) {
                    creatorObject[stringifiedUserId] = 'PRIVATE'
                }

                if (creator.blockedAccounts?.includes(userFound.secondId)) {
                    creatorObject[stringifiedUserId] = 'BLOCKED'
                }

                creatorObject[stringifiedUserId] = creator;
            })

            for (const post of posts) {
                const stringifiedCreatorId = String(post.creatorId)

                if (!creatorObject[stringifiedCreatorId]) {
                    console.error('Found an', postFormat, 'post with an id of:', post._id, 'that belongs to user with id:', post.creatorId, '. This user could not be found in the database and as such this post should get deleted immediately.')
                    continue;
                }

                if (creatorObject[stringifiedCreatorId] === 'PRIVATE' || creatorObject[stringifiedCreatorId] === 'BLOCKED') {
                    continue;
                }

                if (!Array.isArray(postsObject[stringifiedCreatorId])) {
                    postsObject[stringifiedCreatorId] = []
                }

                postsObject[stringifiedCreatorId].push(post)
            }

            if (postFormat === 'Image') {
                promises = Object.entries(postsObject).map(([key, value]) => imagePostHandler.processMultiplePostDataFromOneOwner(value, creatorObject[key], userFound))
            } else if (postFormat === 'Poll') {
                promises = Object.entries(postsObject).map(([key, value]) => pollPostHandler.processMultiplePostDataFromOneOwner(value, creatorObject[key], userFound))
            } else if (postFormat === 'Thread') {
                promises = Object.entries(postsObject).map(([key, value]) => threadPostHandler.processMultiplePostDataFromOneOwner(value, creatorObject[key], userFound))
            }

            Promise.all(promises).then(arrays => {
                const toSend = {
                    posts: [].concat(...arrays),
                    lastVoteId,
                    noMoreVotes
                }

                return resolve(HTTPWTHandler.OK(`Successfully found ${postFormat.toLowerCase()} posts ${skip} - ${skip + toSend.length}`, toSend))
            }).catch(error => {
                console.error('An error occurred while processing image posts. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while processing image posts. Please try again.'))
            })
        })
    }

    static #getCategoriesUserIsAPartOf = (userId, skip) => {
        return new Promise(resolve => {
            skip = parseInt(skip)
            if (isNaN(skip)) {
                return resolve(HTTPWTHandler.badInput('skip must be a number (integer)'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }

                Category.find({members: userId}).sort({dateCreated: -1}).skip(skip).limit(CONSTANTS.NUM_CATEGORIES_TO_SEND_PER_API_CALL).lean().then(categoriesFound => {
                    return resolve(HTTPWTHandler.OK(`Successfully found categories ${skip} - ${skip + categoriesFound.length}`, categoriesFound))
                }).catch(error => {
                    console.error('An error occured while finding what categories user with id:', userId, 'is part of. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding what categories you are a part of. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #reportPost = (reporterId, postId, postFormat, reason) => {
        return new Promise(async resolve => {
            let post;

            if (typeof reason !== 'string') {
                return resolve(HTTPWTHandler.badInput(`reason must be a string. Provided type: ${typeof reason}`))
            }
        
            reason = reason.trim()
        
            if (reason.length === 0) {
                return resolve(HTTPWTHandler.badInput('You cannt leave the reason blank.'))
            }
        
            try {
                if (await User.findOne({_id: {$eq: reporterId}}) == null) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            } catch (error) {
                console.error('An error occured while finding a user with id: ', reporterId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            }

            const supportedFormats = ['Image', 'Poll', 'Thread']

            if (!supportedFormats.includes(postFormat)) {
                return resolve(HTTPWTHandler.badInput('Invalid post format supplied'))
            }

            if (postFormat === 'Image') {
                try {
                    post = await ImagePost.findOne({_id: {$eq: postId}}).lean()
                } catch (error) {
                    console.error('An error occurred while finding one image post with id:', postId)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding one image post. Please try again.'))
                }
            } else if (postFormat === 'Poll') {
                try {
                    post = await Poll.findOne({_id: {$eq: postId}}).lean()
                } catch(error) {
                    console.error('An error occurred while finding one poll post with id:', postId)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll post. Please try again.'))
                }
            } else if (postFormat === 'Thread') {
                try {
                    post = await Thread.findOne({_id: {$eq: postId}}).lean()
                } catch (error) {
                    console.error('An error occurred while finding one thread post with id:', postId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding thread post. Please try again.'))
                }
            }

            if (!post) {
                return resolve(HTTPWTHandler.notFound('Could not find post.'))
            }

            PostReports.findOne({postId: {$eq: postId}, format: {$eq: postFormat}, reporterId: {$eq: reporterId}}).lean().then(report => {
                if (report) {
                    return resolve(HTTPWTHandler.forbidden('You have already made a report for this post.'))
                }

                const newReport = new PostReports({
                    postId,
                    format: postFormat,
                    reason,
                    reporterId
                })

                newReport.save().then(() => {
                    return resolve(HTTPWTHandler.OK('Post has successfully been reported'))
                }).catch(error => {
                    console.error('An error occurred while reporting', postFormat, 'post with id:', postId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while submitting report. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding post report with postId:', postId, ', format:', postFormat, 'and reporterId:', reporterId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while checking if you have already reported this post before. Please try again.'))
            })
        })
    }

    static #userAlgorithmSettings = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
        
                const toSend = {...DEFAULTS.userAlgorithmSettings, ...userFound?.settings?.algorithmSettings || {}}
        
                return resolve(HTTPWTHandler.OK('Algorithm settings retrieved successfully.', toSend))
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #uploadAlgorithmSettings = (userId, algorithmSettings) => {
        return new Promise(resolve => {
            if (typeof algorithmSettings !== 'object') {
                return resolve(HTTPWTHandler.badInput(`algorithmSettings must be an object. Provided type: ${typeof algorithmSettings}`))
            }
        
            if (Array.isArray(algorithmSettings)) {
                return resolve(HTTPWTHandler.badInput('algorithmSettings must be an object. Provided was an array.'))
            }
        
            if (algorithmSettings === null) {
                return resolve(HTTPWTHandler.badInput('algorithmSettings must be an object. Provided was null.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (userFound) {
                    let newUserSettings = userFound.settings;
                    let newAlgorithmSettings = newUserSettings.algorithmSettings;
                    if (typeof algorithmSettings.algorithmEnabled == 'boolean') {
                        newAlgorithmSettings.algorithmEnabled = algorithmSettings.algorithmEnabled;
                    }
                    if (typeof algorithmSettings.useUserUpvoteData == 'boolean') {
                        newAlgorithmSettings.useUserUpvoteData = algorithmSettings.useUserUpvoteData;
                    }
                    if (typeof algorithmSettings.useUserDownvoteData == 'boolean') {
                        newAlgorithmSettings.useUserDownvoteData = algorithmSettings.useUserDownvoteData;
                    }
                    if (typeof algorithmSettings.useUserFollowingData == 'boolean') {
                        newAlgorithmSettings.useUserFollowingData = algorithmSettings.useUserFollowingData;
                    }
                    newUserSettings.algorithmSettings = newAlgorithmSettings;
        
                    User.findOneAndUpdate({_id: {$eq: userId}}, {settings: newUserSettings}).then(function() {
                        return resolve(HTTPWTHandler.OK('Algorithm settings updated successfully.'))
                    }).catch(error => {
                        console.error('An error occured while changing settings for user with ID:', userId, 'The new settings are:', newUserSettings, '. Only algorithm settings got changed. These are the new algorithm settings:', newAlgorithmSettings, '. The error was:', error);
                        return resolve(HTTPWTHandler.serverError('An error occurred while updating algorithm settings. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while trying to find the user. Please try again.'))
            })
        })
    }

    static #privacySettings = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(user => {
                if (user) {
                    const privacySettings = {...DEFAULTS.userPrivacySettings, ...user?.settings?.privacySettings};
                    return resolve(HTTPWTHandler.OK('Sent privacy settings', privacySettings))
                } else {
                    return resolve(HTTPWTHandler.notFound('User not found'))
                }
            }).catch(error => {
                console.error('An error occured while getting user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #savePrivacySettings = (userId, settings) => {
        return new Promise(resolve => {
            if (typeof settings !== 'object') {
                return resolve(HTTPWTHandler.badInput(`settings must be an object. Provided type: ${typeof settings}`))
            }
        
            if (Array.isArray(settings)) {
                return resolve(HTTPWTHandler.badInput('Settings must be an object. Provided was an array.'))
            }
        
            if (settings === null) {
                return resolve(HTTPWTHandler.badInput('Settings must be an object. Provided was null.'))
            }
        
            const allowedKeys = Object.keys(CONSTANTS.PRIVACY_SETTINGS_ALLOWED_VALUES)
        
            for (let [key, value] of Object.entries(settings)) {
                if (!allowedKeys.includes(key) || !CONSTANTS.PRIVACY_SETTINGS_ALLOWED_VALUES[key].includes(value)) {
                    console.log('Deleting key:', key, '  value:', value, '  from /tempRoute/savePrivacySettings')
                    delete settings[key]
                }
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(user => {
                if (user) {
                    const newPrivacySettings = {
                        ...user?.settings?.privacySettings,
                        ...settings
                    }
        
                    const newSettings = {
                        ...user.settings,
                        privacySettings: newPrivacySettings
                    }
        
                    User.findOneAndUpdate({_id: {$eq: userId}}, {settings: newSettings}).then(() => {
                        return resolve(HTTPWTHandler.OK('Successfully updated privacy settings'))
                    }).catch(error => {
                        console.error('An error occured while updating privacy settings for user with id:', userId, 'The new privacy settings are:', newPrivacySettings, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while updating privacy settings. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with userId provided.'))
                }
            }).catch(error => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding the user. Please try again.'))
            })
        })
    }

    static #getProfileStats = (userId, profilePublicId, skip, stat) => {
        return new Promise(resolve => {
            const allowedStats = ['following', 'followers']

            if (!allowedStats.includes(stat)) {
                return resolve(HTTPWTHandler.badInput('Invalid stat provided'))
            }

            if (typeof skip !== 'number') {
                return resolve(HTTPWTHandler.badInput(`skip must be a number. Provided type: ${typeof skip}`))
            }

            if (typeof profilePublicId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`profilePublicId must be a string. Provided type: ${typeof profilePublicId}`))
            }

            if (profilePublicId.length == 0) {
                return resolve(HTTPWTHandler.badInput('profilePublicId cannot be an empty string.'))
            }

            const sendItemsToUser = (array, userRequesting) => {
                const limit = CONSTANTS.NUM_USERS_TO_SEND_PER_PROFILE_STATS_API_CALL;
                const {items, noMoreItems} = arrayHelper.returnSomeItems(array, skip, limit)

                User.find({secondId: {$in: items}}).lean().then(items => {
                    const newItems = [];
                    for (let i = 0; i < items.length; i++) {
                        newItems.push(userHandler.returnPublicInformation(items[i], userRequesting))
                    }

                    return resolve(HTTPWTHandler.OK('Successfully retrieved data', {items: newItems, noMoreItems}))
                }).catch(error => {
                    console.error('An error occured while finding users with a secondId that is inside of an array. The array is:', items, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding users. Please try again.'))
                })
            }

            const wrongPermissions = (stat) => {
                return resolve(HTTPWTHandler.forbidden(`User's privacy settings do not allow you to see ${stat === 'following' ? 'who they follow' : 'who follows them'}`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userRequesting => {
                if (userRequesting) {
                    User.findOne({secondId: {$eq: profilePublicId}}).lean().then(profileRequested => {
                        if (profileRequested) {
                            const setting = stat == 'following' ? profileRequested?.settings?.privacySettings?.viewFollowing || 'followers' : profileRequested?.settings?.privacySettings?.viewFollowers || 'followers'
                            console.log('Settings is:', setting)

                            if (String(userId) === String(profileRequested._id) || setting === 'everyone') {
                                return sendItemsToUser(stat == 'following' ? profileRequested.following : profileRequested.followers, userRequesting)
                            }

                            if (setting == 'no-one') {
                                return wrongPermissions(stat)
                            }

                            //Setting must be followers since if they were no-one or everyone the code would've returned by now
                            const pubIdIndex = profileRequested.followers.findIndex(x => x === userRequesting.secondId);
                            const isFollower = pubIdIndex !== -1;
                            console.log('isFollower:', isFollower, '   |   pubIdIndex:', pubIdIndex)

                            if (isFollower) {
                                return sendItemsToUser(stat == 'following' ? profileRequested.following : profileRequested.followers, userRequesting)
                            } else {
                                return wrongPermissions(stat)
                            }
                        } else {
                            return resolve(HTTPWTHandler.notFound('Could not find requested profile'))
                        }
                    }).catch(error => {
                        console.error('An error occured while finding user with secondId:', profilePublicId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
            }).catch(error => {
                console.error('An error occured while finding user with id:', userRequestingId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding the user. Please try again.'))
            })
        })
    }

    static #loginactivity = (userId, authRefreshTokenHeader) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with userId provided.'))
                }
        
                RefreshToken.find({admin: false, userId}).lean().then(encryptedRefreshTokens => {
                    const refreshTokens = []
        
                    for (let i = 0; i < encryptedRefreshTokens.length; i++) {
                        let decryptedToken = `Bearer ${refreshTokenDecryption(encryptedRefreshTokens[i].encryptedRefreshToken)}`
                        if (decryptedToken == authRefreshTokenHeader) {
                            refreshTokens.unshift({refreshTokenId: String(encryptedRefreshTokens[i]._id), currentDevice: true, location: encryptedRefreshTokens[i].location, IP: encryptedRefreshTokens[i].IP, deviceType: encryptedRefreshTokens[i].deviceType, loginTime: encryptedRefreshTokens[i].createdAt})
                        } else {
                            refreshTokens.push({refreshTokenId: String(encryptedRefreshTokens[i]._id), currentDevice: false, location: encryptedRefreshTokens[i].location, IP: encryptedRefreshTokens[i].IP, deviceType: encryptedRefreshTokens[i].deviceType, loginTime: encryptedRefreshTokens[i].createdAt})
                        }
                    }
        
                    return resolve(HTTPWTHandler.OK('Found devices logged in to your account', refreshTokens))
                }).catch(error => {
                    console.error('An error occurred while finding refresh tokens with admin set to false and userId set to:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding refresh tokens. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #logoutdevice = (userId, tokenToLogout) => {
        return new Promise(resolve => {
            if (typeof tokenToLogout !== 'string') {
                return resolve(HTTPWTHandler.badInput(`tokenToLogout must be a string. Provided type: ${typeof tokenToLogout}`))
            }
        
            if (tokenToLogout.length == 0) {
                return resolve(HTTPWTHandler.badInput('tokenToLogout cannot be an empty string.'))
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('User could not be found with provided userId'))
                }
        
                RefreshToken.deleteOne({userId: {$eq: userId}, admin: false, _id: {$eq: tokenToLogout}}).then(result => {
                    if (result.deletedCount === 1) {
                        return resolve(HTTPWTHandler.OK('Successfully logged device out of your account.'))
                    } else {
                        return resolve(HTTPWTHandler.notFound('Could not find refresh token.'))
                    }
                }).catch(error => {
                    console.error('An error occurred while deleting one refresh token with userId set to:', userId, ', admin set to false, and _id set to:', tokenToLogout, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while logging user out of account. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #logoutallotherdevices = (userId, tokenIdNotToLogout) => {
        return new Promise(resolve => {
            if (typeof tokenIdNotToLogout !== 'string' && tokenIdNotToLogout !== null) {
                return HTTPWTHandler.badInput(`tokenIdNotToLogout must be a string or null. Provided type: ${typeof tokenIdNotToLogout}`)
            }
        
            const query = {userId: {$eq: userId}};
        
            if (typeof tokenIdNotToLogout === 'string') {
                query._id = {$ne: tokenIdNotToLogout}
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with userId provided.'))
                }
        
                RefreshToken.deleteMany(query).then(() => {
                    return resolve(HTTPWTHandler.OK('Successfully logged out all other devices out of your account'))
                }).catch(error => {
                    console.error('An error occurred while deleting all refresh tokens by this query:', query, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while logging all other devices out of your account. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #loginActivitySettings = (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('User with userId could not be found'))
                }

                const settings = {...DEFAULTS.userLoginActivitySettings, ...userFound?.settings?.loginActivitySettings || {}}

                return resolve(HTTPWTHandler.OK('Found settings', settings))
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #uploadLoginActivitySettings = (userId, newSettings) => {
        return new Promise(resolve => {
            if (typeof newSettings !== 'object') {
                return resolve(HTTPWTHandler.badInput(`newSettings must be an object. Provided type: ${typeof newSettings}`))
            }
        
            if (Array.isArray(newSettings)) {
                return resolve(HTTPWTHandler.badInput('newSettings must be an object. An array was provided.'))
            }
        
            if (newSettings === null) {
                return resolve(HTTPWTHandler.badInput('newSettings must be an object. null was provided.'))
            }
        
            const allowedKeys = Object.keys(CONSTANTS.LOGIN_ACTIVITY_SETTINGS_ALLOWED_VALUES)
        
            for (const key of Object.keys(newSettings)) {
                if (!allowedKeys.includes(key) || !CONSTANTS.LOGIN_ACTIVITY_SETTINGS_ALLOWED_VALUES[key].includes(newSettings[key])) {
                    delete newSettings[key];
                }
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.badInput('User could not be found with provided userId'))
                }
        
                const loginActivitySettingsToSet = {...userFound?.settings?.loginActivitySettings || {}, ...newSettings}
                const settingsToSet = {...userFound?.settings || {}, loginActivitySettings: loginActivitySettingsToSet}
        
                User.findOneAndUpdate({_id: {$eq: userId}}, {settings: settingsToSet}).then(() => {
                    return resolve(HTTPWTHandler.OK('Changed settings successfully'))
                }).catch(error => {
                    console.error('An error occurred while updating user settings. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while updating login activity settings. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #updateLoginActivitySettingsOnSignup = (userId, newSettings, refreshTokenId, IP, deviceName) => {
        return new Promise(resolve => {
            if (typeof newSettings !== 'object') {
                return resolve(HTTPWTHandler.badInput(`newSettings must be an object. Provided type: ${typeof newSettings}`))
            }
        
            if (Array.isArray(newSettings)) {
                return resolve(HTTPWTHandler.badInput('newSettings must be an object. An array was provided.'))
            }
        
            if (newSettings === null) {
                return resolve(HTTPWTHandler.badInput('newSettings must be an object. null was provided.'))
            }
        
            if (typeof refreshTokenId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`refreshTokenId must be a string. Provided type: ${typeof refreshTokenId}`))
            }
        
            if (refreshTokenId.length == 0) {
                return resolve(HTTPWTHandler.badInput('refreshTokenId cannot be an empty string.'))
            }
        
            const allowedKeys = Object.keys(CONSTANTS.LOGIN_ACTIVITY_SETTINGS_ALLOWED_VALUES)
        
            for (const key of Object.keys(newSettings)) {
                if (!allowedKeys.includes(key) || !CONSTANTS.LOGIN_ACTIVITY_SETTINGS_ALLOWED_VALUES[key].includes(newSettings[key])) {
                    delete newSettings[key];
                }
            }
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.badInput('User could not be found with provided userId'))
                }
        
                const loginActivitySettingsToSet = {...userFound?.settings?.loginActivitySettings || {}, ...newSettings}
                const settingsToSet = {...userFound?.settings || {}, loginActivitySettings: loginActivitySettingsToSet}
        
                User.findOneAndUpdate({_id: {$eq: userId}}, {settings: settingsToSet}).then(() => {
                    const changesToMake = {}
        
                    if (loginActivitySettingsToSet.getIP) {
                        changesToMake.IP = HTTPHandler.formatIP(IP)
                    }
        
                    if (loginActivitySettingsToSet.getLocation) {
                        const location = geoIPLite.lookup(IP)
                        changesToMake.location = location.city + ', ' + location.country
                    }
        
                    if (loginActivitySettingsToSet.getDeviceType) {
                        changesToMake.deviceType = deviceName
                    }
        
                    RefreshToken.findOneAndUpdate({_id: {$eq: refreshTokenId}, userId: {$eq: userId}}, changesToMake).then(() => {
                        return resolve(HTTPWTHandler.OK('Successfully updated settings'))
                    }).catch(error => {
                        console.error('An error occurred while updating refresh token with id:', refreshTokenId, 'that belongs to user with id:', userId, '. The update was going to make these updates:', changesToMake, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while updating refresh token. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while updating user settings. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while updating login activity settings. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #followingFeedFilterSettings = async (userId) => {
        return new Promise(resolve => {
            User.findOne({_id: {$eq: userId}}, 'settings.followingFeedFilterSettings').then(projectedUserObject => {
                if (!projectedUserObject) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
        
                const toSend = {...projectedUserObject?.settings?.followingFeedFilterSettings || {}, ...DEFAULTS.userFollowingFeedFilterSettings}
        
                return resolve(HTTPWTHandler.OK('Found following feed filter settings', toSend))
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, 'with projection "settings.followingFeedFilterSettings". The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #logoutuser = (userId, refreshTokenId) => {
        return new Promise(resolve => {
            if (typeof refreshTokenId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`refreshTokenId must be a string. Type provided: ${typeof refreshTokenId}`))
            }
            
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('User could not be found'))


                RefreshToken.findOne({_id: {$eq: refreshTokenId}}).then(refreshToken => {
                    if (!refreshToken) return resolve(HTTPWTHandler.OK('Could not find refresh token. This device is already logged out.'))
                    if (String(refreshToken._id) !== refreshTokenId) return resolve(HTTPWTHandler.forbidden('You cannot remove a refresh token that does not belong to your account'))

                    RefreshToken.deleteOne({_id: {$eq: refreshTokenId}}).then(() => {
                        return resolve(HTTPWTHandler.OK('Successfully logged out of account'))
                    }).catch(error => {
                        console.error('An error occurred while deleting one refresh token with id:', refreshTokenId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while logging you out. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one refresh token with id:', refreshTokenId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding refresh token. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #deletecomment = (userId, commentId) => {
        return new Promise(resolve => {

            function deleteComment() {
                Comment.deleteOne({_id: {$eq: commentId}}).then(() => {
                    return resolve(HTTPWTHandler.OK('Comment has successfully been deleted'))
                }).catch(error => {
                    console.error('An error occurred while deleting one comment with id:', commentId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting comment. Please try again.'))
                })
            }

            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Type provided: ${typeof commentId}`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                Comment.findOne({_id: {$eq: commentId}}).lean(commentFound => {
                    if (String(commentFound.commenterId) !== userId) return resolve(HTTPWTHandler.unauthorized('You are not allowed to delete this comment.'))

                    if (!commentFound.parentCommentId) {
                        Comment.countDocuments({parentCommentId: commentId}).then(childrenCount => {
                            //If there are any children comments, the comments will be soft deleted.
                            //Their contents will be removed from the document (like text and user id)
                            //but the document will remain and will have a deleted: true property
                            //If there are no children comments, the comment document will be deleted

                            if (childrenCount === 0) {
                                deleteComment()
                            } else {
                                Comment.findOneAndUpdate({_id: {$eq: commentId}}, {$unset: {commenterId: "", text: "", datePosted: ""}, $set: {deleted: true}}).then(() => {
                                    return resolve(HTTPWTHandler.OK('Comment has successfully been deleted'))
                                }).catch(error => {
                                    console.error('An error occurred while soft deleting comment with id:', commentId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting comment. Please try again.'))
                                })
                            }
                        }).catch(error => {
                            console.error('An error occurred while counting Comment documents with parentCommentId:', commentId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding comment replies. Please try again.'))
                        })
                    } else {
                        Comment.findOne({_id: commentFound.parentCommentId}).then(parentComment => {
                            if (!parentComment || !parent.deleted) return deleteComment()

                            Comment.countDocuments({parentCommentId: commentFound.parentCommentId}).then(childrenCount => {
                                if (childrenCount <= 1) {
                                    mongoose.startSession().then(session => {
                                        session.startTransaction();
    
                                        Promise.all(
                                            Comment.deleteOne({_id: {$eq: commentFound.parentCommentId}}, {session}),
                                            Comment.deleteOne({_id: {$eq: commentId}}, {session})
                                        ).then(() => {
                                            session.commitTransaction().then(() => {
                                                session.endSession().catch(error => {
                                                    console.error('An error occurred while ending mongoose session:', error)
                                                }).finally(() => {
                                                    return resolve(HTTPWTHandler.OK('Comment has been successfully deleted.'))
                                                })
                                            }).catch(error => {
                                                session.endSession().catch(error => {
                                                    console.error('An error occurred while ending Mongoose session:', error)
                                                }).finally(() => {
                                                    console.error('An error occurred while committing mongoose transaction:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting comment. Please try again.'))
                                                })
                                            })
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while starting mongoose session:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting comment. Please try again.'))
                                    })
                                } else {
                                    deleteComment()
                                }
                            }).catch(error => {
                                console.error('An error occurred while counting Comment documents with parentCommentId:', commentFound.parentCommentId, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding comment replies. Please try again.'))
                            })
                        })
                    }
                }).catch(error => {
                    console.error('An error occurred while finding comment with id:', commentId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while comment. Please try again later.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again later.'))
            })
        })
    }

    static sendnotificationkey = async (userId, notificationKey, refreshTokenId) => {
        return await this.#sendnotificationkey(userId, notificationKey, refreshTokenId)
    }

    static changedisplayname = async (userId, desiredDisplayName) => {
        return await this.#changedisplayname(userId, desiredDisplayName)
    }

    static changeemail = async (userId, password, desiredEmail) => {
        return await this.#changeemail(userId, password, desiredEmail)
    }

    static changepassword = async (userId, currentPassword, newPassword, confirmNewPassword, IP, deviceType) => {
        return await this.#changepassword(userId, currentPassword, newPassword, confirmNewPassword, IP, deviceType)
    }

    static changeusername = async (userId, desiredUsername) => {
        return await this.#changeusername(userId, desiredUsername)
    }

    static changebio = async (userId, bio) => {
        return await this.#changebio(userId, bio)
    }

    static searchpageusersearch = async (userId, skip, val) => {
        return await this.#searchpageusersearch(userId, skip, val)
    }

    static createpollpost = async (userId, pollTitle, pollSubTitle, optionOne, optionOnesColor, optionTwo, optionTwosColor, optionThree, optionThreesColor, optionFour, optionFoursColor, optionFive, optionFivesColor, optionSix, optionSixesColor, totalNumberOfOptions, sentAllowScreenShots) => {
        return await this.#createpollpost(userId, pollTitle, pollSubTitle, optionOne, optionOnesColor, optionTwo, optionTwosColor, optionThree, optionThreesColor, optionFour, optionFoursColor, optionFive, optionFivesColor, optionSix, optionSixesColor, totalNumberOfOptions, sentAllowScreenShots)
    }

    static searchforpollposts = async (userId, pubId, previousPostId) => {
        return await this.#searchforpollposts(userId, pubId, previousPostId)
    }

    static pollpostcomment = async (userId, comment, postId) => {
        return await this.#pollpostcomment(userId, comment, postId)
    }

    static pollpostcommentreply = async (userId, comment, postId, commentId) => {
        return await this.#pollpostcommentreply(userId, comment, postId, commentId)
    }

    static searchforpollcomments = async (userId, postId) => {
        return await this.#searchforpollcomments(userId, postId)
    }

    static voteonpoll = async (userId, optionSelected, pollId) => {
        return await this.#voteonpoll(userId, optionSelected, pollId)
    }

    static removevoteonpoll = async (userId, pollId) => {
        return await this.#removevoteonpoll(userId, pollId)
    }

    static searchforpollpostsbyid = async (userId, pollId) => {
        return await this.#searchforpollpostsbyid(userId, pollId)
    }

    static upvotepoll = async (userId, pollId) => {
        return await this.#upvotepoll(userId, pollId)
    }

    static downvotepoll = async (userId, pollId) => {
        return await this.#downvotepoll(userId, pollId)
    }

    static getsinglepollcomment = async (userId, postId, commentId) => {
        return await this.#getsinglepollcomment(userId, postId, commentId)
    }

    static searchforpollcommentreplies = async (userId, postId, commentId) => {
        return await this.#searchforpollcommentreplies(userId, postId, commentId)
    }

    static deletepoll = async (userId, pollId) => {
        return await this.#deletepoll(userId, pollId)
    }

    static postImage = async (userId, title, description, sentAllowScreenShots, file) => {
        return await this.#postImage(userId, title, description, sentAllowScreenShots, file)
    }

    static postProfileImage = async (userId, file) => {
        return await this.#postProfileImage(userId, file)
    }

    static getImagesFromProfile = async (userId, pubId, previousPostId) => {
        return await this.#getImagesFromProfile(userId, pubId, previousPostId)
    }

    static getProfilePic = async (pubId) => {
        return await this.#getProfilePic(pubId)
    }

    static imagepostcomment = async (userId, comment, postId) => {
        return await this.#imagepostcomment(userId, comment, postId)
    }

    static imagepostcommentreply = async (userId, comment, postId, commentId) => {
        return await this.#imagepostcommentreply(userId, comment, postId, commentId)
    }

    static getimagepostcomments = async (userId, postId) => {
        return await this.#getimagepostcomments(userId, postId)
    }

    static upvoteimage = async (userId, imageId) => {
        return await this.#upvoteimage(userId, imageId)
    }

    static downvoteimage = async (userId, imageId) => {
        return await this.#downvoteimage(userId, imageId)
    }

    static getsingleimagecomment = async (userId, postId, commentId) => {
        return await this.#getsingleimagecomment(userId, postId, commentId)
    }

    static searchforimagecommentreplies = async (userId, postId, commentId) => {
        return await this.#searchforimagecommentreplies(userId, postId, commentId)
    }

    static postcategorywithimage = async (userId, categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, sentAllowScreenShots, file) => {
        return await this.#postcategorywithimage(userId, categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, sentAllowScreenShots, file)
    }

    static deleteimage = async (userId, imageId) => {
        return await this.#deleteimage(userId, imageId)
    }

    static postcategorywithoutimage = async (userId, categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, sentAllowScreenShots) => {
        return await this.#postcategorywithoutimage(userId, categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, sentAllowScreenShots)
    }

    static searchpagesearchcategories = async (userId, val, lastCategoryId) => {
        return await this.#searchpagesearchcategories(userId, val, lastCategoryId)
    }

    static getcategoryimage = async (val) => {
        return await this.#getcategoryimage(val)
    }

    static findcategorybyid = async (userId, categoryId) => {
        return await this.#findcategorybyid(userId, categoryId)
    }

    static findcategoryfromprofile = async (userId, pubId, previousCategoryId) => {
        return await this.#findcategoryfromprofile(userId, pubId, previousCategoryId)
    }

    static joincategory = async (userId, categoryId) => {
        return await this.#joincategory(userId, categoryId)
    }

    static posttextthread = async (userId, threadTitle, threadSubtitle, threadTags, threadCategoryId, threadBody, threadNSFW, threadNSFL, sentAllowScreenShots) => {
        return await this.#posttextthread(userId, threadTitle, threadSubtitle, threadTags, threadCategoryId, threadBody, threadNSFW, threadNSFL, sentAllowScreenShots)
    }

    static postimagethread = async (userId, threadTitle, threadSubtitle, threadTags, threadCategoryId, threadImageDescription, threadNSFW, threadNSFL, sentAllowScreenShots, file) => {
        return await this.#postimagethread(userId, threadTitle, threadSubtitle, threadTags, threadCategoryId, threadImageDescription, threadNSFW, threadNSFL, sentAllowScreenShots, file)
    }

    static getthreadsfromcategory = async (userId, categoryId) => {
        return await this.#getthreadsfromcategory(userId, categoryId)
    }

    static getthreadsfromprofile = async (userId, pubId, previousPostId) => {
        return await this.#getthreadsfromprofile(userId, pubId, previousPostId)
    }

    static upvotethread = async (userId, threadId) => {
        return await this.#upvotethread(userId, threadId)
    }

    static downvotethread = async (userId, threadId) => {
        return await this.#downvotethread(userId, threadId)
    }

    static threadpostcomment = async (userId, comment, postId) => {
        return await this.#threadpostcomment(userId, comment, postId)
    }

    static threadpostcommentreply = async (userId, comment, postId, commentId) => {
        return await this.#threadpostcommentreply(userId, comment, postId, commentId)
    }

    static searchforthreadcomments = async (userId, postId) => {
        return await this.#searchforthreadcomments(userId, postId)
    }

    static getsinglethreadcomment = async (userId, threadId, commentId) => {
        return await this.#getsinglethreadcomment(userId, threadId, commentId)
    }

    static searchforthreadcommentreplies = async (userId, threadId, commentId) => {
        return await this.#searchforthreadcommentreplies(userId, threadId, commentId)
    }

    static getthreadbyid = async (userId, threadId) => {
        return await this.#getthreadbyid(userId, threadId)
    }

    static deletethread = async (userId, threadId) => {
        return await this.#deletethread(userId, threadId)
    }

    static upvotecomment = async (userId, format, postId, commentId) => {
        return await this.#upvotecomment(userId, format, postId, commentId)
    }

    static downvotecomment = async (userId, format, postId, commentId) => {
        return await this.#downvotecomment(userId, format, postId, commentId)
    }

    static toggleFollowOfAUser = async (userId, userToFollowPubId) => {
        return await this.#toggleFollowOfAUser(userId, userToFollowPubId)
    }

    static reloadUsersDetails = async (userId, usersPubId) => {
        return await this.#reloadUsersDetails(userId, usersPubId)
    }

    static earnSpecialBadge = async (userId, badgeEarnt) => {
        return await this.#earnSpecialBadge(userId, badgeEarnt)
    }

    static getuserbyid = async (userId, pubId) => {
        return await this.#getuserbyid(userId, pubId)
    }

    static makeaccountprivate = async (userId) => {
        return await this.#makeaccountprivate(userId)
    }

    static makeaccountpublic = async (userId) => {
        return await this.#makeaccountpublic(userId)
    }

    static getfollowrequests = async (userId) => {
        return await this.#getfollowrequests(userId)
    }

    static denyfollowrequest = async (userId, accountFollowRequestDeniedPubID) => {
        return await this.#denyfollowrequest(userId, accountFollowRequestDeniedPubID)
    }

    static acceptfollowrequest = async (userId, accountFollowRequestAcceptedPubID) => {
        return await this.#acceptfollowrequest(userId, accountFollowRequestAcceptedPubID)
    }

    static removefollowerfromaccount = async (userId, userToRemovePubId) => {
        return await this.#removefollowerfromaccount(userId, userToRemovePubId)
    }

    static blockaccount = async (userId, userToBlockPubId) => {
        return await this.#blockaccount(userId, userToBlockPubId)
    }

    static getuserblockedaccounts = async (userId) => {
        return await this.#getuserblockedaccounts(userId)
    }

    static unblockaccount = async (userId, userToUnblockPubId) => {
        return await this.#unblockaccount(userId, userToUnblockPubId)
    }

    static enableAlgorithm = async (userId) => {
        return await this.#enableAlgorithm(userId)
    }

    static getAuthenticationFactorsEnabled = async (userId) => {
        return await this.#getAuthenticationFactorsEnabled(userId)
    }

    static disableAlgorithm = async (userId) => {
        return await this.#disableAlgorithm(userId)
    }

    static reloadProfileEssentials = async (userId) => {
        return await this.#reloadProfileEssentials(userId)
    }

    static turnOffEmailMultiFactorAuthentication = async (userId) => {
        return await this.#turnOffEmailMultiFactorAuthentication(userId)
    }

    static deleteaccount = async (userId) => {
        return await this.#deleteaccount(userId)
    }

    static checkIfCategoryExists = async (categoryTitle) => {
        return await this.#checkIfCategoryExists(categoryTitle)
    }

    static uploadNotificationsSettings = async (userId, notificationSettings) => {
        return await this.#uploadNotificationsSettings(userId, notificationSettings)
    }

    static getUserNotificationSettings = async (userId) => {
        return await this.#getUserNotificationSettings(userId)
    }

    static reportUser = async (userId, reportType, reporteePubId) => {
        return await this.#reportUser(userId, reportType, reporteePubId)
    }

    static getUserActivity = async (userId, skip, voteType, postFormat) => {
        return await this.#getUserActivity(userId, skip, voteType, postFormat)
    }

    static getCategoriesUserIsAPartOf = async (userId, skip) => {
        return await this.#getCategoriesUserIsAPartOf(userId, skip)
    }

    static reportPost = async (reporterId, postId, postFormat, reason) => {
        return await this.#reportPost(reporterId, postId, postFormat, reason)
    }

    static userAlgorithmSettings = async (userId) => {
        return await this.#userAlgorithmSettings(userId)
    }

    static uploadAlgorithmSettings = async (userId, algorithmSettings) => {
        return await this.#uploadAlgorithmSettings(userId, algorithmSettings)
    }

    static privacySettings = async (userId) => {
        return await this.#privacySettings(userId)
    }

    static savePrivacySettings = async (userId, settings) => {
        return await this.#savePrivacySettings(userId, settings)
    }

    static getProfileStats = async (userId, pubId, skip, stat) => {
        return await this.#getProfileStats(userId, pubId, skip, stat)
    }

    static loginactivity = async (userId, authRefreshTokenHeader) => {
        return await this.#loginactivity(userId, authRefreshTokenHeader)
    }

    static logoutdevice = async (userId, tokenToLogout) => {
        return await this.#logoutdevice(userId, tokenToLogout)
    }

    static logoutallotherdevices = async (userId, tokenIdNotToLogout) => {
        return await this.#logoutallotherdevices(userId, tokenIdNotToLogout)
    }

    static loginActivitySettings = async (userId) => {
        return await this.#loginActivitySettings(userId)
    }

    static uploadLoginActivitySettings = async (userId, newSettings) => {
        return await this.#uploadLoginActivitySettings(userId, newSettings)
    }

    static updateLoginActivitySettingsOnSignup = async (userId, newSettings, refreshTokenId, IP, deviceName) => {
        return await this.#updateLoginActivitySettingsOnSignup(userId, newSettings, refreshTokenId, IP, deviceName)
    }

    static followingFeedFilterSettings = async (userId) => {
        return await this.#followingFeedFilterSettings(userId)
    }

    static logoutuser = async (userId, refreshTokenId) => {
        return await this.#logoutuser(userId, refreshTokenId)
    }

    static deletecomment = async (userId, commentId) => {
        return await this.#deletecomment(userId, commentId);
    }
}

module.exports = TempController;