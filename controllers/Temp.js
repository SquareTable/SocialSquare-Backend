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
const CategoryMember = require('../models/CategoryMember');

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

const CommentLibrary = require('../libraries/Comment')
const commentHandler = new CommentLibrary();

const MongooseSessionLibrary = require('../libraries/MongooseSession');
const mongooseSessionHelper = new MongooseSessionLibrary();

const CategoryLibrary = require('../libraries/Category.js');
const categoryHelper = new CategoryLibrary();

const UUIDLibrary = require('../libraries/UUID.js');
const uuidHelper = new UUIDLibrary();

const bcrypt = require('bcrypt')
const mongoose = require('mongoose')

const { sendNotifications } = require("../notificationHandler");

const { blurEmailFunction, mailTransporter } = require('../globalFunctions.js');

const { tokenValidation, refreshTokenEncryption, refreshTokenDecryption } = require("../middleware/TokenHandler");
const PollVote = require('../models/PollVote');

const { Expo } = require('expo-server-sdk')

const POST_DATABASE_MODELS = {
    Image: ImagePost,
    Poll,
    Thread
}

const VOTE_DATABASE_MODELS = {
    Up: Upvote,
    Down: Downvote
}

class TempController {
    static #sendnotificationkey = (userId, notificationKey, refreshTokenId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an objectId.'))
            }

            if (typeof notificationKey !== 'string') {
                return resolve(HTTPWTHandler.badInput(`notificationKey must be a string. Provided type: ${typeof notificationKey}`))
            }

            if (!Expo.isExpoPushToken(notificationKey)) {
                return resolve(HTTPWTHandler.badInput('notificationKey must be a valid Expo push token.'))
            }

            if (typeof refreshTokenId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`refreshTokenId must be a string. Provided type: ${typeof refreshTokenId}`))
            }

            if (!mongoose.isObjectIdOrHexString(refreshTokenId)) {
                return resolve(HTTPWTHandler.badInput('refreshTokenId must be an objectId.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userData => {
                if (!userData) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))
                }

                RefreshToken.findOne({_id: {$eq: refreshTokenId}}).lean().then(refreshTokenFound => {
                    if (!refreshTokenFound) {
                        return resolve(HTTPWTHandler.notFound('Could not find refresh token.'))
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

    static #changeemail = (userId, password, desiredEmail) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof password !== 'string') {
                return resolve(HTTPWTHandler.badInput(`password must be a string. Type provided: ${typeof password}`))
            }

            if (password.length === 0) {
                return resolve(HTTPWTHandler.badInput('Password cannot be blank.'))
            }

            if (typeof desiredEmail !== 'string') {
                return resolve(HTTPWTHandler.badInput(`desiredEmail must be a string. Type provided: ${typeof desiredEmail}`))
            }

            if (desiredEmail.length === 0) {
                return resolve(HTTPWTHandler.badInput('Desired email cannot be blank.'))
            }

            password = password.trim();
            desiredEmail = desiredEmail.trim();

            if (!CONSTANTS.VALID_EMAIL_TEST.test(desiredEmail)) {
                return resolve(HTTPWTHandler.badInput('Invalid desired email entered'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))
                }

                User.findOne({ email: {$eq: desiredEmail} }).lean().then(result => {
                    // A email exists
                    if (result) {
                        return resolve(HTTPWTHandler.forbidden('User with the desired email already exists'))
                    } else {
                        const hashedPassword = userFound.password;

                        let passwordIsCorrect;

                        try {
                            passwordIsCorrect = bcrypt.compareSync(password, hashedPassword);
                        } catch (error) {
                            console.error('An error occurred while comparing passwords for user with id:', userId, '. The error was:', error);
                            return resolve(HTTPWTHandler.serverError('An error occurred while authenticating you. Please try again.'))
                        }

                        if (!passwordIsCorrect) return resolve(HTTPWTHandler.unauthorized('Wrong password entered!'))

                        User.findOneAndUpdate({_id: {$eq: userId}}, {email: String(desiredEmail)}).then(function(){
                            return resolve(HTTPWTHandler.OK('Change Email Successful'))
                        }).catch(error => {
                            console.error('An error occurred while changing email for user with id:', userId, 'to: ', String(desiredEmail), '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while updating email'))
                        });
                    }
                }).catch(error => {
                    console.error('An error occured while finding a user with email:', desiredEmail, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while checking for existing user with that email. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #changepassword = (userId, currentPassword, newPassword, IP, deviceType) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`));
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof currentPassword !== 'string') {
                return resolve(HTTPWTHandler.badInput(`currentPassword must be a string. Provided type: ${typeof currentPassword}`))
            }

            if (typeof newPassword !== 'string') {
                return resolve(HTTPWTHandler.badInput(`newPassword must be a string. Provided type: ${typeof newPassword}`))
            }


            currentPassword = currentPassword.trim()
            newPassword = newPassword.trim()

            if (currentPassword.length === 0) {
                return resolve(HTTPWTHandler.badInput('Current password cannot be empty.'))
            }

            if (newPassword.length === 0) {
                return resolve(HTTPWTHandler.badInput('New password cannot be empty.'))
            }

            if (newPassword.length < CONSTANTS.MIN_USER_PASSWORD_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`Your new password must be ${CONSTANTS.MIN_USER_PASSWORD_LENGTH} or more characters.`))
            }

            if (newPassword.length > CONSTANTS.MAX_USER_PASSWORD_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`Your new password cannot be more than ${CONSTANTS.MAX_USER_PASSWORD_LENGTH} characters.`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))

                const hashedPassword = userFound.password;

                let passwordIsCorrect;

                try {
                    passwordIsCorrect = bcrypt.compareSync(currentPassword, hashedPassword);
                } catch (error) {
                    console.error('An error occurred while comparing passwords for user with id:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while authenticating you. Please try again.'))
                }

                if (!passwordIsCorrect) return resolve(HTTPWTHandler.unauthorized('Wrong password entered!'))

                let newHashedPassword;

                try {
                    newHashedPassword = bcrypt.hashSync(newPassword, CONSTANTS.BCRYPT_COST_FACTOR);
                } catch (error) {
                    console.error('An error occurred while hashing new password. The error was:', error)
                }

                const {token, refreshToken, encryptedRefreshToken} = userHandler.generateNewAuthAndRefreshTokens(userId)

                const newRefreshTokenObject = {
                    encryptedRefreshToken,
                    userId: userId,
                    createdAt: Date.now(),
                    admin: false
                }

                const formattedIP = HTTPHandler.formatIP(IP)

                if (userFound?.settings?.loginActivitySettings?.getIP) {
                    newRefreshTokenObject.IP = formattedIP
                }

                if (userFound?.settings?.loginActivitySettings?.getLocation) {
                    newRefreshTokenObject.location = userHandler.getLocationFromIP(formattedIP)
                }

                if (userFound?.settings?.loginActivitySettings?.getDeviceType) {
                    newRefreshTokenObject.deviceType = deviceType
                }

                const newRefreshToken = new RefreshToken(newRefreshTokenObject)

                mongoose.startSession().then(session => {
                    session.startTransaction();

                    RefreshToken.deleteMany({userId: {$eq: userId}, admin: false}, {session}).then(() => {
                        newRefreshToken.save({session}).then(savedRefreshToken => {
                            User.findOneAndUpdate({_id: {$eq: userId}}, {password: newHashedPassword}, {session}).then(() => {
                                mongooseSessionHelper.commitTransaction(session).then(() => {
                                    return resolve(HTTPWTHandler.OK('Changing password was a success!', {}, {token: `Bearer ${token}`, refreshToken: `Bearer ${refreshToken}`, refreshTokenId: String(savedRefreshToken._id)}))
                                }).catch(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while saving new password. Please try again.'))
                                })
                            }).catch(error => {
                                console.error('An error occurred while finding user with id:', userId, 'and updating password. The error was:', error)
                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while changing password. Please try again.'))
                                })
                            })
                        }).catch(error => {
                            console.error('An error occurred while saving new refresh token with data:', newRefreshTokenObject, '. The error was:', error)
                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                return resolve(HTTPWTHandler.serverError('An error occurred while changing password. Please try again.'))
                            })
                        })
                    }).catch(error => {
                        console.error('An error occurred while deleting many RefreshTokens with userId:', userId, ' and with admin set to false. The error was:', error)
                        mongooseSessionHelper.abortTransaction(session).then(() => {
                            return resolve(HTTPWTHandler.serverError('An error occurred while logging out other devices. Please try again.'))
                        })
                    })
                }).catch(error => {
                    console.error('An error occurred while starting Mongoose session:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while starting to change password. Please try again.'))
                })
            }).catch((error) => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user with id:', userId))
            })
        })
    }

    static #searchpageusersearch = (userId, lastItemId, searchTerm) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            const limit = CONSTANTS.SEARCH_PAGE_USER_SEARCH_MAX_USERS_TO_RETURN;

            if (typeof lastItemId !== 'string' && lastItemId !== undefined) {
                return resolve(HTTPWTHandler.badInput(`lastItemId must be a string or undefined. Provided type: ${typeof lastItemId}`))
            }


            if (lastItemId && !mongoose.isObjectIdOrHexString(lastItemId)) {
                return resolve(HTTPWTHandler.badInput('lastItemId must be an ObjectId.'))
            }

            if (typeof searchTerm !== 'string') {
                return resolve(HTTPWTHandler.badInput(`searchTerm must be a string. Provided type: ${typeof searchTerm}`))
            }

            if (searchTerm.length === 0) {
                return resolve(HTTPWTHandler.badInput('Search box empty!'))
            }

            const searchDBQuery = {
                $or: [
                    { name: {$regex: `^${searchTerm}`, $options: 'i'} },
                    { displayName: {$regex: `^${searchTerm}`, $options: 'i'} }
                ]
            }

            if (lastItemId) {
                searchDBQuery._id = {
                    $gt: lastItemId
                }
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (userFound) {
                    User.find(searchDBQuery).sort({_id: -1}).limit(limit).lean().then(data =>{
                        const noMoreItems = data.length < limit;

                        if (data.length) {
                            const processedUsers = [];

                            for (const userFromSearch of data) {
                                if (userFromSearch.blockedAccounts?.includes(userFound.secondId)) continue

                                processedUsers.push(userHandler.returnPublicInformation(userFromSearch, userFound))
                            }

                            return resolve(HTTPWTHandler.OK('Success', {items: processedUsers, noMoreItems}))
                        } else {
                            return resolve(HTTPWTHandler.OK('Success', {items: [], noMoreItems}))
                        }
                    }).catch(err => {
                        console.error('An error occured while searching for users with DB query:', searchDBQuery, '. The error was:', err)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding users. Please try again.'))
                    });
                } else {
                    return resolve(HTTPWTHandler.badInput('User could not be found with provided userId'))
                }
            }).catch(error => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #createpollpost = (userId, title, subtitle, options) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof title !== 'string') {
                return resolve(HTTPWTHandler.badInput(`title must be a string. Provided type: ${typeof title}`))
            }

            if (typeof subtitle !== 'string') {
                return resolve(HTTPWTHandler.badInput(`subtitle must be a string. Provided type: ${typeof subtitle}`))
            }

            if (!Array.isArray(options)) {
                return resolve(HTTPWTHandler.badInput(`options must be an array. Provided type: ${typeof options}`))
            }
           
            if (options.length > 6 || options.length < 2) {
                return resolve(HTTPWTHandler.badInput('A poll must have between 2 - 6 options.'))
            }

            for (const option of options) {
                if (typeof option !== 'object' || Array.isArray(option) || option === null) {
                    return resolve(HTTPWTHandler.badInput('Items in the options array must all be objects.'))
                }

                for (const key of Object.keys(option)) {
                    if (!CONSTANTS.ALLOWED_POLL_OPTION_KEYS.includes(key)) {
                        delete option[key]
                    }
                }

                if (typeof option.title !== 'string') {
                    return resolve(HTTPWTHandler.badInput('All option titles must be strings.'))
                }

                if (option.title.length === 0) {
                    return resolve(HTTPWTHandler.badInput('All option titles must not be empty strings.'))
                }

                option.title = option.title.trim()
            }
            

            title = title.trim()
            subtitle = subtitle.trim()

            if (title.length == 0) {
                return resolve(HTTPWTHandler.badInput('title must not be blank'))
            }

            if (subtitle.length == 0) {
                return resolve(HTTPWTHandler.badInput('subtitle must not be blank'))
            }
          
            User.findOne({_id: {$eq: userId}}).lean().then(data => {
                if (data) {
                    const pollObject = {
                        title,
                        subtitle,
                        options,
                        creatorId: userId,
                        datePosted: Date.now()
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
        })
    }

    static #searchforpollposts = (userId, pubId, lastItemId) => {
        //userId is the ID of the user requesting the poll posts
        //pubId is the secondId of the user with the poll posts that are being searched for
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Provided type: ${typeof pubId}`))
            }

            if (typeof lastItemId !== 'string' && lastItemId !== undefined) {
                return resolve(HTTPWTHandler.badInput(`lastItemId must be either a string or undefined`))
            }

            if (pubId.length < 1) {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string'))
            }

            User.findOne({secondId: {$eq: pubId}}).lean().then(result => {
                if (result) {
                    //User Exists
                    User.findOne({_id: {$eq: userId}}).lean().then(userGettingPollPosts => {
                        if (userGettingPollPosts) {
                            if (result.blockedAccounts?.includes(userGettingPollPosts.secondId)) {
                                // User is blocked or the account is private but the user requesting doesn't follow the user so do not send posts
                                return resolve(HTTPWTHandler.notFound('User could not be found.'))
                            } else if (userId != result._id && (result.privateAccount && !result.followers.includes(userGettingPollPosts.secondId))) {
                                return resolve(HTTPWTHandler.notFound('No Poll Posts'))
                            } else {
                                // User exists
                                const dbQuery = {
                                    creatorId: {$eq: result._id}
                                }

                                if (lastItemId) {
                                    dbQuery._id = {$lt: new mongoose.Types.ObjectId(lastItemId)}
                                }

                                console.log('lastItemId:', lastItemId)
                                console.log('dbQuery:', dbQuery)

                                const time1 = performance.now()
                                Poll.find(dbQuery).sort({_id: -1}).limit(CONSTANTS.NUM_POLLS_TO_SEND_PER_API_CALL).lean().then(data => pollPostHandler.processMultiplePostDataFromOneOwner(data, result, userGettingPollPosts)).then(data => {
                                    const time2 = performance.now()
                                    console.log('TIME TO PROCESS 10 POLLS:', time2 - time1, 'MILLISECONDS.')
                                    if (data.length) {
                                        const toSend = {
                                            items: data,
                                            noMoreItems: data.length < CONSTANTS.NUM_POLLS_TO_SEND_PER_API_CALL
                                        }

                                        return resolve(HTTPWTHandler.OK('Poll search successful', toSend))
                                    } else {
                                        return resolve(HTTPWTHandler.OK('No more poll posts could be found', {items: [], noMoreItems: true}))
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
            }).catch(err => {
                console.error('An error occured while finding user with secondId:', pubId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            });
        })
    }

    static #voteonpoll = (userId, optionSelected, pollId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof optionSelected !== 'number') {
                return resolve(HTTPWTHandler.badInput(`optionSelected must be a number. Provided type: ${typeof optionSelected}`))
            }

            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
            }

            if (!mongoose.isObjectIdOrHexString(pollId)) {
                return resolve(HTTPWTHandler.badInput('pollId must be an ObjectId.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (!result) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }
                
                //User exists
                Poll.findOne({_id: {$eq: pollId}}).lean().then(data => {
                    if (!data) {
                        return resolve(HTTPWTHandler.notFound('Could not find poll'))
                    }
                    
                    if (data.creatorId == userId) {
                        return resolve(HTTPWTHandler.forbidden('You cannot vote on your own poll'))
                    }

                    if (optionSelected > data.options.length - 1) {
                        return resolve(HTTPWTHandler.badInput('Invalid vote'))
                    }

                    PollVote.findOneAndUpdate({userId: {$eq: userId}, pollId: {$eq: pollId}}, {dateVoted: Date.now(), vote: optionSelected}, {upsert: true}).then(() => {
                        return resolve(HTTPWTHandler.OK('Added poll vote'))
                    }).catch(error => {
                        console.error('An error occurred while finding one and updating PollVote with filter filtering by userId:', userId, 'and pollId:', pollId, 'and update query updating dateVoted to Date.now() and vote to:', optionSelected, 'and upserts are enabled. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while adding vote to the poll. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occured while finding poll with id:', pollId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user with your id. Please try again.'))
            })
        })
    }

    static #removevoteonpoll = (userId, pollId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
            }

            if (!mongoose.isObjectIdOrHexString(pollId)) {
                return resolve(HTTPWTHandler.badInput('pollId must be an ObjectId.'))
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

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

    static #deletepoll = (userId, pollId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

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
                                Comment.find({postId: {$eq: pollId}, postFormat: "Poll"}, '_id').lean().then(commentsFound => {
                                    const commentIds = commentsFound.map(comment => comment._id);

                                    mongoose.startSession().then(session => {
                                        session.startTransaction();

                                        Poll.deleteOne({_id: {$eq: pollId}}, {session}).then(() => {
                                            const upvoteBulkUpdates = [
                                                {
                                                    deleteMany: {
                                                        filter: {postId: pollId, postFormat: "Poll"}
                                                    }
                                                }
                                            ];

                                            if (commentIds.length < 1) {
                                                upvoteBulkUpdates.push({
                                                    deleteMany: {
                                                        filter: {postId: {$in: commentIds}, postFormat: "Comment"}
                                                    }
                                                })
                                            }

                                            Upvote.bulkWrite(upvoteBulkUpdates, {session}).then(() => {
                                                const downvoteBulkUpdates = [
                                                    {
                                                        deleteMany: {
                                                            filter: {postId: pollId, postFormat: "Poll"}
                                                        }
                                                    }
                                                ];

                                                if (commentIds.length < 1) {
                                                    downvoteBulkUpdates.push({
                                                        deleteMany: {
                                                            filter: {postId: {$in: commentIds}, postFormat: "Comment"}
                                                        }
                                                    })
                                                }

                                                Downvote.bulkWrite(downvoteBulkUpdates, {session}).then(() => {
                                                    PollVote.deleteMany({pollId: {$eq: pollId}}, {session}).then(() => {
                                                        Comment.deleteMany({postId: {$eq: pollId}, postFormat: "Poll"}, {session}).then(() => {
                                                            mongooseSessionHelper.commitTransaction(session).then(() => {
                                                                return resolve(HTTPWTHandler.OK('Successfully deleted poll'))
                                                            }).catch(() => {
                                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting poll and associated data. Please try again.'))
                                                            })
                                                        }).catch(error => {
                                                            console.error('An error occurred while deleting many comments from poll with postId:', pollId, '. The error was:', error)
                                                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting poll comments. Please try again.'))
                                                            })
                                                        })
                                                    }).catch(error => {
                                                        console.error('An error occurred while deleting many poll votes with pollId:', pollId, '. The error was:', error)
                                                        mongooseSessionHelper.abortTransaction(session).then(() => {
                                                            return resolve(HTTPWTHandler.serverError('An error occurred while deleting poll votes. Please try again.'))
                                                        })
                                                    })
                                                }).catch(error => {
                                                    console.error('An error occurred while deleting comment (making bulk updates on Downvote collection):', downvoteBulkUpdates, '. The error was:', error)
                                                    mongooseSessionHelper.abortTransaction(session).then(() => {
                                                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting associated downvotes. Please try again.'))
                                                    })
                                                })
                                            }).catch(error => {
                                                console.error('An error occurred while making deleting comment (making bulk updates on Upvote collection):', upvoteBulkUpdates, '. The error was:', error)
                                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting associated upvotes. Please try again.'))
                                                })
                                            })
                                        }).catch(error => {
                                            console.error('An error occurred while deleting one poll with id:', pollId, '. The error was:', error)
                                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting poll. Please try again.'))
                                            })
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while starting a mongoose session:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting poll. Please try again.'))
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while finding comments from a poll post with id:', pollId, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while finding comments to delete. Please try again.'))
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

    static #postImage = (creatorId, title, description, file) => {
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

            if (typeof creatorId !== 'string') {
                deleteFile();
                return resolve(HTTPWTHandler.badInput(`creatorId must be a string. Provided type: ${typeof creatorId}`))
            }

            if (!mongoose.isObjectIdOrHexString(creatorId)) {
                deleteFile();
                return resolve(HTTPWTHandler.badInput('creatorId must be an ObjectId.'))
            }

            title = title.trim()
            description = description.trim()
            //console.log(file)
            console.log(title)
            console.log(description)
            console.log(creatorId)
            User.findOne({_id: creatorId}).lean().then(result => {
                if (result) {
                    imageHandler.compressImage(file.filename).then(imageKey => {
                        const newImagePostObject = {
                            imageKey,
                            imageTitle: title,
                            imageDescription: description,
                            creatorId: creatorId,
                            comments: [],
                            datePosted: Date.now()
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
            if (!file) {
                return resolve(HTTPWTHandler.badInput('No file was sent.'))
            }

            const deleteImage = () => {
                imageHandler.deleteMulterTempImage(file.filename)
            }

            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandloer.badInput('userId must be an ObjectId.'))
            }

            console.log('File has been recieved: ', file.filename)
            //check if user exists
            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    imageHandler.compressImage(file.filename).then(async imageKey => {
                        if (result.profileImageKey != "") {
                            //Remove previous profile image if the user already has one
                            try {
                                await imageHandler.deleteImagePromiseByKey(result.profileImageKey, true);
                            } catch (error) {
                                console.error('An error occurred while deleting previous profile picture with key:', result.profileImageKey, '. The error was:', error)
                                imageHandler.deleteImageByKey(imageKey, true)
                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting your previous profile picrture. Please try again.'))
                            }
                        }

                        User.findOneAndUpdate({_id: {$eq: userId}}, { profileImageKey: imageKey }).then(function(){
                            console.log("SUCCESS1")
                            return resolve(HTTPWTHandler.OK('Profile Image Updated'))
                        })
                        .catch(err => {
                            console.error('An error occurred while updating user with id:', userId, ' profileImageKey to:', imageKey, '. The error was:', err)
                            imageHandler.deleteImageByKey(imageKey, true)
                            return resolve(HTTPWTHandler.serverError('An error occurred while updating profile picture. Please try again.'))
                        });
                    }).catch(error => {
                        console.error('An error was thrown from ImageLibrary.compressImage while compressing image with filename:', file.filename, '. The error was:', error)
                        deleteImage()
                        return resolve(HTTPWTHandler.serverError('Failed to compress image. Please try again.'))
                    })
                } else {
                    deleteImage()
                    return resolve(HTTPWTHandler.notFound('User could not be found with provided userId'))
                }
            }).catch(err => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
                deleteImage()
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            });
        })
    }

    static #getImagesFromProfile = (userId, pubId, lastItemId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Type provided: ${typeof pubId}`))
            }

            if (pubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string.'))
            }

            if (typeof lastItemId !== 'string' && lastItemId !== undefined) {
                return resolve(HTTPWTHandler.badInput(`lastItemId must be a string or undefined. Type provided: ${typeof lastItemId}`))
            }

            if (lastItemId?.length === 0) {
                return resolve(HTTPWTHandler.badInput('lastItemId cannot be a blank string'))
            }

            if (typeof lastItemId === 'string' && !mongoose.isObjectIdOrHexString(lastItemId)) {
                return resolve(HTTPWTHandler.badInput('lastItemId must be an ObjectId string or undefined.'))
            }

            const getImagesAndSendToUser = (postOwner, userRequesting) => {
                const dbQuery = {
                    creatorId: postOwner._id
                }

                if (lastItemId != undefined) {
                    dbQuery._id = {$lt: lastItemId}
                }

                ImagePost.find(dbQuery).sort({_id: -1}).limit(CONSTANTS.NUM_IMAGE_POSTS_TO_SEND_PER_API_CALL).lean().then(result => imagePostHandler.processMultiplePostDataFromOneOwner(result, postOwner, userRequesting)).then(result => {
                    if (result.length) {
                        const toSend = {
                            items: result,
                            noMoreItems: result.length < CONSTANTS.NUM_IMAGE_POSTS_TO_SEND_PER_API_CALL
                        }

                        return resolve(HTTPWTHandler.OK('Posts found', toSend))
                    } else {
                        return resolve(HTTPWTHandler.OK('No more image posts could be found', {items: [], noMoreItems: true}))
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
                    if (userId == data._id) {
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

    static #postcategory = (userId, title, description, tags, NSFW, NSFL, file) => {
        return new Promise(resolve => {
            const deleteFile = () => {
                if (file) {
                    imageHandler.deleteMulterTempImage(file.filename)
                }
            }

            if (typeof userId !== 'string') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof title !== 'string') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`title must be a string. Provided type: ${typeof title}`))
            }

            if (typeof description !== 'string') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`description must be a string. Provided type: ${typeof description}`))
            }

            if (typeof tags !== 'string') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`tags must be a string. Provided type: ${typeof tags}`))
            }

            if (typeof NSFW !== 'boolean' && NSFW !== 'false' && NSFW !== 'true') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`NSFW must be a boolean, "false", or "true". Provided type: ${typeof NSFW}"`))
            }

            if (typeof NSFL !== 'boolean' && NSFL !== 'false' && NSFL !== 'true') {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`NSFL must be a boolean, "false", or "true". Provided type: ${typeof NSFL}`))
            }

            if (NSFW === "false") {
                NSFW = false;
            }

            if (NSFW === "true") {
                NSFW = true;
            }

            if (NSFL === "false") {
                NSFL = false;
            }

            if (NSFL === "true") {
                NSFL = true;
            }

            title = title.trim()
            description = description.trim()

            if (title.length == 0) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput('title must not be an empty string.'))
            }

            if (description.length == 0) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput('description must not be an empty string.'))
            }

            if (title.length > CONSTANTS.MAX_CATEGORY_TITLE_LENGTH) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`title cannot be more than ${CONSTANTS.MAX_CATEGORY_TITLE_LENGTH} characters long.`))
            }

            if (description.length > CONSTANTS.MAX_CATEGORY_DESCRIPTION_LENGTH) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(`description cannot be more than ${CONSTANTS.MAX_CATEGORY_DESCRIPTION_LENGTH} characters long.`))
            }

            if (!CONSTANTS.VALID_CATEGORY_TITLE_TEST.test(title)) {
                deleteFile()
                return resolve(HTTPWTHandler.badInput(CONSTANTS.CATEGORY_TITLE_FAILED_TEST_ERROR_MESSAGE))
            }

            if (!CONSTANTS.VALID_CATEGORY_DESCRIPTION_TEST.test(description)) {
                deleteFile();
                return resolve(HTTPWTHandler.badInput(`description must have less than ${CONSTANTS.MAX_CATEGORY_DESCRIPTION_LINES} lines.`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Category.findOne({title: {'$regex': `^${title}$`, $options: 'i'}}).lean().then(async categoryFound => {
                        if (!categoryFound) { // category title not already used so allow it
                            let imageKey;
                            if (file) {
                                try {
                                    imageKey = await imageHandler.compressImage(file.filename);
                                } catch (e) {
                                    console.error('An error was thrown from ImageLibrary.compressImage while compressing image with filename:', file.filename, '. The error was:', e)
                                    deleteFile()
                                    return resolve(HTTPWTHandler.serverError('Failed to compress image. Please try again.'))
                                }
                            }

                            const newCategoryObject = {
                                title: title,
                                description: description,
                                tags: tags,
                                NSFW: NSFW,
                                NSFL: NSFL,
                                categoryOwnerId: userId,
                                categoryOriginalCreator: userId,
                                datePosted: Date.now()
                            };

                            if (imageKey) {
                                newCategoryObject.imageKey = imageKey
                            }

                            const newCategory = new Category(newCategoryObject);

                            mongoose.startSession().then(session => {
                                session.startTransaction();

                                newCategory.save({session}).then(result => {
                                    const categoryMemberData = {
                                        userId,
                                        categoryId: result._id,
                                        dateJoined: Date.now(),
                                        roles: []
                                    }

                                    const newCategoryMember = new CategoryMember(categoryMemberData);

                                    newCategoryMember.save({session}).then(() => {
                                        mongooseSessionHelper.commitTransaction(session).then(() => {
                                            return resolve(HTTPWTHandler.OK('Creation successful'))
                                        }).catch(() => {
                                            if (imageKey) imageHandler.deleteImageByKey(imageKey);
                                            return resolve(HTTPWTHandler.serverError('An error occurred while saving category. Please try again.'))
                                        })
                                    }).catch(error => {
                                        if (imageKey) imageHandler.deleteImageByKey(imageKey);
                                        console.error('An error occurred while saving new CategoryMember with data:', categoryMemberData, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while saving category. Please try again.'))
                                    })
                                }).catch(err => {
                                    if (imageKey) imageHandler.deleteImageByKey(imageKey);
                                    console.error('An error occurred while saving new category with newCategoryObject:', newCategoryObject, '. The error was:', err)
                                    mongooseSessionHelper.abortTransaction(session).then(() => {
                                        return resolve(HTTPWTHandler.serverError('An error occurred while saving category. Please try again.'))
                                    })
                                })
                            }).catch(error => {
                                if (imageKey) imageHandler.deleteImageByKey(imageKey);
                                console.error('An error occurred while starting Mongoose session:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while starting to create category. Please try again.'))
                            })
                        } else {
                            deleteFile()
                            return resolve(HTTPWTHandler.conflict('A category with the chosen title already exists.'))
                        }
                    }).catch(error => {
                        deleteFile()
                        console.error('An error occured while seeing if a category title already exists or not. The title to be checked was:', title, '. The error was:', error)
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

    static #deleteimage = (userId, postId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (!mongoose.isObjectIdOrHexString(postId)) {
                return resolve(HTTPWTHandler.badInput('postId must be an ObjectId.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                ImagePost.findOne({_id: {$eq: postId}}).lean().then(postFound => {
                    if (!postFound) return resolve(HTTPWTHandler.notFound('Could not find image post.'))

                    if (String(postFound.creatorId) !== userId) return resolve(HTTPWTHandler.forbidden('You are not authorised to delete this post.'))

                    Comment.find({postId: {$eq: postId}, postFormat: "Image"}, '_id').lean().then(commentsFound => {
                        const commentIds = commentsFound.map(comment => comment._id)

                        mongoose.startSession().then(session => {
                            session.startTransaction();

                            ImagePost.deleteOne({_id: {$eq: postId}}, {session}).then(() => {
                                const upvoteBulkUpdates = [
                                    {
                                        deleteMany: {
                                            filter: {postId: {$eq: postId}, postFormat: "Image"}
                                        }
                                    }
                                ];

                                if (commentIds.length < 1) {
                                    upvoteBulkUpdates.push({
                                        deleteMany: {
                                            filter: {postId: {$in: commentIds}, postFormat: "Comment"}
                                        }
                                    })
                                }

                                Upvote.bulkWrite(upvoteBulkUpdates, {session}).then(() => {
                                    const downvoteBulkUpdates = [
                                        {
                                            deleteMany: {
                                                filter: {postId: {$eq: postId}, postFormat: "Image"}
                                            }
                                        }
                                    ];

                                    if (commentIds.length < 1) {
                                        downvoteBulkUpdates.push({
                                            deleteMany: {
                                                filter: {postId: {$in: commentIds}, postFormat: "Comment"}
                                            }
                                        })
                                    }

                                    Downvote.bulkWrite(downvoteBulkUpdates, {session}).then(() => {
                                        Comment.deleteMany({postId: {$eq: postId}, postFormat: "Image"}, {session}).then(() => {
                                            mongooseSessionHelper.commitTransaction(session).then(() => {
                                                return resolve(HTTPWTHandler.OK('Successfully deleted image post.'))
                                            }).catch(() => {
                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting image post. Please try again.'))
                                            })
                                        }).catch(error => {
                                            console.error('An error occurred while deleting all comments from image post with id:', postId, '. The error was:', error)
                                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting image post comments. Please try again.'))
                                            })
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while deleting image post (making bulk updates on Downvote collection):', downvoteBulkUpdates, '. The error was:', error)
                                        mongooseSessionHelper.abortTransaction(session).then(() => {
                                            return resolve(HTTPWTHandler.serverError('An error occurred while deleting image post downvotes. Please try again.'))
                                        })
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while deleting image post (making bulk updates on Upvote collection):', upvoteBulkUpdates, '. The error was:', error)
                                    mongooseSessionHelper.abortTransaction(session).then(() => {
                                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting image post upvotes. Please try again.'))
                                    })
                                })
                            }).catch(error => {
                                console.error('An error occurred while deleting image post with id:', postId, '. The error was:', error)
                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting image. Please try again.'))
                                })
                            })
                        }).catch(error => {
                            console.error('An error occurred while starting Mongoose session:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while starting to delete post. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding comments from image post with id:', postId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding comments to delete. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one image post with id:', postId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding image post. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #searchpagesearchcategories = (userId, searchTerm, lastItemId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof searchTerm !== 'string') {
                return resolve(HTTPWTHandler.badInput(`searchTerm must be a string. Provided type: ${typeof searchTerm}`))
            }

            if (searchTerm.length == 0) {
                return resolve(HTTPWTHandler.badInput('Search box cannot be empty!'))
            }

            if (lastItemId !== undefined && typeof lastItemId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`lastItemId must be undefined or a string. Provided type: ${typeof lastItemId}`))
            }

            if (typeof lastItemId === 'string' && !mongoose.isObjectIdOrHexString(lastItemId)) {
                return resolve(HTTPWTHandler.badInput('lastItemId must be an ObjectId string or undefined.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }

                const dbQuery = {
                    title: {$regex: `^${searchTerm}`, $options: 'i'}
                }

                if (lastItemId !== undefined) {
                    dbQuery._id = {$lt: new mongoose.Types.ObjectId(lastItemId)}
                }

                Category.find(dbQuery).sort({_id: -1}).limit(CONSTANTS.NUM_CATEGORIES_TO_SEND_PER_API_CALL).lean().then(data => {
                    Promise.all(
                        data.map(category => {
                            return CategoryMember.countDocuments({categoryId: {$eq: category._id}})
                        })
                    ).then(memberCounts => {
                        const categories = data.map((category, index) => {
                            return {
                                title: category.title,
                                description: category.description,
                                members: memberCounts[index],
                                tags: category.tags,
                                imageKey: category.imageKey,
                                NSFW: category.NSFW,
                                NSFL: category.NSFL,
                                datePosted: category.datePosted,
                                _id: String(category._id)
                            }
                        })

                        const toSend = {
                            items: categories,
                            noMoreItems: data.length < CONSTANTS.NUM_CATEGORIES_TO_SEND_PER_API_CALL
                        }

                        return resolve(HTTPWTHandler.OK('Search successful', toSend))
                    }).catch(error => {
                        console.error('An error occurred while counting CategoryMember documents. The categoryIds were:', data.map(category => category._id), '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding categories. Please try again.'))
                    })
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

            Category.findOne({title: {$eq: val}}).lean().then(data =>{
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
                console.error('An error occurred while finding category with title:', val, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding category. Please try again.'))
            })
        })
    }

    static #findcategorybyid = (userId, categoryId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (typeof categoryId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`categoryId must be a string. Provided type: ${typeof categoryId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (!mongoose.isObjectIdOrHexString(categoryId)) {
                return resolve(HTTPWTHandler.badInput('categoryId must be an ObjectId.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))

                Category.findOne({_id: {$eq: categoryId}}).lean().then(categoryFound => {
                    if (!categoryFound) return resolve(HTTPWTHandler.notFound('Could not find category.'))

                    Promise.all([
                        CategoryMember.countDocuments({categoryId: {$eq: categoryId}}),
                        CategoryMember.findOne({userId: {$eq: userId}, categoryId: {$eq: categoryId}})
                    ]).then(([members, memberDocument]) => {
                        const permissions = memberDocument ? categoryHelper.returnPermissions(memberDocument, categoryFound) : {};

                        const categoryData = {
                            title: categoryFound.title,
                            description: categoryFound.description,
                            members: members,
                            tags: categoryFound.tags,
                            imageKey: categoryFound.imageKey,
                            NSFW: categoryFound.NSFW,
                            NSFL: categoryFound.NSFL,
                            datePosted: categoryFound.datePosted,
                            inCategory: !!memberDocument,
                            categoryId: String(categoryFound._id),
                            permissions
                        }

                        return resolve(HTTPWTHandler.OK('Search successful', categoryData))
                    }).catch(error => {
                        console.error('An error occurred while finding members and member document for categories:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding members of the category. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one category with id:', categoryId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding category. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #findcategoryfromprofile = (userId, pubId, lastItemId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Provided type: ${typeof pubId}`))
            }

            if (pubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string.'))
            }

            if (typeof lastItemId !== 'string' && lastItemId !== undefined) {
                return resolve(HTTPWTHandler.badInput(`lastItemId must be a string or undefined. Type provided: ${typeof lastItemId}`))
            }

            if (typeof lastItemId === 'string' && !mongoose.isObjectIdOrHexString(lastItemId)) {
                return resolve(HTTPWTHandler.badInput('lastItemId must be an ObjectId string or undefined.'))
            }

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
                            userId: {$eq: result._id}
                        }

                        if (lastItemId) {
                            dbQuery._id = {$lt: lastItemId}
                        }

                        CategoryMember.find(dbQuery).sort({_id: -1}).limit(CONSTANTS.NUM_CATEGORIES_TO_SEND_PER_API_CALL).lean().then(data => {
                            if (data.length < 1) return resolve(HTTPWTHandler.OK('No more categories could be found', {items: [], noMoreItems: true}))

                            const categoryIds = Array.from(new Set(data.map(member => member.categoryId)));

                            Category.find({_id: {$in: categoryIds}}).lean().then(categories => {
                                const {memberCategoryPairs, missingCategories} = arrayHelper.returnMemberCategoryPairs(categories, data);

                                if (missingCategories.length > 0) {
                                    console.error('Found missing categories from memberCategoryPairs:', missingCategories);
                                }

                                Promise.all(
                                    memberCategoryPairs.map(([category]) => {
                                        return CategoryMember.countDocuments({categoryId: {$eq: category._id}});
                                    })
                                ).then(memberCounts => {
                                    const toSend = memberCategoryPairs.map(([category, categoryMember], index) => {
                                        const userPermissions = categoryHelper.returnPermissions(categoryMember, category);

                                        return {
                                            title: category.title,
                                            description: category.description,
                                            members: memberCounts[index],
                                            tags: category.tags,
                                            imageKey: category.imageKey,
                                            NSFW: category.NSFW,
                                            NSFL: category.NSFL,
                                            datePosted: category.datePosted,
                                            inCategory: true,
                                            _id: String(category._id),
                                            permissions: userPermissions,
                                            memberId: String(categoryMember._id)
                                        }
                                    })

                                    return resolve(HTTPWTHandler.OK('Categories search successful', {items: toSend, noMoreItems: toSend.length < CONSTANTS.NUM_CATEGORIES_TO_SEND_PER_API_CALL}))
                                }).catch(error => {
                                    console.error('An error occurred while getting member counts from categories in this pair list:', memberCategoryPairs, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occured while finding member counts for the categories. Please try again.'))
                                })
                            }).catch(error => {
                                console.error('An error occurred while finding categories with ids in:', categoryIds, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while getting category data. Please try again.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while finding CategoryMember documents with query:', dbQuery, 'and sorting with _id -1 and limiting to:', CONSTANTS.NUM_CATEGORIES_TO_SEND_PER_API_CALL, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding categories that you have joined. Please try again.'))
                        })
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (typeof categoryId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`categoryId must be a string. Provided type: ${typeof categoryId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (!mongoose.isObjectIdOrHexString(categoryId)) {
                return resolve(HTTPWTHandler.badInput('categoryId must be an ObjectId.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                Category.findOne({_id: {$eq: categoryId}}).lean().then(categoryFound => {
                    if (!categoryFound) return resolve(HTTPWTHandler.notFound('Could not find category.'))

                    CategoryMember.findOneAndUpdate({userId: {$eq: userId}, categoryId: {$eq: categoryId}}, {dateJoined: Date.now(), roles: []}, {upsert: true}).then(() => {
                        return resolve(HTTPWTHandler.OK('Successfully added you to the category.'))
                    }).catch(error => {
                        console.error('An error occurred while finding CategoryMember with userId:', userId, 'and categoryId:', categoryId, 'and upserting dateJoined as the current time and roles as an empty array. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while adding you to the category. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one category with id:', categoryId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding category. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #leavecategory = (userId, categoryId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (typeof categoryId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`categoryId must be a string. Provided type: ${typeof categoryId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (!mongoose.isObjectIdOrHexString(categoryId)) {
                return resolve(HTTPWTHandler.badInput('categoryId must be an ObjectId.'))
            }

            User.findOne({_id: {$eq: userId}}).then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }

                Category.findOne({_id: {$eq: categoryId}}).then(categoryFound => {
                    if (!categoryFound) {
                        return resolve(HTTPWTHandler.notFound('Could not find category.'))
                    }

                    CategoryMember.deleteMany({userId: {$eq: userId}, categoryId: {$eq: categoryId}}).then(() => {
                        return resolve(HTTPWTHandler.OK('Successfully left category'))
                    }).catch(error => {
                        console.error('An error occurred while deleting many category members with userId:', userId, 'and categoryId:', categoryId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while leaving category. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one category with id:', categoryId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding category. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #postthread = (userId, title, subtitle, tags, categoryId, imageDescription, NSFW, NSFL, file) => {
        return new Promise(resolve => {
            const deleteImage = () => {
                if (file) {
                    imageHandler.deleteMulterTempImage(file.filename)
                }
            }

            if (typeof userId !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                deleteImage()
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof title !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`title must be a string. Provided type: ${typeof title}`))
            }

            if (typeof subtitle !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`subtitle must be a string. Provided type: ${typeof subtitle}`))
            }

            if (typeof tags !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`tags must be a string. Provided type: ${typeof tags}`))
            }

            if (typeof categoryId !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`categoryId must be a string. Provided type: ${typeof categoryId}`))
            }

            if (file && typeof imageDescription !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`imageDescription must be a string. Provided type: ${typeof imageDescription}`))
            }

            if (typeof NSFW !== 'boolean' && NSFW !== "false" && NSFW !== "true") {
                deleteImage()
                return resolve(HTTPWTHandler.badInput('NSFW must either be a boolean, "false", or "true"'))
            }

            if (typeof NSFL !== 'boolean' && NSFL !== "false" && NSFL !== "true") {
                deleteImage()
                return resolve(HTTPWTHandler.badInput('NSFL must either be a boolean, "false", or "true"'))
            }

            if (NSFW === "false") {
                NSFW = false
            }

            if (NSFW === "true") {
                NSFW = true
            }

            if (NSFL === "false") {
                NSFL = false
            }

            if (NSFL === "true") {
                NSFL = true
            }

            title = title.trim();
            subtitle = subtitle.trim();
            tags = tags.trim();
            categoryId = categoryId.trim();
            imageDescription = imageDescription.trim();

            if (title.length > CONSTANTS.MAX_THREAD_TITLE_LENGTH || title.length == 0) {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`title must be between 1 and ${CONSTANTS.MAX_THREAD_TITLE_LENGTH} characters long.`))
            }

            if (!CONSTANTS.VALID_THREAD_TITLE_TEST.test(title)) {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_TITLE_FAILED_TEST_ERROR_MESSAGE))
            }

            if (subtitle.length > CONSTANTS.MAX_THREAD_SUBTITLE_LENGTH) {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`subtitle must be ${CONSTANTS.MAX_THREAD_SUBTITLE_LENGTH} or less characters long.`))
            }

            if (!CONSTANTS.VALID_THREAD_SUBTITLE_TEST.test(subtitle)) {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_SUBTITLE_FAILED_TEST_ERROR_MESSAGE))
            }

            if (tags.length > CONSTANTS.MAX_THREAD_TAGS_LENGTH) {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`tags must not be longer than ${CONSTANTS.MAX_THREAD_TAGS_LENGTH} characters`))
            }

            if (!CONSTANTS.VALID_THREAD_TAGS_TEST.test(tags)) {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_TAGS_FAILED_TEST_ERROR_MESSAGE))
            }

            if (imageDescription.length > CONSTANTS.MAX_THREAD_IMAGE_DESCRIPTION_LENGTH) {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`imageDescription must be ${CONSTANTS.MAX_THREAD_IMAGE_DESCRIPTION_LENGTH} or less characters long`))
            }

            if (!CONSTANTS.VALID_THREAD_IMAGE_DESCRIPTION_TEST.test(imageDescription)) {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(CONSTANTS.THREAD_IMAGE_DESCRIPTION_FAILED_TEST_ERROR_MESSAGE))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(result => {
                if (result) {
                    Category.findOne({_id: {$eq: threadCategoryId}}).lean().then(async data => {
                        if (data) {
                            const NSFW = data.NSFW;
                            const NSFL = data.NSFL;

                            if (NSFW && !NSFW && !NSFL) {
                                deleteImage()
                                return resolve(HTTPWTHandler.forbidden('NSFW thread posts cannot be posted in non-NSFW categories.'))
                            }

                            if (NSFL && !NSFL) {
                                deleteImage()
                                return resolve(HTTPWTHandler.forbidden('NSFL thread posts cannot be posted in non-NSFL categories.'))
                            }

                            let imageKey;
                            if (file) {
                                try {
                                    imageKey = await imageHandler.compressImage(file.filename)
                                } catch (e) {
                                    console.error('An error was thrown from ImageLibrary.compressImage while compressing image with filename:', file.filename, '. The error was:', e)
                                    deleteImage()
                                    return resolve(HTTPWTHandler.serverError('Failed to compress image'))
                                }
                            }

                            const newThreadObject = {
                                creatorId: userId,
                                title: title,
                                subtitle: subtitle,
                                tags: tags,
                                categoryId: categoryId,
                                body: "",
                                NSFW: NSFW,
                                NSFL: NSFL,
                                datePosted: Date.now()
                            };

                            if (imageKey) {
                                newThreadObject.imageKey = imageKey
                                newThreadObject.imageDescription = imageDescription
                            }

                            const newThread = new Thread(newThreadObject);

                            newThread.save().then(() => {
                                return resolve(HTTPWTHandler.OK('Creation successful'))
                            }).catch(err => {
                                if (imageKey) imageHandler.deleteImageByKey(imageKey);
                                console.error('An error occurred while saving a new thread post with an image with newThreadObject:', newThreadObject, 'to the database:', err)
                                return resolve(HTTPWTHandler.serverError('An error occurred while saving image thread. Please try again.'))
                            })
                        } else {
                            deleteImage()
                            return resolve(HTTPWTHandler.notFound('Category could not be found'))
                        }
                    }).catch(error => {
                        deleteImage()
                        console.error('An error occured while finding category with id:', categoryId, '. The error was:', error)
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (typeof categoryId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`categoryId must be a string. Provided type: ${typeof categoryId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (!mongoose.isObjectIdOrHexString(categoryId)) {
                return resolve(HTTPWTHandler.badInput('categoryId must be an ObjectId.'))
            }

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

    static #getthreadsfromprofile = (userId, pubId, lastItemId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Type provided: ${typeof pubId}`))
            }

            if (pubId.length === 0) {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string.'))
            }

            if (typeof lastItemId !== 'string' && lastItemId !== undefined) {
                return resolve(HTTPWTHandler.badInput(`lastItemId must either be a string or undefined. Type provided: ${typeof lastItemId}`))
            }

            if (typeof lastItemId === 'string' && !mongoose.isObjectIdOrHexString(lastItemId)) {
                return resolve(HTTPWTHandler.badInput('lastItemId must be an ObjectId string or undefined.'))
            }

            User.findOne({secondId: {$eq: pubId}}).lean().then(userResult => {
                if (userResult) {
                    User.findOne({_id: {$eq: userId}}).lean().then(userRequestingThreads => {
                        if (userRequestingThreads && !userResult.blockedAccounts?.includes(userRequestingThreads.secondId)) {
                            if (userId != userResult._id && (userResult.privateAccount && !userResult.followers.includes(userRequestingThreads.secondId))) {
                                return resolve(HTTPWTHandler.notFound('This user has no thread posts!'))
                            }
                            var userid = userResult._id
                            console.log("user id:")
                            console.log(userid)

                            const dbQuery = {
                                creatorId: {$eq: userid}
                            }

                            if (lastItemId) {
                                dbQuery._id = {$lt: lastItemId}
                            }

                            Thread.find(dbQuery).sort({_id: -1}).limit(CONSTANTS.NUM_THREAD_POSTS_TO_SEND_PER_API_CALL).lean().then(result => {
                                if (result.length === 0) return resolve(HTTPWTHandler.OK('No more threads to show.', {items: [], noMoreItems: true}))

                                threadPostHandler.processMultiplePostDataFromOneOwner(result, userResult, userRequestingThreads).then(posts => {
                                    const toSend = {
                                        items: posts,
                                        noMoreItems: posts.length < CONSTANTS.NUM_THREAD_POSTS_TO_SEND_PER_API_CALL
                                    }

                                    return resolve(HTTPWTHandler.OK('Posts found', toSend))
                                }).catch(error => {
                                    console.error('An error occurred while processing thread posts. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while getting thread posts. Please try again.'))
                                })
                            }).catch(error => {
                                console.error('An error occurred while finding threads with creatorId:', userid, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding threads. Please try again.'))
                            })
                        } else {
                            return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))
                }
            }).catch(err => {
                console.error('An error occurred while finding user with secondId:', pubId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getthreadbyid = (userId, threadId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (!mongoose.isObjectIdOrHexString(threadId)) {
                return resolve(HTTPWTHandler.badInput('threadId must be an ObjectId.'))
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
                                                return resolve(HTTPWTHandler.OK('Posts found', posts[0]))
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (!mongoose.isObjectIdOrHexString(threadId)) {
                return resolve(HTTPWTHandler.badInput('threadId must be an ObjectId.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                Thread.findOne({_id: {$eq: threadId}}).lean().then(threadFound => {
                    if (!threadFound) return resolve(HTTPWTHandler.notFound('Thread could not be found'))

                    if (String(threadFound.creatorId) !== userId) return resolve(HTTPWTHandler.forbidden('You are not authorised to delete this post.'))

                    Comment.find({postId: {$eq: threadId}, postFormat: "Thread"}, '_id').lean().then(commentsFound => {
                        const commentIds = commentsFound.map(comment => comment._id)

                        mongoose.startSession().then(session => {
                            session.startTransaction();

                            Thread.deleteOne({_id: {$eq: threadId}}, {session}).then(() => {
                                const upvoteBulkUpdates = [
                                    {
                                        deleteMany: {
                                            filter: {postId: {$eq: threadId}, postFormat: "Thread"}
                                        }
                                    }
                                ];

                                if (commentIds.length < 1) {
                                    upvoteBulkUpdates.push({
                                        deleteMany: {
                                            filter: {postId: {$in: commentIds}, postFormat: "Comment"}
                                        }
                                    })
                                }

                                Upvote.bulkWrite(upvoteBulkUpdates, {session}).then(() => {
                                    const downvoteBulkUpdates = [
                                        {
                                            deleteMany: {
                                                filter: {postId: {$eq: threadId}, postFormat: "Thread"}
                                            }
                                        }
                                    ];

                                    if (commentIds.length < 1) {
                                        downvoteBulkUpdates.push({
                                            deleteMany: {
                                                filter: {postId: {$in: commentIds}, postFormat: "Comment"}
                                            }
                                        })
                                    }

                                    Downvote.bulkWrite(downvoteBulkUpdates, {session}).then(() => {
                                        Comment.deleteMany({postId: {$eq: threadId}, postFormat: "Thread"}, {session}).then(() => {
                                            mongooseSessionHelper.commitTransaction(session).then(() => {
                                                return resolve(HTTPWTHandler.OK('Successfully deleted thread post'))
                                            }).catch(() => {
                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting thread post and associated data. Please try again.'))
                                            })
                                        }).catch(error => {
                                            console.error('An error occurred while deleting all comments from thread post with id:', threadId, '. The error was:', error)
                                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting thread post comments. Please try again.'))
                                            })
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while deleting thread (making bulk updates on the Downvote collection):', downvoteBulkUpdates, '. The error was:', error)
                                        mongooseSessionHelper.abortTransaction(session).then(() => {
                                            return resolve(HTTPWTHandler.serverError('An error occurred while deleting thread downvotes. Please try again.'))
                                        })
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while deleting thread (making bulk updates on the Upvote collection):', upvoteBulkUpdates, '. The error was:', error)
                                    mongooseSessionHelper.abortTransaction(session).then(() => {
                                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting thread upvotes. Please try again.'))
                                    })
                                })
                            }).catch(error => {
                                console.error('An error occurred while deleting one thread with id:', threadId, '. The error was:', error)
                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting thread. Please try again.'))
                                })
                            })
                        }).catch(error => {
                            console.error('An error occurred while starting Mongoose session:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while starting to delete thread post. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding comments from thread post with id:', threadId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding comments to delete. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one thread with id:', threadId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding thread. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #reloadUsersDetails = (userId, usersPubId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

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
                                return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))
                            } else {
                                const userDataToSend = userHandler.returnPublicInformation(userData, userSearching);

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
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #earnSpecialBadge = (userId, badgeEarnt) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

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

                        User.bulkWrite(dbUpdates, {session}).then(() => {
                            mongooseSessionHelper.commitTransaction(session).then(() => {
                                return resolve(HTTPWTHandler.OK('Account is now public.'))
                            }).catch(() => {
                                return resolve(HTTPWTHandler.serverError('An error occurred while making account public. Please try again.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while making a bulkWrite operation on the User collection:', dbUpdates, '. The error was:', error)
                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                return resolve(HTTPWTHandler.serverError('An error occurred while making account public. Please try again.'))
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

    static #getfollowrequests = (userId, skip) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (skip?.length > 12) return resolve(HTTPWTHandler.badInput('Skip cannot have a length greater than 12'))

            const parsedSkip = parseInt(skip);
            if (isNaN(parsedSkip)) return resolve(HTTPWTHandler.badInput(`Skip must be a number.`))

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))

                if (Array.isArray(userFound.accountFollowRequests)) {
                    if (userFound.accountFollowRequests.length < 1) {
                        return resolve(HTTPWTHandler.OK('No account follow requests', {items: [], noMoreItems: true, skip: 0}))
                    }

                    const {items, noMoreItems} = arrayHelper.returnSomeItems(userFound.accountFollowRequests, parsedSkip, CONSTANTS.MAX_ACCOUNT_FOLLOW_REQUESTS_PER_API_CALL);

                    User.find({secondId: {$in: items}}).lean().then(users => {
                        const {foundDocuments, missingDocuments} = arrayHelper.returnDocumentsFromIdArray(items, users, 'secondId');

                        if (missingDocuments.length > 0) {
                            console.error('Found users that are in follow request fields of other users. The ids are:', missingDocuments)
                        }

                        const toSend = foundDocuments.map(item => {
                            return userHandler.returnPublicInformation(item, userFound)
                        })

                        return resolve(HTTPWTHandler.OK('Successfully found requests', {items: toSend, noMoreItems, skip: parsedSkip + items.length}))
                    }).catch(error => {
                        console.error('An error occurred while finding users with ids in:', items, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding account follow requests. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.OK('accountFollowRequests is not an array - there are no requests', {items: [], noMoreItems: true, skip: 0}))
                }
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #denyfollowrequest = (userId, accountFollowRequestDeniedPubID) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

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
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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

                if (!userFound.accountFollowRequests?.includes(accountFollowRequestAcceptedPubID)) {
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
                            filter: {secondId: {$eq: accountFollowRequestAcceptedPubID}},
                            update: {$push: {following: userFound.secondId}}
                        }
                    }
                ]

                mongoose.startSession().then(session => {
                    session.startTransaction();

                    User.bulkWrite(dbUpdates, {session}).then(() => {
                        mongooseSessionHelper.commitTransaction(session).then(() => {
                            return resolve(HTTPWTHandler.OK('Successfully accepted follow request'))
                        }).catch(() => {
                            return resolve(HTTPWTHandler.serverError('An error occurred while accepting follow request. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while making a bulkWrite operation on the User collection:', dbUpdates, '. The error was:', error)
                        mongooseSessionHelper.abortTransaction(session).then(() => {
                            return resolve(HTTPWTHandler.serverError('An error occurred while accepting follow request. Please try again.'))
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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

                        User.bulkWrite(dbUpdates, {session}).then(() => {
                            mongooseSessionHelper.commitTransaction(session).then(() => {
                                return resolve(HTTPWTHandler.OK('Successfully removed follower from account'))
                            }).catch(() => {
                                return resolve(HTTPWTHandler.serverError('An error occurred while removing follower from account. Please try again.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while making a bulkWrite operation on the User collection:', dbUpdates, '. The error was:', error)
                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                return resolve(HTTPWTHandler.serverError('An error occurred while removing follower from account. Please try again.'))
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
                                update: {$pull: {followers: userToBlockFound.secondId, accountFollowRequests: userToBlockFound.secondId}, $push: {blockedAccounts: userToBlockFound.secondId}}
                            }
                        },
                        {
                            updateOne: {
                                filter: {secondId: {$eq: userToBlockPubId}},
                                update: {$pull: {following: userFound.secondId, accountFollowRequests: userFound.secondId}}
                            }
                        }
                    ]

                    mongoose.startSession().then(session => {
                        session.startTransaction();

                        User.bulkWrite(dbUpdates, {session}).then(() => {
                            mongooseSessionHelper.commitTransaction(session).then(() => {
                                return resolve(HTTPWTHandler.OK('Successfully blocked account'))
                            }).catch(() => {
                                return resolve(HTTPWTHandler.serverError('An error occurred while blocking account. Please try again.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while making a bulkWrite operation on the User collection:', dbUpdates, '. The error was:', error)
                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                return resolve(HTTPWTHandler.serverError('An error occurred while blocking account. Please try again.'))
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

    static #getuserblockedaccounts = (userId, skip) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            if (skip === undefined) skip = 0;
            if (typeof skip !== 'number') return resolve(HTTPWTHandler.badInput(`skip must be either undefined or a number. Type provided: ${typeof skip}`));

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                const blockedAccounts = userFound?.blockedAccounts || [];

                if (blockedAccounts.length === 0) return resolve(HTTPWTHandler.OK('Successfully found blocked accounts', []))

                const {items, noMoreItems} = arrayHelper.returnSomeItems(blockedAccounts, skip, CONSTANTS.NUM_BLOCKED_ACCOUNTS_TO_SEND_PER_API_CALL);

                User.find({secondId: {$in: items}}).lean().then(blockedUsers => {
                    const publicInformation = blockedUsers.map(user => {
                        const data = userHandler.returnPublicInformation(user, userFound)
                        data.blocked = true;
                        return data
                    })

                    return resolve(HTTPWTHandler.OK('Successfully found blocked accounts', {items: publicInformation, noMoreItems}))
                }).catch(error => {
                    console.error('An error occurred while finding users with secondIds in this array:', blockedAccounts, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding users. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #unblockaccount = (userId, userToUnblockPubId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with userId provided'))
                }

                User.findOneAndUpdate({_id: {$eq: userId}}, {$set: {'settings.algorithmSettings.enabled': true}}).then(() => {
                    return resolve(HTTPWTHandler.OK('Algorithm has now been enabled.'))
                }).catch(error => {
                    console.error('An error occurred while setting settings.algorithmSettings.enabled to true for user with id:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while enabling algorithm. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getAuthenticationFactorsEnabled = (userId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }

                User.findOneAndUpdate({_id: {$eq: userId}}, {$set: {'settings.algorithmSettings.enabled': false}}).then(() => {
                    return resolve(HTTPWTHandler.OK('Algorithm has now been disabled.'))
                }).catch(error => {
                    console.error('An error occurred while setting settings.algorithmSettings.enabled to false for user with id:', userId, '. The error was:', error)
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('User with provided userId could not be found'))
                }

                PopularPosts.findOne({}).lean().then(async popularPostDocument => {
                    const popularPosts = popularPostDocument ? popularPostDocument.popularPosts : []
                    const newPopularPosts = popularPosts.filter(post => post.creatorId.toString() !== userId)


                    Promise.all([
                        ImagePost.find({creatorId: {$eq: userId}}, 'imageKey').lean(),
                        Thread.find({creatorId: {$eq: userId}}, 'threadImageKey threadType').lean(),
                        Poll.find({creatorId: {$eq: userId}}, '_id').lean()
                    ]).then(([imagePosts, threadPosts, pollPosts]) => {
                        const imagePostIds = imagePosts.map(post => String(post._id))
                        const pollPostIds = pollPosts.map(post => String(post._id))
                        const threadPostIds = threadPosts.map(post => String(post._id))

                        Promise.all([
                            imagePostIds.length > 0 ? Comment.find({postId: {$in: imagePostIds}, postFormat: "Image"}, '_id').lean() : Promise.resolve([]),
                            pollPostIds.length > 0 ? Comment.find({postId: {$in: pollPostIds}, postFormat: "Poll"}, '_id').lean() : Promise.resolve([]),
                            threadPostIds.length > 0 ? Comment.find({postId: {$in: threadPostIds}, postFormat: "Thread"}, '_id').lean() : Promise.resolve([])
                        ]).then(([imageCommentIds, pollCommentIds, threadCommentIds]) => {
                            const imageKeys = imagePosts.map(post => post.imageKey)
                            const threadImageKeys = threadPosts.map(post => post.imageKey).filter(key => typeof key === 'string' && key.length !== 0)

                            mongoose.startSession().then(session => {
                                session.startTransaction();

                                (popularPosts.length !== newPopularPosts.length ? PopularPosts.findOneAndUpdate({}, {popularPosts: newPopularPosts}, {session}) : Promise.resolve('Popular posts do not need to be updated')).then(() => {
                                    ImagePost.deleteMany({creatorId: {$eq: userId}}, {session}).then(() => {
                                        Poll.deleteMany({creatorId: {$eq: userId}}, {session}).then(() => {
                                            const pollVoteBulkWrites = [
                                                {
                                                    deleteMany: {
                                                        filter: {userId: {$eq: userId}}
                                                    }
                                                }
                                            ]

                                            if (pollPostIds.length > 0) {
                                                pollVoteBulkWrites.push({
                                                    deleteMany: {
                                                        filter: {postId: {$in: pollPostIds}}
                                                    }
                                                })
                                            }

                                            PollVote.bulkWrite(pollVoteBulkWrites, {session}).then(() => {
                                                Thread.deleteMany({creatorId: {$eq: userId}}, {session}).then(() => {
                                                    Message.deleteMany({senderId: {$eq: userId}}, {session}).then(() => {
                                                        const userBulkWrites = [
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
                                                        ];

                                                        User.bulkWrite(userBulkWrites, {session}).then(() => {
                                                            const downvoteBulkWrites = [
                                                                {
                                                                    deleteMany: {
                                                                        filter: {userPublicId: userFound.secondId}
                                                                    }
                                                                }
                                                            ];

                                                            if (imageCommentIds.length > 0) {
                                                                downvoteBulkWrites.push({
                                                                    deleteMany: {
                                                                        filter: {postId: {$in: imageCommentIds}, postFormat: "Comment"}
                                                                    }
                                                                })
                                                            }

                                                            if (pollCommentIds.length > 0) {
                                                                downvoteBulkWrites.push({
                                                                    deleteMany: {
                                                                        filter: {postId: {$in: pollCommentIds}, postFormat: "Comment"}
                                                                    }
                                                                })
                                                            }

                                                            if (threadCommentIds.length > 0) {
                                                                downvoteBulkWrites.push({
                                                                    deleteMany: {
                                                                        filter: {postId: {$in: threadCommentIds}, postFormat: "Comment"}
                                                                    }
                                                                })
                                                            }

                                                            if (imagePostIds.length > 0) {
                                                                downvoteBulkWrites.push({
                                                                    deleteMany: {
                                                                        filter: {postId: {$in: imagePostIds}, postFormat: "Image"}
                                                                    }
                                                                })
                                                            }

                                                            if (pollPostIds.length > 0) {
                                                                downvoteBulkWrites.push({
                                                                    deleteMany: {
                                                                        filter: {postId: {$in: pollPostIds}, postFormat: "Poll"}
                                                                    }
                                                                })
                                                            }

                                                            if (threadPostIds.length > 0) {
                                                                downvoteBulkWrites.push({
                                                                    deleteMany: {
                                                                        filter: {postId: {$in: threadPostIds}, postFormat: "Thread"}
                                                                    }
                                                                })
                                                            }

                                                            Downvote.bulkWrite(downvoteBulkWrites, {session}).then(() => {
                                                                const upvoteBulkWrites = [
                                                                    {
                                                                        deleteMany: {
                                                                            filter: {userPublicId: userFound.secondId}
                                                                        }
                                                                    }
                                                                ];

                                                                if (imageCommentIds.length > 0) {
                                                                    upvoteBulkWrites.push({
                                                                        deleteMany: {
                                                                            filter: {postId: {$in: imageCommentIds}, postFormat: "Comment"}
                                                                        }
                                                                    })
                                                                }

                                                                if (pollCommentIds.length > 0) {
                                                                    upvoteBulkWrites.push({
                                                                        deleteMany: {
                                                                            filter: {postId: {$in: pollCommentIds}, postFormat: "Comment"}
                                                                        }
                                                                    })
                                                                }

                                                                if (threadCommentIds.length > 0) {
                                                                    upvoteBulkWrites.push({
                                                                        deleteMany: {
                                                                            filter: {postId: {$in: threadCommentIds}, postFormat: "Comment"}
                                                                        }
                                                                    })
                                                                }

                                                                if (imagePostIds.length > 0) {
                                                                    upvoteBulkWrites.push({
                                                                        deleteMany: {
                                                                            filter: {postId: {$in: imagePostIds}, postFormat: "Image"}
                                                                        }
                                                                    })
                                                                }

                                                                if (pollPostIds.length > 0) {
                                                                    upvoteBulkWrites.push({
                                                                        deleteMany: {
                                                                            filter: {postId: {$in: pollPostIds}, postFormat: "Poll"}
                                                                        }
                                                                    })
                                                                }

                                                                if (threadPostIds.length > 0) {
                                                                    upvoteBulkWrites.push({
                                                                        deleteMany: {
                                                                            filter: {postId: {$in: threadPostIds}, postFormat: "Thread"}
                                                                        }
                                                                    })
                                                                }

                                                                Upvote.bulkWrite(upvoteBulkWrites, {session}).then(() => {
                                                                    const accountReportsBulkWrite = [
                                                                        {
                                                                            deleteMany: {
                                                                                filter: {reporterId: {$eq: userId}}
                                                                            }
                                                                        },
                                                                        {
                                                                            deleteMany: {
                                                                                filter: {reportedAccountPubId: {$eq: userFound.secondId}}
                                                                            }
                                                                        }
                                                                    ];

                                                                    AccountReports.bulkWrite(accountReportsBulkWrite, {session}).then(() => {
                                                                        const postReportsBulkWrite = [
                                                                            {
                                                                                deleteMany: {
                                                                                    filter: {reporterId: {$eq: userId}}
                                                                                }
                                                                            }
                                                                        ];

                                                                        if (imagePostIds.length > 0) {
                                                                            postReportsBulkWrite.push({
                                                                                deleteMany: {
                                                                                    filter: {postId: {$in: imagePostIds}, format: {$eq: 'Image'}}
                                                                                }
                                                                            })
                                                                        }

                                                                        if (pollPostIds.length > 0) {
                                                                            postReportsBulkWrite.push({
                                                                                deleteMany: {
                                                                                    filter: {postId: {$in: pollPostIds}, format: {$eq: 'Poll'}}
                                                                                }
                                                                            })
                                                                        }

                                                                        if (threadPostIds.length > 0) {
                                                                            postReportsBulkWrite.push({
                                                                                deleteMany: {
                                                                                    filter: {postId: {$in: threadPostIds}, format: {$eq: 'Thread'}}
                                                                                }
                                                                            })
                                                                        }

                                                                        if (imageCommentIds.length > 0) {
                                                                            postReportsBulkWrite.push({
                                                                                deleteMany: {
                                                                                    filter: {postId: {$in: imageCommentIds}, format: {$eq: 'Comment'}}
                                                                                }
                                                                            })
                                                                        }
            
                                                                        if (pollCommentIds.length > 0) {
                                                                            postReportsBulkWrite.push({
                                                                                deleteMany: {
                                                                                    filter: {postId: {$in: pollCommentIds}, format: {$eq: 'Comment'}}
                                                                                }
                                                                            })
                                                                        }
            
                                                                        if (threadCommentIds.length > 0) {
                                                                            postReportsBulkWrite.push({
                                                                                deleteMany: {
                                                                                    filter: {postId: {$in: threadCommentIds}, format: {$eq: 'Comment'}}
                                                                                }
                                                                            })
                                                                        }

                                                                        PostReports.bulkWrite(postReportsBulkWrite, {session}).then(() => {
                                                                            RefreshToken.deleteMany({userId: {$eq: userId}}, {session}).then(() => {
                                                                                const commentBulkWrites = [
                                                                                    {
                                                                                        deleteMany: {
                                                                                            filter: {commenterId: {$eq: userId}, replies: 0}
                                                                                        }
                                                                                    }
                                                                                ];

                                                                                if (imageCommentIds.length > 0) {
                                                                                    commentBulkWrites.push({
                                                                                        deleteMany: {
                                                                                            filter: {_id: {$in: imageCommentIds}}
                                                                                        }
                                                                                    })
                                                                                }

                                                                                if (pollCommentIds.length > 0) {
                                                                                    commentBulkWrites.push({
                                                                                        deleteMany: {
                                                                                            filter: {_id: {$in: pollCommentIds}}
                                                                                        }
                                                                                    })
                                                                                }

                                                                                if (threadCommentIds.length > 0) {
                                                                                    commentBulkWrites.push({
                                                                                        deleteMany: {
                                                                                            filter: {_id: {$in: threadCommentIds}}
                                                                                        }
                                                                                    })
                                                                                }

                                                                                Comment.bulkWrite(commentBulkWrites, {session}).then(() => {
                                                                                    CategoryMember.deleteMany({userId: {$eq: userId}}, {session}).then(() => {
                                                                                        if (userFound.profileImageKey) {
                                                                                            imageHandler.deleteImageByKey(userFound.profileImageKey)
                                                                                        }

                                                                                        for (const imageKey of imageKeys) {
                                                                                            imageHandler.deleteImageByKey(imageKey)
                                                                                        }

                                                                                        for (const imageKey of threadImageKeys) {
                                                                                            imageHandler.deleteImageByKey(imageKey)
                                                                                        }

                                                                                        Promise.all([
                                                                                            ImagePost.updateMany({'viewedBy.pubId': {$eq: userFound.secondId}}, {$pull: {viewedBy: {pubId: userFound.secondId}}}, {session}),
                                                                                            Poll.updateMany({'viewedBy.pubId': {$eq: userFound.secondId}}, {$pull: {viewedBy: {pubId: userFound.secondId}}}, {session}),
                                                                                            Thread.updateMany({'viewedBy.pubId': {$eq: userFound.secondId}}, {$pull: {viewedBy: {pubId: userFound.secondId}}}, {session})
                                                                                        ]).then(() => {
                                                                                            mongooseSessionHelper.commitTransaction(session).then(() => {
                                                                                                return resolve(HTTPWTHandler.OK('Successfully deleted account and all associated data.'))
                                                                                            }).catch(() => {
                                                                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting your account and associated data. Please try again.'))
                                                                                            })
                                                                                        }).catch(error => {
                                                                                            console.error('An error occurred while removing viewedBy fields for user with pubId:', userFound.secondId, '. The error was:', error)
                                                                                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                                                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing data about posts you have viewed. Please try again.'))
                                                                                            })
                                                                                        })
                                                                                    }).catch(error => {
                                                                                        console.error('An error occurred while deleting all CategoryMember documents with userId:', userId, '. The error was:', error)
                                                                                        mongooseSessionHelper.abortTransaction(session).then(() => {
                                                                                            return resolve(HTTPWTHandler.serverError('An error occurred while removing you from categories. Please try again.'))
                                                                                        })
                                                                                    })
                                                                                }).catch(error => {
                                                                                    console.error('An error occurred while making a bulkWrite operation on Comment collection:', commentBulkWrites, '. The error was:', error)
                                                                                })
                                                                            }).catch(error => {
                                                                                console.error('An error occurred while deleting all refresh tokens with userId:', userId, '. The error was:', error)
                                                                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                                                                    return resolve(HTTPWTHandler.serverError('An error occurred while logging out all devices from your account. Please try again.'))
                                                                                })
                                                                            })
                                                                        }).catch(error => {
                                                                            console.error('An error occurred while making a bulkWrite operation on the PostReports collection:', postReportsBulkWrite, '. The error was:', error)
                                                                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting post reports. Please try again.'))
                                                                            })
                                                                        })
                                                                    }).catch(error => {
                                                                        console.error('An error occurred while making a bulkWrite operation on the AccountReports collection:', accountReportsBulkWrite, '. The error was:', error)
                                                                        mongooseSessionHelper.abortTransaction(session).then(() => {
                                                                            return resolve(HTTPWTHandler.serverError('An error occurred while deleting account reports. Please try again.'))
                                                                        })
                                                                    })
                                                                }).catch(error => {
                                                                    console.error('An error occurred while making a bulkWrite operation on the Upvote collection:', upvoteBulkWrites, '. The error was:', error)
                                                                    mongooseSessionHelper.abortTransaction(session).then(() => {
                                                                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting your upvotes and upvotes from your posts and comments. Please try again.'))
                                                                    })
                                                                })
                                                            }).catch(error => {
                                                                console.error('An error occurred while making a bulkWrite operation on the Downvote collection:', downvoteBulkWrites, '. The error was:', error)
                                                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting your downvotes and downvotes from your posts and comments. Please try again.'))
                                                                })
                                                            })
                                                        }).catch(error => {
                                                            console.error('An error occurred while making a bulkWrite operation to the User collection:', userBulkWrites, '. The error was:', error)
                                                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting account, blocked accounts, and followers. Please try again.'))
                                                            })
                                                        })
                                                    }).catch(error => {
                                                        console.error('An error occurred while deleting all messages with senderId:', userId, '. The error was:', error)
                                                        mongooseSessionHelper.abortTransaction(session).then(() => {
                                                            return resolve(HTTPWTHandler.serverError('An error occurred while deleting chat messages. Please try again.'))
                                                        })
                                                    })
                                                }).catch(error => {
                                                    console.error('An error occurred while deleting all thread posts with creatorId:', userId, '. The error was:', error)
                                                    mongooseSessionHelper.abortTransaction(session).then(() => {
                                                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting thread posts. Please try again.'))
                                                    })
                                                })
                                            }).catch(error => {
                                                console.error('An error occurred while making a bulkWrite operation to the PollVote collection:', pollVoteBulkWrites, '. The error was:', error)
                                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                                    return resolve(HTTPWTHandler.serverError('An error occurred while removing poll votes. Please try again.'))
                                                })
                                            })
                                        }).catch(error => {
                                            console.error('An error occurred while deleting all poll posts with creatorId:', userId, '. The error was:', error)
                                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting poll posts. Please try again.'))
                                            })
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while deleting all image posts with creatorId:', userId, '. The error was:', error)
                                        mongooseSessionHelper.abortTransaction(session).then(() => {
                                            return resolve(HTTPWTHandler.serverError('An error occurred while deleting image posts. Please try again.'))
                                        })
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while updating popularPosts:', error)
                                    mongooseSessionHelper.abortTransaction(session).then(() => {
                                        return resolve(HTTPWTHandler.serverError('An error occurred while removing popular post. Please try again.'))
                                    })
                                })
                            }).catch(error => {
                                console.log('An error occurred while starting Mongoose session. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting account. Please try again.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while finding comments to delete for user with id:', userId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding comments to delete. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while getting posts with images before deleting account. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding images to delete. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding popular posts. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding popular posts. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occured while finding user with id:', userID + '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #checkIfCategoryExists = (title) => {
        return new Promise(resolve => {
            Category.exists({title: {'$regex': `^${title}$`, $options: 'i'}}).then(category => {
                if (category) {
                    return resolve(HTTPWTHandler.OK(true))
                } else {
                    return resolve(HTTPWTHandler.OK(false))
                }
            }).catch(error => {
                console.error('An error occured while checking if a category existed with title:', title, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred. Please try again.'))
            })
        })
    }

    static #uploadNotificationsSettings = (userId, notificationSettings) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof reporterId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`reporterId must be a string. Provided type: ${typeof reporterId}`))
            }

            if (!mongoose.isObjectIdOrHexString(reporterId)) {
                return resolve(HTTPWTHandler.badInput('reporterId must be an ObjectId.'))
            }

            if (typeof reporteePubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`reporteePubId must be a string. Provided type: ${typeof reporteePubId}`))
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

            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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

            const lastItemId = votes.length > 0 ? votes[votes.length - 1]._id.toString() : null
            const noMoreItems = votes.length < CONSTANTS.GET_USER_ACTIVITY_API_LIMIT

            if (votes.length < 1) {
                const toSend = {
                    items: [],
                    lastItemId,
                    noMoreItems
                }

                return resolve(HTTPWTHandler.OK('Found no activity', toSend))
            }

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
                    items: [].concat(...arrays),
                    lastItemId,
                    noMoreItems
                }

                return resolve(HTTPWTHandler.OK(`Successfully found ${postFormat.toLowerCase()} posts ${skip} - ${skip + toSend.length}`, toSend))
            }).catch(error => {
                console.error('An error occurred while processing image posts. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while processing image posts. Please try again.'))
            })
        })
    }

    static #reportPost = (reporterId, postId, postFormat, reason) => {
        return new Promise(async resolve => {
            let post;

            if (typeof reporterId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`reporterId must be a string. Provided type: ${typeof reporterId}`))
            }

            if (!mongoose.isObjectIdOrHexString(reporterId)) {
                return resolve(HTTPWTHandler.badInput('reporterId must be an ObjectId.'))
            }

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

            const supportedFormats = ['Image', 'Poll', 'Thread', 'Comment']

            if (!supportedFormats.includes(postFormat)) {
                return resolve(HTTPWTHandler.badInput('Invalid post format supplied'))
            }

            try {
                switch(postFormat) {
                    case 'Image':
                        post = await ImagePost.findOne({_id: {$eq: postId}}).lean();
                        break;
                    case 'Poll':
                        post = await Poll.findOne({_id: {$eq: postId}}).lean();
                        break;
                    case 'Thread':
                        post = await Thread.findOne({_id: {$eq: postId}}).lean();
                        break;
                    case 'Comment':
                        post = await Comment.findOne({_id: {$eq: postId}}).lean();
                        break;
                }
            } catch (error) {
                console.error('An error occurred while finding one', postFormat, 'post with id:', postId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding post. Please try again.'))
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
                    let newAlgorithmSettings = {...newUserSettings.algorithmSettings};
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

                    User.findOneAndUpdate({_id: {$eq: userId}}, {$set: {'settings.algorithmSettings': newAlgorithmSettings}}).then(function() {
                        return resolve(HTTPWTHandler.OK('Algorithm settings updated successfully.'))
                    }).catch(error => {
                        console.error('An error occured while changing settings for user with ID:', userId, '. These are the new algorithm settings:', newAlgorithmSettings, '. The error was:', error);
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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

            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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

                if (items.length < 1) {
                    return resolve(HTTPWTHandler.OK('Successfully found no users', {items: [], noMoreItems: true}))
                }

                User.find({secondId: {$in: items}}).lean().then(users => {
                    const {foundDocuments, missingDocuments} = arrayHelper.returnDocumentsFromIdArray(items, users, 'secondId');

                    if (missingDocuments.length > 0) {
                        console.log('Users with ids:', missingDocuments, 'were found when checking the stat:', stat, 'for user with secondId:', profilePublicId, '. These users could not be found in the database.')
                    }

                    const toSend = {
                        items: foundDocuments.map(user => userHandler.returnPublicInformation(user, userRequesting)),
                        noMoreItems,
                        skip: skip + items.length
                    }

                    return resolve(HTTPWTHandler.OK('Successfully retrieved data', toSend))
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            if (typeof tokenToLogout !== 'string') {
                return resolve(HTTPWTHandler.badInput(`tokenToLogout must be a string. Provided type: ${typeof tokenToLogout}`))
            }

            if (!mongoose.isObjectIdOrHexString(tokenToLogout)) {
                return resolve(HTTPWTHandler.badInput('tokenToLogout must be an ObjectId.'))
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            if (typeof tokenIdNotToLogout !== 'string' && tokenIdNotToLogout !== null) {
                return HTTPWTHandler.badInput(`tokenIdNotToLogout must be a string or null. Provided type: ${typeof tokenIdNotToLogout}`)
            }

            if (typeof tokenIdNotToLogout === 'string' && !mongoose.isObjectIdOrHexString(tokenIdNotToLogout)) {
                return resolve(HTTPWTHander.badInput('tokenIdNotToLogout must be an ObjectId.'))
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
                        changesToMake.location = userHandler.getLocationFromIP(formattedIP)
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            if (typeof refreshTokenId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`refreshTokenId must be a string. Type provided: ${typeof refreshTokenId}`))
            }

            if (!mongoose.isObjectIdOrHexString(refreshTokenId)) {
                return resolve(HTTPWTHandler.badInput('refreshTokenId must be an ObjectId.'))
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
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }

            if (!mongoose.isObjectIdOrHexString(commentId)) {
                return resolve(HTTPWTHandler.badInput('commentId must be an ObjectId.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with id.'))

                mongoose.startSession().then(session => {
                    session.startTransaction();

                    Comment.deleteOne({_id: {$eq: commentId}}, {session}).then(() => {
                        Upvote.deleteMany({postFormat: "Comment", postId: {$eq: commentId}}, {session}).then(() => {
                            Downvote.deleteMany({postFormat: "Comment", postId: {$eq: commentId}}, {session}).then(() => {
                                mongooseSessionHelper.commitTransaction(session).then(() => {
                                    return resolve(HTTPWTHandler.OK('Successfully deleted comment', {softDelete: false}))
                                }).catch(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting comment. Please try again.'))
                                })
                            }).catch(error => {
                                console.error('An error occurred while deleting all downvotes from comment with id:', commentId, '. The error was:', error)
                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting comment downvotes. Please try again.'))
                                })
                            })
                        }).catch(error => {
                            console.error('An error occurred while deleting all upvotes from comment with id:', commentId, '. The error was:', error)
                            mongooseSessionHelper.abortTransaction(session).then(() => {
                                return resolve(HTTPWTHandler.serverError('An error occurred while deleting comment upvotes. Please try again.'))
                            })
                        })
                    }).catch(error => {
                        console.error('An error occurred while deleting one comment with id:', commentId, '. The error was:', error)
                        mongooseSessionHelper.abortTransaction(session).then(() => {
                            return resolve(HTTPWTHandler.serverError('An error occurred while deleting comment. Please try again.'))
                        })
                    })
                }).catch(error => {
                    console.error('An error occurred while starting Mongoose session. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while starting to delete the comment. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #voteoncomment = (userId, commentId, voteType) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            console.log('VOTE TYPE:', voteType)
            if (voteType !== "Down" && voteType !== "Up") {
                return resolve(HTTPWTHandler.badInput("voteType must be either Down or Up."))
            }

            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }

            if (!mongoose.isObjectIdOrHexString(commentId)) {
                return resolve(HTTPWTHandler.badInput('commentId must be an ObjectId.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                Comment.findOne({_id: {$eq: commentId}}).lean().then(async commentFound => {
                    if (!commentFound) return resolve(HTTPWTHandler.notFound('Could not find comment.'))

                    if (commentFound.commenterId == userId) return resolve(HTTPWTHandler.forbidden('You cannot add votes to your own comments.'))

                    User.findOne({_id: {$eq: commentFound.commenterId}}).lean().then(commentOwner => {
                        if (!commentOwner) {
                            console.error('Found comment with id:', commentFound._id, 'that does not have a corresponding owner. Owner id:', commentFound.commenterId, '. This comment should get deleted immediately.')
                            return resolve(HTTPWTHandler.notFound('Could not find comment owner.'))
                        }

                        if (userId != commentFound.commenterId && commentOwner.blockedAccounts?.includes(userFound.secondId)) return resolve(HTTPWTHandler.notFound('Could not find comment'))

                        POST_DATABASE_MODELS[commentFound.postFormat].findOne({_id: {$eq: commentFound.postId}}).lean().then(async postFound => {
                            if (!postFound) {
                                console.error('A comment was found without an associating post. Comment data:', commentFound)
                                return resolve(HTTPWTHandler.notFound('Could not find post that comment is associated with.'))
                            }

                            let postOwner;

                            try {
                                postOwner = userId == postFound.creatorId ? userFound : await User.findOne({_id: {$eq: postFound.creatorId}}).lean()
                            } catch (error) {
                                console.error('An error occurred while finding one user with id:', postFound.creatorId, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding user that owns post that the comment is associated with. Please try again.'))
                            }

                            if (userId != postFound.creatorId && (
                                postOwner.blockedAccounts?.includes(userFound.secondId) || (postOwner.privateAccount && !postOwner.followers.includes(userFound.secondId))
                            )) {
                                return resolve(HTTPWTHandler.notFound('Comment could not be found.'))
                            }

                            const voteTypeToAdd = voteType === "Down" ? Downvote : Upvote
                            const voteTypeToRemove = voteType === "Down" ? Upvote : Downvote

                            mongoose.startSession().then(session => {
                                session.startTransaction();

                                voteTypeToAdd.findOneAndUpdate({postId: {$eq: commentId}, postFormat: "Comment", userPublicId: {$eq: userFound.secondId}}, {interactionDate: Date.now()}, {session, upsert: true}).then(() => {
                                    voteTypeToRemove.deleteMany({postId: {$eq: commentId}, postFormat: "Comment", userPublicId: userFound.secondId}, {session}).then(() => {
                                        mongooseSessionHelper.commitTransaction(session).then(() => {
                                            return resolve(HTTPWTHandler.OK('Successfully made vote on comment'))
                                        }).catch(() => {
                                            return resolve(HTTPWTHandler.serverError('An error occurred while adding vote to comment. Please try again.'))
                                        })
                                    }).catch(error => {
                                        console.error('An error occurred while deleting all', voteType, 'votes from comment with id:', commentId, 'and user with secondId:', userFound.secondId, '. The error was:', error)
                                        mongooseSessionHelper.abortTransaction(session).then(() => {
                                            return resolve(HTTPWTHandler.serverError(` An error occurred while removing ${voteType}vote from comment. Please try again.`))
                                        })
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while adding', voteType, 'vote to comment with id:', commentId, '. The vote is being made by user with secondId:', userFound.secondId, '. The error was:', error)
                                    mongooseSessionHelper.abortTransaction(session).then(() => {
                                        return resolve(HTTPWTHandler.serverError('An error occurred while adding vote. Please try again.'))
                                    })
                                })
                            }).catch(error => {
                                console.error('An error occurred while starting Mongoose session. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while starting to add vote. Please try again.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while finding a', commentFound.postFormat, 'post with id:', commentFound.postId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding post that comment is associated with. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding one user with id:', commentFound.commenterId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one comment with id:', commentId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding comment. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #postcomment = (userId, comment, postId, postFormat) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }

            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }

            if (!mongoose.isObjectIdOrHexString(postId)) {
                return resolve(HTTPWTHandler.badInput('postId must be an ObjectId.'))
            }

            if (!CONSTANTS.COMMENT_API_ALLOWED_POST_FORMATS.includes(postFormat)) {
                return resolve(HTTPWTHandler.badInput(`postFormat must be either: ${postFormat.join(', ')}`))
            }

            comment = comment.trim();

            if (comment.length == 0) {
                return resolve(HTTPWTHandler.badInput('comment cannot be blank'))
            }

            if (comment.length > CONSTANTS.MAX_USER_COMMENT_LENGTH) {
                return HTTPWTHandler.badInput(`comment cannot be longer than ${CONSTANTS.MAX_USER_COMMENT_LENGTH} characters.`)
            }

            if (!CONSTANTS.VALID_COMMENT_TEST.test(comment)) {
                return resolve(HTTPWTHandler.badInput(`comment must have less than ${CONSTANTS.MAX_USER_COMMENT_LINES} lines`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                POST_DATABASE_MODELS[postFormat].findOne({_id: {$eq: postId}}).lean().then(async postFound => {
                    if (!postFound) return resolve(HTTPWTHandler.notFound('Could not find post that the comment will be associated with.'))

                    let postOwner;

                    try {
                        postOwner = userId == postFound.creatorId ? userFound : await User.findOne({_id: {$eq: postFound.creatorId}}).lean()
                    } catch (error) {
                        console.error('An error occurred while finding one user with id:', postFound.creatorId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding post owner. Please try again.'))
                    }

                    if (postFound.creatorId != userId && (
                        postOwner.blockedAccounts?.includes(userFound.secondId) || (postOwner.privateAccount && !postOwner.followers.includes(userFound.secondId))
                    )) {
                        return resolve(HTTPWTHandler.notFound('Could not find post.'))
                    }

                    const newComment = {
                        commenterId: userId,
                        text: comment,
                        datePosted: Date.now(),
                        postId,
                        postFormat,
                        replies: 0
                    };

                    const commentDocument = new Comment(newComment);
                    commentDocument.save().then(comment => {
                        comment = comment.toObject(); //Convert comment Mongoose document to POJO
                        commentHandler.processOneCommentFromOneOwner(userFound, comment, userFound).then(comment => {
                            return resolve(HTTPWTHandler.OK('Comment was successfully created', comment))
                        }).catch(error => {
                            console.error('An error occurred while processing comment:', error)
                            return resolve(HTTPWTHandler.serverError("Comment has been successfully saved. An error occurred while loading new comment. Please try loading the post's comments again."))
                        })
                    }).catch(error => {
                        console.error('An error occurred while saving comment with data:', newComment, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while saving comment. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding', postFormat, 'post with id:', postId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding the post that the comment will be associated with. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #searchforpostcomments = (userId, postId, postFormat) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            if (typeof postId !== 'string') return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))

            if (!mongoose.isObjectIdOrHexString(postId)) {
                return resolve(HTTPWTHandler.badInput('postId must be an ObjectId.'))
            }

            if (!CONSTANTS.COMMENT_API_ALLOWED_POST_FORMATS.includes(postFormat)) return resolve(HTTPWTHandler.badInput(`postFormat must be one of these: ${CONSTANTS.COMMENT_API_ALLOWED_POST_FORMATS.join(', ')}`))

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                POST_DATABASE_MODELS[postFormat].findOne({_id: {$eq: postId}}).lean().then(async postFound => {
                    if (!postFound) return resolve(HTTPWTHandler.notFound('Could not find post.'))

                    let postOwner;

                    try {
                        postOwner = userId == postFound.creatorId ? userFound : await User.findOne({_id: {$eq: postFound.creatorId}}).lean()
                    } catch (error) {
                        console.error('An error occurred while finding one user with id:', postFound.creatorId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding post owner. Please try again.'))
                    }

                    if (userId != postFound.creatorId && (
                        postOwner.blockedAccounts?.includes(userFound.secondId) && (postOwner.privateAccount && !postOwner.followers.includes(userFound.secondId))
                    )) {
                        return resolve(HTTPWTHandler.notFound('Could not find post.'))
                    }

                    Comment.find({postId: {$eq: postId}, postFormat: {$eq: postFormat}}).lean().then(comments => {
                        if (comments.length === 0) return resolve(HTTPWTHandler.OK('Successfully found comments', []))

                        const uniqueUsers = Array.from(new Set(comments.map(comment => String(comment.commenterId))));

                        User.find({_id: {$in: uniqueUsers}}).lean().then(usersFromDatabase => {
                            const {postsWithNoOwners, ownerPostPairs} = arrayHelper.returnOwnerPostPairs(comments, usersFromDatabase, 'commenterId')

                            if (postsWithNoOwners.length > 0) {
                                console.error('Found comments with no owners:', postsWithNoOwners)
                            }

                            Promise.all(
                                ownerPostPairs.map(pair => {
                                    return commentHandler.processMultipleCommentsFromOneOwner(pair[0], pair[1], userFound)
                                })
                            ).then(comments => {
                                const toSend = comments.flat()
                                return resolve(HTTPWTHandler.OK('Comments were found successfully', toSend))
                            }).catch(error => {
                                console.error('An error occurred while processing comments:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding comment data. Please try again.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while finding users with ids in this array:', uniqueUsers, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding comment owners. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding comments with postId:', postId, 'and postFormat:', postFormat, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding comments. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one', postFormat, 'post with id:', postId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding post. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #removevoteoncomment = (userId, commentId, voteType) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput(`userId must be an ObjectId.`))
            }

            if (voteType !== "Down" && voteType !== "Up") {
                return resolve(HTTPWTHandler.badInput("voteType must be either Down or Up."))
            }

            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }

            if (!mongoose.isObjectIdOrHexString(commentId)) {
                return resolve(HTTPWTHandler.badInput('commentId must be an ObjectId.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                Comment.findOne({_id: {$eq: commentId}}).then(async commentFound => {
                    if (!commentFound) return resolve(HTTPWTHandler.notFound('Could not find comment.'))

                    if (commentFound.commenterId == userId) return resolve(HTTPWTHandler.forbidden('You cannot modify votes on your own comments.'))

                    User.findOne({_id: {$eq: commentFound.commenterId}}).lean().then(commentOwner => {
                        if (!commentOwner) {
                            console.error('Found comment with id:', commentFound._id, 'that does not have a corresponding owner. Owner id:', commentFound.commenterId, '. This comment should get deleted immediately.')
                            return resolve(HTTPWTHandler.notFound('Could not find comment owner.'))
                        }

                        if (userId != commentFound.commenterId && commentOwner.blockedAccounts?.includes(userFound.secondId)) return resolve(HTTPWTHandler.notFound('Could not find comment.'))

                        POST_DATABASE_MODELS[commentFound.postFormat].findOne({_id: {$eq: commentFound.postId}}).lean().then(async postFound => {
                            if (!postFound) return resolve(HTTPWTHandler.notFound('Could not find post that comment is associated with'))

                            let postOwner;

                            try {
                                postOwner = postFound.creatorId == userId ? userFound : await User.findOne({_id: {$eq: postFound.creatorId}}).lean()
                            } catch (error) {
                                console.error('An error occurred while finding one user with id:', postFound.creatorId, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while finding the owner of the post that the comment associates with. Please try again.'))
                            }

                            if (userId != postFound.creatorId && (
                                postOwner.blockedAccounts?.includes(userFound.secondId) || (postOwner.privateAccount && !postOwner.followers.includes(userFound.secondId))
                            )) {
                                return resolve(HTTPWTHandler.notFound('Could not find comment.'))
                            }

                            const voteTypeToRemove = voteType === "Down" ? Downvote : Upvote

                            voteTypeToRemove.deleteMany({postId: {$eq: commentId}, postFormat: "Comment", userPublicId: userFound.secondId}).then(() => {
                                return resolve(HTTPWTHandler.OK('Successfully removed vote'))
                            }).catch(error => {
                                console.error('An error occurred while deleting all upvotes from comment with id:', commentId, 'that were made by user with secondId:', userFound.secondId, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while removing vote. Please try again.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while finding', commentFound.postFormat, 'post with id:', commentFound.postId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding post that the comment associates with. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding one user with id:', commentFound.commenterId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one comment with id:', commentId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding comment. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #voteonpost = (userId, postId, postFormat, voteType) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an objectId'))
            }

            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }

            if (!mongoose.isObjectIdOrHexString(postId)) {
                return resolve(HTTPWTHandler.badInput('postId must be an objectId'))
            }

            if (!CONSTANTS.VOTE_API_ALLOWED_POST_FORMATS.includes(postFormat)) {
                return resolve(HTTPWTHandler.badInput(`postFormat is invalid. Valid post formats: ${CONSTANTS.VOTE_API_ALLOWED_POST_FORMATS.join(', ')}`))
            }

            if (!CONSTANTS.VOTE_API_ALLOWED_VOTE_TYPES.includes(voteType)) {
                return resolve(HTTPWTHandler.badInput(`voteType is invalid. Valid vote types: ${CONSTANTS.VOTE_API_ALLOWED_VOTE_TYPES.join(', ')}`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))

                POST_DATABASE_MODELS[postFormat].findOne({_id: {$eq: postId}}).lean().then(async postFound => {
                    if (!postFound) return resolve(HTTPWTHandler.notFound('Could not find post'));
                    if (postFound.creatorId == userId) return resolve(HTTPWTHandler.forbidden('You cannot vote on your own post.'))

                    User.findOne({_id: {$eq: postFound.creatorId}}).lean().then(postCreator => {
                        if (!postCreator) {
                            console.error(`Found ${postFormat} post with id:`, postId, 'that does not have its creator with id:', postFound.creatorId, 'in the database. This post should get deleted immediately.')
                            return resolve(HTTPWTHandler.notFound('Could not find post creator'))
                        }

                        if (postCreator.blockedAccounts?.includes(userFound.secondId) || (postCreator.privateAccount === true && !postCreator.followers?.includes(userFound.secondId))) return resolve(HTTPWTHandler.notFound('Could not find post'))

                        mongoose.startSession().then(session => {
                            session.startTransaction();

                            const oppositeVote = voteType === "Up" ? "Down" : "Up";

                            VOTE_DATABASE_MODELS[oppositeVote].deleteMany({userPublicId: {$eq: userFound.secondId}, postId: {$eq: postId}, postFormat: {$eq: postFormat}}, {session}).then(() => {
                                VOTE_DATABASE_MODELS[voteType].findOneAndUpdate({userPublicId: {$eq: userFound.secondId}, postId: {$eq: postId}, postFormat: {$eq: postFormat}}, {interactionDate: Date.now()}, {session, upsert: true}).then(() => {
                                    mongooseSessionHelper.commitTransaction(session).then(() => {
                                        return resolve(HTTPWTHandler.OK('Success'))
                                    }).catch(() => {
                                        return resolve(HTTPWTHandler.serverError('An error occurred while saving vote. Please try again.'))
                                    })
                                }).catch(error => {
                                    mongooseSessionHelper.abortTransaction(session).then(() => {
                                        console.error('An error occurred while finding one', voteType, 'vote with userPublicId:', userFound.secondId, ', postId:', postId, ', and postFormat:', postFormat, 'and upserting with current interactionDate. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while creating vote. Please try again.'))
                                    })
                                })
                            }).catch(error => {
                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                    console.error('An error occurred while deleting many', oppositeVote, 'votes with userPublicId:', userFound.secondId, ', postId:', postId, ', and postFormat:', postFormat, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting previous vote. Please try again.'))
                                })
                            })
                        }).catch(error => {
                            console.error('An error occurred while starting Mongoose session:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while starting to add vote to post. Please try again.'))
                        })
                    })
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #removevoteonpost = (userId, postId, postFormat, voteType) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Provided type: ${typeof postId}`))
            }

            if (!mongoose.isObjectIdOrHexString(postId)) {
                return resolve(HTTPWTHandler.badInput('postId must be an ObjectId.'))
            }

            if (!CONSTANTS.VOTE_API_ALLOWED_POST_FORMATS.includes(postFormat)) {
                return resolve(HTTPWTHandler.badInput(`Invalid post format provided. Valid post formats: ${CONSTANTS.VOTE_API_ALLOWED_POST_FORMATS.join(', ')}`))
            }

            if (!CONSTANTS.VOTE_API_ALLOWED_VOTE_TYPES.includes(voteType)) {
                return resolve(HTTPWTHandler.badInput(`Invalid vote type provided. Valid vote types: ${CONSTANTS.VOTE_API_ALLOWED_VOTE_TYPES.join(', ')}`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound("Could not find user with provided userId."))

                POST_DATABASE_MODELS[postFormat].findOne({_id: {$eq: postId}}).lean().then(postFound => {
                    if (!postFound) return resolve(HTTPWTHandler.notFound('Could not find post with postId.'))

                    User.findOne({_id: {$eq: postFound.creatorId}}).lean().then(postCreator => {
                        if (!postCreator) return resolve(HTTPWTHandler.notFound('Could not find post creator.'))

                        if (postCreator.blockedAccounts?.includes(userFound.secondId) || (postCreator.privateAccount === true && !postCreator.followers.includes(userFound.secondId))) return resolve(HTTPWTHandler.notFound('Post could not be found.'))

                        VOTE_DATABASE_MODELS[voteType].deleteMany({userPublicId: {$eq: userFound.secondId}, postId: {$eq: postId}, postFormat: {$eq: postFormat}}).then(() => {
                            return resolve(HTTPWTHandler.OK('Removing vote was a success'))
                        }).catch(error => {
                            console.error('An error occurred while deleting many', voteType, 'votes with userPublicId:', userFound.secondId, ', postId:', postId, ', and postFormat:', postFormat, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while removing vote. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding one user with id:', postFound.creatorId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding post creator. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding', postFormat, 'post with id:', postId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding post. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #followuser = (userId, userPubId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof userPubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userPubId must be a string. Type provided: ${typeof userPubId}`))
            }

            if (!uuidHelper.validateV4(userPubId)) {
                return resolve(HTTPWTHandler.badInput('userPubId must be a valid version 4 UUID'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(followerFound => {
                if (!followerFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))

                User.findOne({secondId: {$eq: userPubId}}).lean().then(userFound => {
                    if (!userFound || userFound.blockedAccounts?.includes(followerFound.secondId)) return resolve(HTTPWTHandler.notFound('Could not find user.'))
                    if (userId == userFound._id) return resolve(HTTPWTHandler.forbidden('You cannot follow yourself.'))

                    if (userFound.privateAccount) {
                        User.findOneAndUpdate({secondId: {$eq: userPubId}}, {$addToSet: {accountFollowRequests: followerFound.secondId}}).then(() => {
                            return resolve(HTTPWTHandler.OK('Requested To Follow User'))
                        }).catch(error => {
                            console.error('An error occurred while adding:', followerFound.secondId, 'to set in accountFollowRequests for user with secondId:', userPubId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while requesting to follow user. Please try again.'))
                        })
                    } else {
                        //The account is not private, so follow the user and add the user to the follower's following array
                        mongoose.startSession().then(session => {
                            session.startTransaction();

                            const dbUpdates = [
                                {
                                    updateOne: {
                                        filter: {_id: {$eq: userFound._id}},
                                        update: {$addToSet : {followers: followerFound.secondId}}
                                    }
                                },
                                {
                                    updateOne: {
                                        filter: {_id: {$eq: userId}},
                                        update: { $addToSet : {following: userFound.secondId}}
                                    }
                                }
                            ]

                            User.bulkWrite(dbUpdates).then(() => {
                                mongooseSessionHelper.commitTransaction(session).then(() => {
                                    return resolve(HTTPWTHandler.OK('Followed User'))
                                }).catch(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while following user. Please try again.'))
                                })
                            }).catch(error => {
                                console.error('An error occurred while making database updates to User collection:', dbUpdates, '. The error was:', error)
                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while following user. Please try again.'))
                                })
                            })
                        }).catch(error => {
                            console.error('An error occurred while starting Mongoose session:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while starting to follow user. Please try again.'))
                        })
                    }
                }).catch(error => {
                    console.error('An error occurred while finding user with secondId:', userPubId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user to follow. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #unfollowuser = (userId, userPubId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof userPubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userPubId must be a string. Type provided: ${typeof userPubId}`))
            }

            if (!uuidHelper.validateV4(userPubId)) {
                return resolve(HTTPWTHandler.badInput('userPubId must be a valid version 4 UUID'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(followerFound => {
                if (!followerFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))

                User.findOne({secondId: {$eq: userPubId}}).lean().then(userFound => {
                    if (!userFound || userFound.blockedAccounts?.includes(followerFound.secondId)) return resolve(HTTPWTHandler.notFound('Could not find user.'))

                    if (userFound.privateAccount && userFound.accountFollowRequests.includes(followerFound.secondId)) {
                        User.findOneAndUpdate({secondId: {$eq: userPubId}}, {$pull: {accountFollowRequests: followerFound.secondId}}).then(() => {
                            return resolve(HTTPWTHandler.OK('Removed Request To Follow User'))
                        }).catch(error => {
                            console.error('An error occurred while pulling:', followerFound.secondId, 'from accountFollowRequests from user with secondId:', userPubId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while removing account follow requests.'))
                        })
                    } else {
                        //There is no account follow request or the account is not private, so we remove the regular follow.

                        mongoose.startSession().then(session => {
                            session.startTransaction();

                            const dbUpdates = [
                                {
                                    updateOne: {
                                        filter: {_id: {$eq: userFound._id}},
                                        update: {$pull : {followers: followerFound.secondId}}
                                    }
                                },
                                {
                                    updateOne: {
                                        filter: {_id: {$eq: userId}},
                                        update: { $pull : {following: userFound.secondId}}
                                    }
                                }
                            ]

                            User.bulkWrite(dbUpdates, {session}).then(() => {
                                mongooseSessionHelper.commitTransaction(session).then(() => {
                                    return resolve(HTTPWTHandler.OK('UnFollowed user'))
                                }).catch(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while unfollowing user. Please try again.'))
                                })
                            }).catch(error => {
                                console.error('An error occurred while making these updates to the User collection:', dbUpdates, '. The error was:', error)
                                mongooseSessionHelper.abortTransaction(session).then(() => {
                                    return resolve(HTTPWTHandler.serverError('An error occurred while unfollowing user. Please try again.'))
                                })
                            })
                        }).catch(error => {
                            console.error('There was an error while starting Mongoose session:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while starting to unfollow user. Please try again.'))
                        })
                    }
                }).catch(error => {
                    console.error('An error occurred while finding user with secondId:', userPubId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user to unfollow. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getvotedusersofpost = (userId, postId, postFormat, lastItemId, voteType) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof postId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`postId must be a string. Type provided: ${typeof postId}`))
            }

            if (!mongoose.isObjectIdOrHexString(postId)) {
                return resolve(HTTPWTHandler.badInput('postId must be an ObjectId.'))
            }

            if (!CONSTANTS.VOTED_USERS_API_ALLOWED_POST_FORMATS.includes(postFormat)) {
                return resolve(HTTPWTHandler.badInput(`postFormat is invalid. Must be one of these values: ${CONSTANTS.VOTED_USERS_API_ALLOWED_POST_FORMATS.join(', ')}`))
            }

            if (typeof lastItemId !== 'string' && lastItemId !== undefined) {
                return resolve(HTTPWTHandler.badInput('lastItemId must be either a string or undefined.'))
            }

            if (lastItemId !== undefined && !uuidHelper.validateV4(lastItemId)) {
                return resolve(HTTPWTHandler.badInput('lastItemId must be a valid UUIDv4 if it is going to be a string.'))
            }

            if (!CONSTANTS.VOTED_USERS_API_ALLOWED_VOTE_TYPES.includes(voteType)) {
                return resolve(HTTPWTHandler.badInput(`voteType must be one of these values: ${CONSTANTS.VOTED_USERS_API_ALLOWED_VOTE_TYPES.join(', ')}`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'))

                POST_DATABASE_MODELS[postFormat].findOne({_id: {$eq: postId}}).lean().then(async postFound => {
                    if (!postFound) return resolve(HTTPWTHandler.notFound('Could not find post.'))

                    let postCreator;

                    try {
                        postCreator = postFound.creatorId == userId ? userFound : await User.findOne({_id: {$eq: postFound.creatorId}}).lean();
                    } catch (error) {
                        console.error('An error occurred while finding one user with id:', postFound.creatorId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding post creator. Please try again.'))
                    }

                    if (!postCreator) {
                        console.error('Found', postFormat, 'post with id:', postId, 'that does not have a creator with id:', postFound.creatorId)
                        return resolve(HTTPWTHandler.notFound('Could not find post creator'))
                    }

                    const blocked = postCreator.blockedAccounts?.includes(userFound.secondId)
                    const notAllowedToView = postCreator.privateAccount === true && !postCreator.followers.includes(userFound.secondId);

                    if ((blocked || notAllowedToView) && postCreator._id != userId) {
                        //If the user requesting is not the post creator, and they are either blocked or not following the user (if the user that created the post is a private account)
                        return resolve(HTTPWTHandler.notFound('Could not find post.'))
                    }

                    const dbQuery = {
                        postId: {$eq: postId},
                        postFormat: {$eq: postFormat}
                    }

                    if (lastItemId) {
                        dbQuery.userPublicId = {$lt: lastItemId}
                    }

                    VOTE_DATABASE_MODELS[voteType].find(dbQuery).sort({_id: -1}).limit(CONSTANTS.VOTED_USERS_MAX_USERS_TO_SEND_PER_API_CALL).lean().then(votes => {
                        if (votes.length === 0) return resolve(HTTPWTHandler.OK('Success', {items: [], noMoreItems: true}))

                        const userPubIds = votes.map(vote => vote.userPublicId);

                        User.find({secondId: {$in: userPubIds}}).lean().then(users => {
                            const {foundDocuments, missingDocuments} = arrayHelper.returnDocumentsFromIdArray(userPubIds, users, 'secondId');

                            if (missingDocuments.length > 0) {
                                console.error('Missing users found that have', voteType, 'voted post with id:', postId, '. The users are:', missingDocuments);
                            }

                            const toSend = {
                                items: foundDocuments.map(user => userHandler.returnPublicInformation(user, userFound)),
                                noMoreItems: userPubIds.length < CONSTANTS.VOTED_USERS_MAX_USERS_TO_SEND_PER_API_CALL
                            }

                            return resolve(HTTPWTHandler.OK('Success', toSend))
                        }).catch(error => {
                            console.error('An error occurred while finding users with secondIds inside of:', userPubIds, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding upvoted users. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding upvotes with dbQuery:', dbQuery, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding upvotes. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one', postFormat, 'post with id:', postId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding post. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getcategorymembers = (userId, categoryId, lastItemId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Type provided: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof categoryId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`categoryId must be a string. Type provided: ${typeof categoryId}`))
            }

            if (!mongoose.isObjectIdOrHexString(categoryId)) {
                return resolve(HTTPWTHandler.badInput('categoryId must be an ObjectId.'))
            }

            if (typeof lastItemId !== 'string' && lastItemId !== undefined) {
                return resolve(HTTPWTHandler.badInput(`lastItemId must either be a string or undefined. Type provided: ${typeof lastItemId}`))
            }

            if (lastItemId !== undefined && !mongoose.isObjectIdOrHexString(lastItemId)) {
                return resolve(HTTPWTHandler.badInput('lastItemId must be an ObjectId if it is not going to be undefined.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with userId provided.'))

                Category.findOne({_id: {$eq: categoryId}}).lean().then(categoryFound => {
                    if (!categoryFound) return resolve(HTTPWTHandler.notFound('Could not find category with categoryId provided.'))

                    const dbQuery = {
                        categoryId: {$eq: categoryId}
                    }

                    if (lastItemId) {
                        dbQuery._id = {$lt: lastItemId}
                    }

                    CategoryMember.find(dbQuery).sort({_id: -1}).limit(CONSTANTS.MAX_CATEGORY_MEMBERS_PER_API_CALL).lean().then(members => {
                        if (members.length === 0) return resolve(HTTPWTHandler.OK('No members found', {items: [], noMoreItems: true}))

                        const memberIds = members.map(member => member.userId);

                        User.find({_id: {$in: memberIds}}).lean().then(users => {
                            const {foundDocuments, missingDocuments} = arrayHelper.returnDocumentsFromIdArray(memberIds, users, '_id');

                            if (missingDocuments.length > 0) {
                                console.error('Users have been found being members to category with id:', categoryId, 'but they cannot be found in the database. The user documents are:', missingDocuments)
                            }

                            const toSend = {
                                items: foundDocuments.map(document => userHandler.returnPublicInformation(document, userFound)),
                                noMoreItems: memberIds.length < CONSTANTS.MAX_CATEGORY_MEMBERS_PER_API_CALL
                            }

                            return resolve(HTTPWTHandler.OK('Found members', toSend))
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding category members with dbQuery:', dbQuery, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding the category members. Please try again.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding one category with id:', categoryId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding the category. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #getpollvoteusers = (userId, pollId, pollOption, lastItemId) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
            }

            if (!mongoose.isObjectIdOrHexString(pollId)) {
                return resolve(HTTPWTHandler.badInput('pollId must be an ObjectId.'))
            }

            if (!CONSTANTS.POLL_OPTIONS.includes(pollOption)) {
                return resolve(HTTPWTHandler.badInput(`pollOption must be one of these values: ${CONSTANTS.POLL_OPTIONS.join(', ')}`))
            }

            if (lastItemId !== undefined && typeof lastItemId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`lastItemId must be undefined or a string. Type provided: ${typeof lastItemId}`))
            }

            if (lastItemId !== undefined && !mongoose.isObjectIdOrHexString(lastItemId)) {
                return resolve(HTTPWTHandler.badInput('lastItemId must be an ObjectId if it is going to be a string.'))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('Could not find user with userId provided.'))

                Poll.findOne({_id: {$eq: pollId}}).lean().then(async pollFound => {
                    if (!pollFound) return resolve(HTTPWTHandler.notFound('Could not find poll.'))

                    const pollIsByRequester = pollFound.creatorId == userId;

                    let creator;

                    try {
                        creator = pollIsByRequester ? userFound : await User.findOne({_id: {$eq: pollFound.creatorId}}).lean()
                    } catch (error) {
                        console.error('An error occurred while finding one user with id:', pollFound.creatorId, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding poll creator. Please try again.'))
                    }

                    if (!creator) return resolve(HTTPWTHandler.notFound('Could not find poll creator.'))

                    if (!pollIsByRequester && creator.blockedAccounts?.includes(userFound.secondId)) {
                        return resolve(HTTPWTHandler.notFound('Could not find poll creator.'))
                    }

                    if (!pollIsByRequester && creator.privateAccount === true && !creator.followers.includes(userFound.secondId)) {
                        return resolve(HTTPWTHandler.notFound('Could not find poll.'))
                    }

                    const dbQuery = {
                        pollId: {$eq: pollId},
                        vote: {$eq: pollOption}
                    }

                    if (lastItemId) {
                        dbQuery._id = {$lt: lastItemId}
                    }

                    PollVote.find(dbQuery).sort({_id: -1}).limit(CONSTANTS.MAX_POLL_OPTION_VOTED_USERS_TO_SEND_PER_API_CALL).lean().then(votes => {
                        if (votes.length === 0) return resolve(HTTPWTHandler.OK('No votes found', {items: [], noMoreItems: true}))

                        const userIds = votes.map(vote => vote.userId);

                        User.find({_id: {$in: userIds}}).lean().then(users => {
                            const {foundDocuments, missingDocuments} = arrayHelper.returnDocumentsFromIdArray(userIds, users, '_id');

                            if (missingDocuments.length > 0) {
                                console.error('Missing users found while finding votes on poll option:', pollOption, 'on poll with id:', pollId, '. The missing documents are:', missingDocuments)
                            }

                            const userInformation = foundDocuments.map(user => userHandler.returnPublicInformation(user, userFound));

                            return resolve(HTTPWTHandler.OK('Found votes', {items: userInformation, noMoreItems: userIds.length < CONSTANTS.MAX_POLL_OPTION_VOTED_USERS_TO_SEND_PER_API_CALL}))
                        }).catch(error => {
                            console.error('An error occurred while finding users in:', userIds, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding users that voted on the poll option. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding poll votes with dbQuery:', dbQuery, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding poll votes.'))
                    })
                }).catch(error => {
                    console.error('An error occurred while finding poll with id:', pollId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #editprofiledetails = (userId, profileDetails) => {
        return new Promise(resolve => {
            if (typeof userId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userId must be a string. Provided type: ${typeof userId}`))
            }

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return resolve(HTTPWTHandler.badInput('userId must be an ObjectId.'))
            }

            if (typeof profileDetails !== 'object' || Array.isArray(profileDetails) || profileDetails === null) {
                return resolve(HTTPWTHandler.badInput('profileDetails must be an object.'))
            }

            for (const key of Object.keys(profileDetails)) {
                if (!CONSTANTS.ALLOWED_PROFILE_DETAIL_KEY_EDITS.includes(key)) {
                    delete profileDetails[key]
                    continue
                }

                if (typeof profileDetails[key] !== 'string') {
                    return resolve(HTTPWTHandler.badInput(`${key} must be a string.`))
                }
            }

            if (Object.keys(profileDetails).length === 0) {
                return resolve(HTTPWTHandler.badInput('No valid keys were provided for profileDetails.'))
            }

            if (profileDetails.name) {
                if (!CONSTANTS.VALID_USERNAME_TEST.test(profileDetails.name)) {
                    return resolve(HTTPWTHandler.badInput('Invalid username entered (username can only have numbers and lowercase a - z characters)'))
                }
    
                if (profileDetails.name.length === 0) {
                    return resolve(HTTPWTHandler.badInput('Your username cannot be blank.'))
                }
    
                if (profileDetails.name.length > CONSTANTS.MAX_USER_USERNAME_LENGTH) {
                    return resolve(HTTPWTHandler.badInput('Your new username cannot be more than 20 characters.'))
                }
            }

            if (profileDetails.displayName) {
                if (profileDetails.displayName.length > CONSTANTS.MAX_USER_DISPLAY_NAME_LENGTH) {
                    return resolve(HTTPWTHandler.badInput('Display name must be 20 characters or less.'))
                }

                if (!CONSTANTS.VALID_DISPLAY_NAME_TEST.test(profileDetails.displayName)) {
                    return resolve(HTTPWTHandler.badInput('Display name must only contain a-z lowercase and uppercase characters.'))
                }
            }

            if (profileDetails.bio) {
                if (profileDetails.bio.length > CONSTANTS.MAX_USER_BIO_LENGTH) {
                    return resolve(HTTPWTHandler.badInput(`Bio must be ${CONSTANTS.MAX_USER_BIO_LENGTH} or less characters`))
                }
    
                if (!CONSTANTS.VALID_BIO_TEST.test(profileDetails.bio)) {
                    return resolve(HTTPWTHandler.badInput(`Bio must have ${CONSTANTS.MAX_USER_BIO_LINES} or less lines`))
                }
            }

            User.findOneAndUpdate({_id: {$eq: userId}}, {$set: profileDetails}).lean().then(result => {
                if (result === null) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId.'));
                }

                return resolve(HTTPWTHandler.OK('Profile details were successfully edited'))
            }).catch(error => {
                if (error.codeName === 'DuplicateKey') {
                    if (Object.keys(error.keyValue)[0] === 'name') {
                        return resolve(HTTPWTHandler.conflict('Another SocialSquare user has the username you are trying to use. Please choose a different username.'))
                    } else {
                        console.error('An unknown key is giving a duplicate error while updating profile details. The error is:', error)
                        return resolve(HTTPWTHandler.serverError('An unknown key cannot be duplicated.'))
                    }
                } else {
                    console.error('An error occurred while updating user profiles. The user detail object was:', profileDetails, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while updating profile details. Please try again.'))
                }
            })
        })
    }

    static sendnotificationkey = async (userId, notificationKey, refreshTokenId) => {
        return await this.#sendnotificationkey(userId, notificationKey, refreshTokenId)
    }

    static changeemail = async (userId, password, desiredEmail) => {
        return await this.#changeemail(userId, password, desiredEmail)
    }

    static changepassword = async (userId, currentPassword, newPassword, IP, deviceType) => {
        return await this.#changepassword(userId, currentPassword, newPassword, IP, deviceType)
    }

    static searchpageusersearch = async (userId, lastItemId, searchTerm) => {
        return await this.#searchpageusersearch(userId, lastItemId, searchTerm)
    }

    static createpollpost = async (userId, title, subtitle, options) => {
        return await this.#createpollpost(userId, title, subtitle, options)
    }

    static searchforpollposts = async (userId, pubId, lastItemId) => {
        return await this.#searchforpollposts(userId, pubId, lastItemId)
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

    static deletepoll = async (userId, pollId) => {
        return await this.#deletepoll(userId, pollId)
    }

    static postImage = async (userId, title, description, file) => {
        return await this.#postImage(userId, title, description, file)
    }

    static postProfileImage = async (userId, file) => {
        return await this.#postProfileImage(userId, file)
    }

    static getImagesFromProfile = async (userId, pubId, lastItemId) => {
        return await this.#getImagesFromProfile(userId, pubId, lastItemId)
    }

    static getProfilePic = async (pubId) => {
        return await this.#getProfilePic(pubId)
    }

    static postcategory = async (userId, title, description, tags, NSFW, NSFL, file) => {
        return await this.#postcategory(userId, title, description, tags, NSFW, NSFL, file)
    }

    static deleteimage = async (userId, postId) => {
        return await this.#deleteimage(userId, postId)
    }

    static searchpagesearchcategories = async (userId, val, lastItemId) => {
        return await this.#searchpagesearchcategories(userId, val, lastItemId)
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

    static leavecategory = async (userId, categoryId) => {
        return await this.#leavecategory(userId, categoryId)
    }

    static postthread = async (userId, title, subtitle, tags, categoryId, imageDescription, NSFW, NSFL, file) => {
        return await this.#postthread(userId, title, subtitle, tags, categoryId, imageDescription, NSFW, NSFL, file)
    }

    static getthreadsfromcategory = async (userId, categoryId) => {
        return await this.#getthreadsfromcategory(userId, categoryId)
    }

    static getthreadsfromprofile = async (userId, pubId, lastItemId) => {
        return await this.#getthreadsfromprofile(userId, pubId, lastItemId)
    }

    static getthreadbyid = async (userId, threadId) => {
        return await this.#getthreadbyid(userId, threadId)
    }

    static deletethread = async (userId, threadId) => {
        return await this.#deletethread(userId, threadId)
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

    static getfollowrequests = async (userId, skip) => {
        return await this.#getfollowrequests(userId, skip)
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

    static getuserblockedaccounts = async (userId, skip) => {
        return await this.#getuserblockedaccounts(userId, skip)
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

    static checkIfCategoryExists = async (title) => {
        return await this.#checkIfCategoryExists(title)
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

    static voteoncomment = async (userId, commentId, voteType) => {
        return await this.#voteoncomment(userId, commentId, voteType)
    }

    static postcomment = async (userId, comment,postId, postFormat) => {
        return await this.#postcomment(userId, comment,postId, postFormat)
    }

    static searchforpostcomments = async (userId, postId, postFormat) => {
        return await this.#searchforpostcomments(userId, postId, postFormat);
    }

    static removevoteoncomment = async (userId, commentId, voteType) => {
        return await this.#removevoteoncomment(userId, commentId, voteType);
    }

    static voteonpost = async (userId, postId, postFormat, voteType) => {
        return await this.#voteonpost(userId, postId, postFormat, voteType);
    }

    static removevoteonpost = async (userId, postId, postFormat, voteType) => {
        return await this.#removevoteonpost(userId, postId, postFormat, voteType);
    }

    static followuser = async (userId, userPubId) => {
        return await this.#followuser(userId, userPubId)
    }

    static unfollowuser = async (userId, userPubId) => {
        return await this.#unfollowuser(userId, userPubId)
    }

    static getvotedusersofpost = async (userId, postId, postFormat, lastItemId, voteType) => {
        return await this.#getvotedusersofpost(userId, postId, postFormat, lastItemId, voteType)
    }

    static getcategorymembers = async (userId, categoryId, lastItemId) => {
        return await this.#getcategorymembers(userId, categoryId, lastItemId);
    }

    static getpollvoteusers = async (userId, pollId, pollOption, lastItemId) => {
        return await this.#getpollvoteusers(userId, pollId, pollOption, lastItemId)
    }

    static editprofiledetails = async (userId, profileDetails) => {
        return await this.#editprofiledetails(userId, profileDetails)
    }
}

module.exports = TempController;
