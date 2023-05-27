const User = require('../models/User');
const Poll = require('../models/Poll');
const ImagePost = require('../models/ImagePost');
const Upvote = require('../models/Upvote')
const Downvote = require('../models/Downvote')
const Category = require('../models/Category')
const Thread = require('../models/Thread')

const HTTPWTLibrary = require('../libraries/HTTPWT');
const CONSTANTS = require('../constants');
const HTTPWTHandler = new HTTPWTLibrary()

const HTTPLibrary = require('../libraries/HTTP');
const HTTPHandler = new HTTPLibrary();

const ImageLibrary = require('../libraries/Image');
const imageHandler = new ImageLibrary();

const ThreadPostLibrary = require('../libraries/ThreadPost');
const threadPostHandler = new ThreadPostLibrary();

class TempController {
    static #sendnotificationkey = (userId, notificationKey) => {
        return Promise(resolve => {
            if (typeof notificationKey !== 'string') {
                return resolve(HTTPWTHandler.badInput(`notificationKey must be a string. Provided type: ${typeof notificationKey}`))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userData => {
                if (userData) {
                    const notificationKeys = userData.notificationKeys;
                    if (notificationKeys.includes(notificationKey)) {
                        return resolve(HTTPWTHandler.conflict('Notification key already exists in account data'))
                    } else if (notificationKey == null) {
                        return resolve(HTTPWTHandler.badInput('Notification key cannot be null'))
                    } else {
                        User.findOneAndUpdate({_id: {$eq: userId}}, {$push : {notificationKeys: notificationKey}}).then(function() {
                            return resolve(HTTPWTHandler.OK('Notification key saved.'))
                        }).catch(err => {
                            console.error('An error occurred while adding notification key to user with id:', userId, '. The error was:', err)
                            return resolve(HTTPWTHandler.serverError('An error occurred while saving notification key. Please try again'))
                        })
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound("Couldn't find user while sending device notification key."))
                }
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
        
                                    newRefreshToken.save().then(() => {
                                        RefreshToken.deleteMany({encryptedRefreshToken: {$not: encryptedRefreshToken}, userId: result._id, admin: false}).then(() => {
                                            User.findOneAndUpdate({_id: {$eq: userId}}, {password: hashedPassword}).then(() => {
                                                return resolve(HTTPWTHandler.OK('Changing password was a success!', {}, {token: `Bearer ${token}`, refreshToken: `Bearer ${refreshToken}`}))
                                            }).catch(error => {
                                                console.error('An error occurred while setting password to:', hashedPassword, 'for user with id:', userId, '. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while changing password. Please try again.'))
                                            })
                                        }).catch(error => {
                                            console.error('An error occurred while deleting all RefreshTokens that have a userId of:', result._id, 'and that do not have an encryptedRefreshToken:', encryptedRefreshToken, '. The error was:', error)
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
                                    if (data[index].blockedAccounts.includes(userFound.secondId)) {
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

            if (!allowedColors.includes(optionOnesColor) || optionOnesColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionOnesColor must be either ${allowedColors.join(', ')} or be "Not Specified"`))
            }

            if (typeof optionTwo !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionTwo must be a string. Provied type: ${typeof optionTwo}`))
            }

            if (!allowedColors.includes(optionTwosColor) || optionTwosColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionTwosColor must be either ${allowedColors.join(', ')} or be "Not Specified"`))
            }

            if (typeof optionThree !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionThree must be a string. Provied type: ${typeof optionThree}`))
            }

            if (!allowedColors.includes(optionThreesColor) || optionThreesColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionThreesColor must be either ${allowedColors.join(', ')} or be "Not Specified"`))
            }

            if (typeof optionFour !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionFour must be a string. Provied type: ${typeof optionFour}`))
            }

            if (!allowedColors.includes(optionFoursColor) || optionFoursColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionFoursColor must be either ${allowedColors.join(', ')} or be "Not Specified"`))
            }

            if (typeof optionFive !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionFive must be a string. Provied type: ${typeof optionFive}`))
            }

            if (!allowedColors.includes(optionFivesColor) || optionFivesColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionFivesColor must be either ${allowedColors.join(', ')} or be "Not Specified"`))
            }

            if (typeof optionSix !== 'string') {
                return resolve(HTTPWTHandler.badInput(`optionSix must be a string. Provied type: ${typeof optionSix}`))
            }

            if (!allowedColors.includes(optionSixesColor) || optionSixesColor !== 'Not Specified') {
                return resolve(HTTPWTHandler.badInput(`optionSixesColor must be either ${allowedColors.join(', ')} or be "Not Specified"`))
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

            const pollOptions = allowedNumbersOfOptions.findIndex(totalNumberOfOptions) + 2

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
            const optionOnesVotes = []
            const optionTwosVotes = []
            const optionThreesVotes = []
            const optionFoursVotes = []
            const optionFivesVotes = []
            const optionSixesVotes = []
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
                User.findOne({_id: {$eq: creatorId}}).lean().then(data => {
                    if (data) {
                        const pollObject = {
                            pollTitle,
                            pollSubTitle,
                            optionOne,
                            optionOnesColor,
                            optionOnesVotes,
                            optionTwo,
                            optionTwosColor,
                            optionTwosVotes,
                            optionThree,
                            optionThreesColor,
                            optionThreesVotes,
                            optionFour,
                            optionFoursColor,
                            optionFoursVotes,
                            optionFive,
                            optionFivesColor,
                            optionFivesVotes,
                            optionSix,
                            optionSixesColor,
                            optionSixesVotes,
                            totalNumberOfOptions,
                            creatorId,
                            comments: comments,
                            datePosted: Date.now(),
                            allowScreenShots: allowScreenShots
                        }

                        const newPoll = new Poll(pollObject);
                
                        newPoll.save().then(result => {
                            return resolve(HTTPWTHandler.OK('Poll creation successful', result))
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
                    console.error('An error occured while finding a user with _id:', creatorId, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                });
            }
        })
    }

    static #searchforpollposts = (userId, pubId) => {
        //userId is the ID of the user requesting the poll posts
        //pubId is the secondId of the user with the poll posts that are being searched for
        return new Promise(resolve => {
            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Provided type: ${typeof pubId}`))
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
                                if (result.blockedAccounts.includes(userGettingPollPosts.secondId)) {
                                    // User is blocked or the account is private but the user requesting doesn't follow the user so do not send posts
                                    return resolve(HTTPWTHandler.notFound('User could not be found.'))
                                } else if (result[0].privateAccount && !result[0].followers.includes(userGettingPollPosts[0].secondId)) {
                                    return resolve(HTTPWTHandler.notFound('No Poll Posts'))
                                } else {
                                    // User exists
                                    Poll.find({creatorId: result[0]._id}).sort({datePosted: -1}).lean().then(data => pollPostHandler.processMultiplePostDataFromOneOwner(data, result, userGettingPollPosts)).then(data => {
                                        if (data.length) {
                                            return resolve(HTTPWTHandler.OK('Poll search successful', data))
                                        } else {
                                            return resolve(HTTPWTHandler.notFound('No Poll Posts'))
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
                            return resolve(HTTPWWTHandler.serverError('An error occurred while finding user. Please try again.'))
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

    static #pollpostcomment = (userId, comment, userName, pollId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof userName !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userName must be a string. Provided type: ${typeof userName}`))
            }
        
            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
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
                if (result) {
                    if (result.name == userName) {
                        async function findPolls() {
                            var objectId = new mongodb.ObjectID()
                            console.log(objectId)
                            var commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], commentReplies: [], datePosted: Date.now()}
                            Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $push: { comments: commentForPost } }).then(function(){
                                return resolve(HTTPWTHandler.OK('Comment upload successful'))
                            })
                            .catch(err => {
                                console.error('An error occured while updating poll to have a new comment. The comment was:', commentForPost, '. THe error was:', err)
                                return resolve(HTTPWTHandler.serverError('An error occurred while posting comment. Please try again.'))
                            });
                        }
                        findPolls()
                    } else {
                        return resolve(HTTPWTHandler.badInput('A name based error occurred. Username in the database does not match userName provided'))
                    }
                } else {
                    return resolve(HTTPWTHandler.notFound('Could not find a user with your user id'))
                } 
            })
            .catch(err => {
                console.error('An error occured while finding user with id:', userId, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again'))
            });
        })
    }

    static #pollpostcommentreply = (userId, comment, userName, pollId, commentId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof userName !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userName must be a string. Provided type: ${typeof userName}`))
            }
        
            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
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
                    if (result.name == userName) {
                        Poll.findOne({_id: {$eq: pollId}}).lean().then(data => {
                            if (data) {
                                var comments = data.comments
                                async function findThreads(sentIndex) {
                                    var objectId = new mongodb.ObjectID()
                                    console.log(objectId)
                                    var commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], datePosted: Date.now()}
                                    Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $push: { [`comments.${sentIndex}.commentReplies`]: commentForPost } }).then(function(){
                                        return resolve(HTTPWTHandler.OK('Comment upload successful'))
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
                            console.error('An error occurred while finding one poll with id:', pollId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding poll. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.badInput('Provided userName does not match username in database.'))
                    }
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

    static #searchforpollcomments = (userId, pollId) => {
        return new Promise(resolve => {
            if (typeof pollId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pollId must be a string. Provided type: ${typeof pollId}`))
            }
        
            //Check Input fields
            if (pollId == "") {
                return resolve(HTTPWTHandler.badInput('pollId cannot be blank'))
            } else {
                //Find User
                console.log(sentPollId)
                function sendResponse(nameSendBackObject) {
                    console.log("Params Recieved")
                    console.log(nameSendBackObject)
                    //Convert the objectIds to strings so then they don't get messed up while serializing and deserializing while sending data to main thread to be sent to requesting client
                    const modifiedNameSendBackObject = nameSendBackObject.map(item => {
                        item.commentId = String(item.commentId)
                        item.commenterId = String(item.commenterId)
                        return item
                    })
                    return resolve(HTTPWTHandler.OK('Comment search successful', modifiedNameSendBackObject))
                }

                Poll.findOne({_id: {$eq: pollId}}).lean().then(data => {
                    if (data) {
                        var nameSendBackObject = [];
                        var comments = data.comments;
                        if (comments.length == 0) {
                            return resolve(HTTPWTHandler.notFound('No comments'))
                        } else {
                            var itemsProcessed = 0;
                            console.log(comments)



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
                                        console.error('A comment was found on poll with id:', pollId, 'by user with id:', comments[index].commenterId, '. This user could not be found in the database. This comment should be deleted')
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
                    console.error('An error occured while finding poll with id:', pollId, '. The error was:', err)
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
        
            const allowedOptionsToSelect = ['optionOnesVotes', 'optionTwosVotes', 'optionThreesVotes', 'optionFoursVotes', 'optionFivesVotes', 'optionSixesVotes']
            if (!allowedOptionsToSelect.includes(optionSelected)) {
                return resolve(HTTPWTHandler.badInput(`optionSelected must be either ${allowedOptionsToSelect.join(', ')}`))
            }
        
            //Check Input fields
            if (optionSelected == "" || pollId == "") {
                return resolve(HTTPWTHandler.badInput('Both optionSelected and pollId cannot be a blank string,'))
            } else {
                //Find User
                console.log(optionSelected)
                async function addVote() {
                    //Confirm User
                    User.findOne({_id: {$eq: userId}}).lean().then(result => {
                        if (result) {
                            //User exists
                            Poll.findOne({_id: {$eq: pollId}}).lean().then(data => {
                                if (data) {
                                    var findUser = data;
                                    console.log(findUser)
                                    if (findUser.creatorId !== userId) {
                                        if (findUser.optionOnesVotes.includes(userId)) {
                                            Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $pull: { optionOnesVotes: userId }}).then(function(){
                                                if (optionSelected !== "optionOnesVotes") {
                                                    Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $push: { [optionSelected]: userId }}).then(function(){
                                                        return resolve(HTTPWTHandler.OK('Vote successful', {lastVote: "One"}))
                                                    })
                                                    .catch(err => {
                                                        console.error('An error occured while adding:', userId, 'to the list of votes in:', optionSelected, 'on poll with id:', pollId, '. The error was:', err)
                                                        return resolve(HTTPWTHandler.serverError('An error occurred while adding vote. Please try again.'))
                                                    });
                                                } else {
                                                    return resolve(HTTPWTHandler.OK('Pulled', {lastVote: 'One'}))
                                                }
                                            })
                                            .catch(err => {
                                                console.error('An error occured while pulling:', userId, 'from optionOnesVotes on poll with id:', pollId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while pulling vote. Please try again.'))
                                            });
                                        } else if (findUser.optionTwosVotes.includes(userId)) {
                                            Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $pull: { optionTwosVotes: userId }}).then(function(){
                                                if (optionSelected !== "optionTwosVotes") {
                                                    Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $push: { [optionSelected]: userId }}).then(function(){
                                                        return resolve(HTTPWTHandler.OK('Vote successful', {lastVote: 'Two'}))
                                                    })
                                                    .catch(err => {
                                                        console.error('An error occured while adding:', userId, 'to:', optionSelected, 'in poll with id:', pollId, '. The error was:', err)
                                                        return resolve(HTTPWTHandler.serverError('An error occurred while adding vote. Please try again.'))
                                                    });
                                                } else {
                                                    return resolve(HTTPWTHandler.OK('Pulled', {lastVote: "Two"}))
                                                }
                                            }).catch(error => {
                                                console.error('An error occurred while pulling:', userId, 'from optionTwosVotes from poll with id:', pollId, '. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing existing vote. Please try again.'))
                                            })
                                        } else if (findUser.optionThreesVotes.includes(userId)) {
                                            Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $pull: { optionThreesVotes: userId }}).then(function(){
                                                if (optionSelected !== "optionThreesVotes") {
                                                    Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $push: { [optionSelected]: userId }}).then(function(){
                                                        return resolve(HTTPWTHandler.OK('Vote successful', {lastVote: "Three"}))
                                                    })
                                                    .catch(err => {
                                                        console.error('An error occurred while adding:', userId, 'to:', optionSelected, 'in poll with id:', pollId, '. The error was:', err)
                                                        return resolve(HTTPWTHandler.serverError('An error occurred while adding vote. Please try again.'))
                                                    });
                                                } else {
                                                    return resolve(HTTPWTHandler.OK('Pulled', {lastVote: 'Three'}))
                                                } 
                                            }).catch(error => {
                                                console.error('An error occurred while pulling:', userId, 'from optionThreesVotes from poll with id:', pollId, '. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing existing vote. Please try again.'))
                                            })
                                        } else if (findUser.optionFoursVotes.includes(userId)) {
                                            Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $pull: { optionFoursVotes: userId }}).then(function(){
                                                if (optionSelected !== "optionFoursVotes") {
                                                    Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $push: { [optionSelected]: userId }}).then(function(){
                                                        return resolve(HTTPWTHandler.OK('Vote successful', {lastVote: 'Four'}))
                                                    })
                                                    .catch(err => {
                                                        console.error('An error occured while adding:', userId, 'to:', optionSelected, 'in poll with id:', pollId, '. The error was:', err)
                                                        return resolve(HTTPWTHandler.serverError('An error occurred while adding vote. Please try again.'))
                                                    });
                                                } else {
                                                    return resolve(HTTPWTHandler.OK('Pulled', {lastVote: "Four"}))
                                                }
                                            }).catch(error => {
                                                console.error('An error occurred while pulling:', userId, 'from optionFoursVotes from poll with id:', pollId, '. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing existing vote. Please try again.'))
                                            })
                                        } else if (findUser.optionFivesVotes.includes(userId)) {
                                            Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $pull: { optionFivesVotes: userId }}).then(function(){
                                                if (optionSelected !== "optionFivesVotes") {
                                                    Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $push: { [optionSelected]: userId }}).then(function(){
                                                        return resolve(HTTPWTHandler.OK('Vote successful', {lastVote: 'Five'}))
                                                    })
                                                    .catch(err => {
                                                        console.error('An error occured while adding:', userId, 'to:', optionSelected, 'in poll with id:', pollId, '. The error was:', err)
                                                        return resolve(HTTPWTHandler.serverError('An error occurred while adding vote. Please try again.'))
                                                    });
                                                } else {
                                                    return resolve(HTTPWTHandler.OK('Pulled', {lastVote: "Five"}))
                                                }
                                            }).catch(error => {
                                                console.error('An error occurred while pulling:', userId, 'from optionFivesVotes from poll with id:', pollId, '. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing existing vote. Please try again.'))
                                            })
                                        } else if (findUser.optionSixesVotes.includes(userId)) {
                                            Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $pull: { optionSixesVotes: userId }}).then(function(){
                                                if (optionSelected !== "optionSixesVotes") {
                                                    Poll.findOneAndUpdate({_id: {$eq: pollId}}, { $push: { [optionSelected]: userId }}).then(function(){
                                                        return resolve(HTTPWTHandler.OK('Vote successful', {lastVote: "Six"}))
                                                    })
                                                    .catch(err => {
                                                        console.error('An error occured while adding:', userId, 'to:', optionSelected, 'in poll with id:', pollId, '. The error was:', err)
                                                        return resolve(HTTPWTHandler.serverError('An error occurred while adding vote. Please try again.'))
                                                    });
                                                } else {
                                                    return resolve(HTTPWTHandler.OK('Pulled', {lastVote: 'Six'}))
                                                }
                                            }).catch(error => {
                                                console.error('An error occurred while pulling:', userId, 'from optionSixesVotes in poll with id:', pollId, '. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while removing existing vote. Please try again.'))
                                            })
                                        } else {
                                            Poll.findOneAndUpdate({_id: {$eq: {$eq: pollId}}}, { $push: { [optionSelected] : userId }}).then(function(){
                                                return resolve(HTTPWTHandler.OK('Vote successful', {lastVote: "None"}))
                                            })
                                            .catch(err => {
                                                console.error('An error occurred while adding:', userId, 'to:', optionSelected, 'in poll with id:', pollId, '. The error was:', err)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while adding vote. Please try again.'))
                                            });
                                        }
                                    } else {
                                        return resolve(HTTPWTHandler.forbidden("You can't vote on your own post"))
                                    }
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
                }
                addVote()
            }
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
                                            commentDownVoted: commentDownVoted
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
                                                commentDownVoted: commentDownVoted
                                            })
                                        } else {
                                            console.error("A comment exists but it's creator's account has been deleted. This comment must be deleted immediately. Comment id:", item._id, ' User Id:', item.commenterId)
                                        }
                                    }
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
                                Poll.deleteOne({_id: {$eq: pollId}}).then(() => {
                                    Promise.all([
                                        Upvote.deleteMany({postId: poll._id, postFormat: "Poll"}),
                                        Downvote.deleteMany({postId: poll._id, postFormat: "Poll"})
                                    ]).then(() => {
                                        return resolve(HTTPWTHandler.OK('Successfully deleted poll'))
                                    }).catch(error => {
                                        console.error('An error occured while deleting all upvotes and downvotes from poll post with id:', pollId, '. The error was:', error)
                                        return resolve(HTTPWTHandler.OK('Post was deleted, but upvotes and downvotes failed to get deleted.'))
                                    })
                                }).catch(error => {
                                    console.error('An error occured while deleting poll with id:', pollId, '. The error was:', error)
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

    static #getImagesFromProfile = (userId, pubId) => {
        return new Promise(resolve => {
            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Type provided: ${typeof pubId}`))
            }
        
            if (pubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string.'))
            }
        
            const getImagesAndSendToUser = (postOwner, userRequesting) => {
                ImagePost.find({creatorId: postOwner._id}).sort({datePosted: -1}).lean().then(result => imagePostHandler.processMultiplePostDataFromOneOwner(result, postOwner, userRequesting)).then(result => {
                    if (result.length) {
                        return resolve(HTTPWTHandler.OK('Posts found', result))
                    } else {
                        return resolve(HTTPWTHandler.notFound('This user has no image posts!'))
                    }
                }).catch(error => {
                    console.error('An error occured while getting user images from user with id:', postOwner._id, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while getting user image posts. Please try again.'))
                })
            }
        
            User.findOne({secondId: {$eq: pubId}}).lean().then(data => { 
                User.findOne({_id: {$eq: userId}}).lean().then(secondData => {
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
                    } else if (data.blockedAccounts.includes(userPublicID)) {
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

    static #imagepostcomment = (userId, comment, userName, imageId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof userName !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userName must be a string. Provided type: ${typeof userName}`))
            }
        
            if (typeof imageId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`imageId must be a string. Provided type: ${typeof imageId}`))
            }
        
            comment = comment.trim()
        
            if (comment.length == 0) {
                return resolve(HTTPWTHandler.badInput('comment must not be an empty string.'))
            }
        
            if (userName.length == 0) {
                return resolve(HTTPWTHandler.badInput('userName must not be an empty string.'))
            }
        
            if (imageId.length == 0) {
                return resolve(HTTPWTHandler.badInput('imageId must not be an empty string'))
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
                    if (result.name == userName) {
                        async function findImages() {
                            const objectId = new mongodb.ObjectID()
                            console.log(objectId)
                            var commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], commentReplies: [], datePosted: Date.now()}
                            ImagePost.findOneAndUpdate({_id: {$eq: imageId}}, { $push: { comments: commentForPost } }).then(function(){
                                console.log("SUCCESS1")
                                return resolve(HTTPWTHandler.OK('Comment upload successful'))
                            })
                            .catch(err => {
                                console.error('An error occurred while pushing comment object:', commentForPost, 'to comments field for image with id:', imageId, '. The error was:', err)
                                return resolve(HTTPWTHandler.serverError('An error occurred while adding comment. Please try again.'))
                            });
                        }
                        findImages()
                    } else {
                        return resolve(HTTPWTHandler.badInput('userName provided is not the same username as in the database'))
                    }
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

    static #imagepostcommentreply = (userId, comment, userName, imageId, commentId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof userName !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userName must be a string. Provided type: ${typeof userName}`))
            }
        
            if (typeof imageId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`imageId must be a string. Provided type: ${typeof imageId}`))
            }

            if (typeof commentId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`commentId must be a string. Provided type: ${typeof commentId}`))
            }
        
            comment = comment.trim();
        
            if (comment.length == 0) {
                return resolve(HTTPWTHandler.badInput('comment cannot be an empty string.'))
            }
        
            if (userName.length == 0) {
                return resolve(HTTPWTHandler.badInput('userName cannot be an empty string.'))
            }
        
            if (imageId.length == 0) {
                return resolve(HTTPWTHandler.badInput('imageId cannot be an empty string.'))
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
                    if (result.name == userName) {
                        ImagePost.findOne({_id: {$eq: imageId}}).lean().then(data => {
                            if (data) {
                                var comments = data.comments
                                async function findThreads(sentIndex) {
                                    var objectId = new mongodb.ObjectID()
                                    console.log(objectId)
                                    var commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], datePosted: Date.now()}
                                    ImagePost.findOneAndUpdate({_id: {$eq: imageId}}, { $push: { [`comments.${sentIndex}.commentReplies`]: commentForPost } }).then(function(){
                                        console.log("SUCCESS1")
                                        return resolve(HTTPWTHandler.OK('Comment upload successful'))
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while adding comment:', commentForPost, 'to:', `"comments.${sentIndex}.commentReplies`, 'of image post with id:', imageId, '. The error was:', err)
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
                            console.error('An error occurred while finding one image post with id:', imageId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding image post. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.badInput('userName provided does not match username in the database.'))
                    }
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
                return HTTPHandler.badInput(res, 'imageKey cannot be an empty string.')
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
                    var itemsProcessed = 0;
                    if (comments.length == 0) {
                        return resolve(HTTPWTHandler.notFound('No comments could not be found for image post'))
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
                                        commentDownVoted: commentDownVoted
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
                                            commentDownVoted: commentDownVoted
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
                                                        commentDownVoted: commentDownVoted
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
                                allowScreenShots: allowScreenShots
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

    static #searchpagesearchcategories = (userId, val) => {
        return new Promise(resolve => {
            if (typeof val !== 'string') {
                return resolve(HTTPWTHandler.badInput(`val must be a string. Provided type: ${typeof val}`))
            }
        
            if (val.length == 0) {
                return resolve(HTTPWTHandler.badInput('Search box cannot be empty!'))
            }
        
            function sendResponse(foundArray) {
                console.log("Params Recieved")
                console.log(foundArray)
                return resolve(HTTPWTHandler.OK('Search successful', foundArray))
            }

            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (!userFound) {
                    return resolve(HTTPWTHandler.notFound('Could not find user with provided userId'))
                }

                var foundArray = []
                Category.find({categoryTitle: {$regex: `^${val}`, $options: 'i'}}).lean().then(data =>{
                    if (data.length) {
                        var itemsProcessed = 0;
                        data.forEach(function (item, index) {
                            foundArray.push({categoryTitle: data[index].categoryTitle, categoryDescription: data[index].categoryDescription, members: data[index].members.length, categoryTags: data[index].categoryTags, imageKey: data[index].imageKey, NSFW: data[index].NSFW, NSFL: data[index].NSFL, datePosted: data[index].datePosted, allowScreenShots: data[index].allowScreenShots, categoryId: String(data[index]._id)})
                            itemsProcessed++;
                            if(itemsProcessed === data.length) {
                                console.log("Before Function")
                                console.log(foundArray)
                                sendResponse(foundArray);
                            }
                        });
                    } else {
                        return resolve(HTTPWTHandler.notFound('No results'))
                    }
                })
                .catch(err => {
                    console.error('An error occurred while finding category with categoryTitle regex ^val and options: "i". val is:', val, '. The error was:', err)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding categories. Please try again.'))
                });
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

    static #findcategoryfromprofile = (userId, pubId) => {
        return new Promise(resolve => {
            if (typeof pubId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`pubId must be a string. Provided type: ${typeof pubId}`))
            }
        
            if (pubId.length == 0) {
                return resolve(HTTPWTHandler.badInput('pubId cannot be an empty string.'))
            }
        
            function sendResponse(foundCategories) {
                console.log("Params Recieved")
                console.log(foundCategories)
                return resolve(HTTPWTHandler.OK('Categories search successful', foundCategories))
            }

            //Find Categories
            var foundCategories = [];
            var itemsProcessed = 0;
            
            User.findOne({secondId: {$eq: pubId}}).lean().then(result => {
                if (result) {
                    User.findOne({_id: {$eq: userId}}).lean().then(userRequestingCategories => {
                        if (!userRequestingCategories || result.blockedAccounts.includes(userRequestingCategories.secondId)) {
                            return resolve(HTTPWTHandler.notFound('User could not be found.'))
                        }

                        if (result.privateAccount && result.secondId !== userRequestingCategories.secondId && !result.followers.includes(userRequestingCategories.secondId)) {
                            return resolve(HTTPWTHandler.forbidden('You must be following this account to see what categories they belong too.'))
                        }

                        var profilesId = result._id
                        console.log("profilesId:")
                        console.log(profilesId)
                        Category.find({members: profilesId}).lean().then(data =>{
                            console.log("Found categories")
                            console.log(data)
                            if (data.length) {
                                data.forEach(function (item, index) {
                                    var inCategory = false
                                    if (data[index].members.includes(userId)) {
                                        inCategory = true
                                    }
                                    foundCategories.push({
                                        categoryTitle: data[index].categoryTitle,
                                        categoryDescription: data[index].categoryDescription,
                                        members: data[index].members.length,
                                        categoryTags: data[index].categoryTags,
                                        imageKey: data[index].imageKey,
                                        NSFW: data[index].NSFW,
                                        NSFL: data[index].NSFL,
                                        datePosted: data[index].datePosted,
                                        inCategory: inCategory,
                                        allowScreenShots: data[index].allowScreenShots,
                                        categoryId: String(data[index]._id)
                                    })
                                    itemsProcessed++;
                                    if(itemsProcessed === data.length) {
                                        sendResponse(foundCategories);
                                    }
                                })
                            } else {
                                return resolve(HTTPWTHandler.notFound('No categories found'))
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

    static #posttextthread = (userId, threadTitle, threadSubtitle, threadTags, threadCategory, threadBody, threadNSFW, threadNSFL, sentAllowScreenShots) => {
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
        
            if (typeof threadCategory !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadCategory must be a string. Provided type: ${typeof threadCategory}`))
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
                    Category.findOne({categoryTitle: {$eq: threadCategory}}).then(data => {
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
                                threadCategory: threadCategory,
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
                        console.error('An error occurred while finding category with categoryTitle:', threadCategory, '. The error was:', error)
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

    static #postimagethread = (userId, threadTitle, threadSubtitle, threadTags, threadCategory, threadImageDescription, threadNSFW, threadNSFL, sentAllowScreenShots, file) => {
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
        
            if (typeof threadCategory !== 'string') {
                deleteImage()
                return resolve(HTTPWTHandler.badInput(`threadCategory must be a string. Provided type: ${typeof threadCategory}`))
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
            threadCategory = threadCategory.trim();
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
                    Category.findOne({categoryTitle: {$eq: threadCategory}}).lean().then(data => {
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
                                    threadCategory: threadCategory,
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
                        console.error('An error occured while finding category with title:', threadCategory, '. The error was:', error)
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
                            Thread.find({threadCategory: {$eq: categoryId}}).lean().then(result => {
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
                                            return resolve(HTTPWTHandler.OK('Posts found', posts))
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

    static #getthreadsfromprofile = (userId, pubId) => {
        return new Promise(resolve => {
            User.findOne({secondId: {$eq: pubId}}).lean().then(userResult => {
                if (userResult) {
                    User.findOne({_id: {$eq: userId}}).lean().then(userRequestingThreads => {
                        if (userRequestingThreads && !userResult.blockedAccounts.includes(userRequestingThreads.secondId)) {
                            if (userResult.privateAccount && !userResult.followers.includes(userRequestingThreads.secondId)) {
                                return resolve(HTTPWTHandler.notFound('This user has no thread posts!'))
                            }
                            var userid = userResult._id
                            console.log("user id:")
                            console.log(userid)
                            Thread.find({creatorId: {$eq: userid}}).sort({datePosted: -1}).lean().then(result => {
                                if (result.length) {
                                    threadPostHandler.processMultiplePostDataFromOneOwner(result, userResult, userRequestingThreads).then(posts => {
                                        return resolve(HTTPWTHandler.OK('Posts found', posts))
                                    }).catch(error => {
                                        console.error('An error occurred while processing thread posts. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while getting thread posts. Please try again.'))
                                    })
                                } else {
                                    return resolve(HTTPWTHandler.notFound('This user has no thread posts!'))
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

    static #threadpostcomment = (userId, comment, userName, threadId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof userName !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userName must be a string. Provided type: ${typeof userName}`))
            }
        
            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
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
                    if (result.name == userName) {
                        var objectId = new mongodb.ObjectID()
                        console.log(objectId)
                        var commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], commentReplies: [], datePosted: Date.now()}
                        Thread.findOneAndUpdate({_id: {$eq: threadId}}, { $push: { comments: commentForPost } }).then(function(){
                            console.log("SUCCESS1")
                            return resolve(HTTPWTHandler.OK('Comment upload successful'))
                        })
                        .catch(err => {
                            console.error('An error occurred while adding comment object:', commentForPost, "to thread's comments with id:", threadId, '. The error was:', err)
                            return resolve(HTTPWTHandler.serverError('An error occurred while adding comment to post. Please try again.'))
                        });
                    } else {
                        return resolve(HTTPWTHandler.notFound('name in database does not match up with provided userName'))
                    }
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

    static #threadpostcommentreply = (userId, comment, userName, threadId, commentId) => {
        return new Promise(resolve => {
            if (typeof comment !== 'string') {
                return resolve(HTTPWTHandler.badInput(`comment must be a string. Provided type: ${typeof comment}`))
            }
        
            if (typeof userName !== 'string') {
                return resolve(HTTPWTHandler.badInput(`userName must be a string. Provided type: ${typeof userName}`))
            }
        
            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
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
                    if (result.name == userName) {
                        Thread.findOne({_id: {$eq: threadId}}).lean().then(data => {
                            if (data) {
                                const comments = data.comments;

                                const commentIndex = comments.findIndex(item => String(item.commentId) === commentId)

                                if (commentIndex === -1) {
                                    return resolve(HTTPWTHandler.badInput("Couldn't find comment"))
                                }

                                const objectId = new mongodb.ObjectID()
                                console.log(objectId)
                                var commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], datePosted: Date.now()}
                                Thread.findOneAndUpdate({_id: {$eq: threadId}}, { $push: { [`comments.${sentIndex}.commentReplies`]: commentForPost } }).then(function(){
                                    console.log("SUCCESS1")
                                    return resolve(HTTPWTHandler.OK('Comment upload successful'))
                                })
                                .catch(err => {
                                    console.error('An error occurred while pushing:', commentForPost, 'to:', `comments.${sentIndex}.commentReplies`, ' for thread with id:', threadId, '. The error was:', err)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while adding comment. Please try again.'))
                                });
                            } else {
                                return resolve(HTTPWTHandler.notFound('Could not find thread'))
                            }
                        }).catch(error => {
                            console.error('An error occurred while finding thread with id:', threadId, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding thread. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.badInput('name in database does not match up with userName provided'))
                    }
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

    static #searchforthreadcomments = (userId, threadId) => {
        return new Promise(resolve => {
            if (typeof threadId !== 'string') {
                return resolve(HTTPWTHandler.badInput(`threadId must be a string. Provided type: ${typeof threadId}`))
            }
        
            if (threadId.length == 0) {
                return resolve(HTTPWTHandler.badInput('threadId cannot be blank'))
            }
        
            //Find User
            function sendResponse(nameSendBackObject) {
                console.log("Params Recieved")
                console.log(nameSendBackObject)
                HTTPHandler.OK(res, 'Comment search successful', nameSendBackObject)
            }
            
            Thread.findOne({_id: {$eq: threadId}}).lean().then(data => {
                if (data) {
                    var nameSendBackObject = [];
                    var comments = data.comments;
                    if (comments.length == 0) {
                        return resolve(HTTPWTHandler.notFound('This thread post has no comments'))
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
                                    nameSendBackObject.push({commentId: String(data.comments[index].commentId), commenterName: result.name, commenterDisplayName: result.displayName, commentText: data.comments[index].commentsText, commentUpVotes: commentUpVotes, commentDownVotes: data.comments[index].commentDownVotes, commentReplies: data.comments[index].commentReplies.length, datePosted: data.comments[index].datePosted, profileImageKey: result.profileImageKey, commentUpVoted: commentUpVoted, commentDownVoted: commentDownVoted})
                                } else {
                                    console.error('A comment was found on thread post with id:', threadId, " and the comment creator cannot be found. The comment creator's id is:", comments[index].commenterId)
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
                console.error('An error occurred while finding thread with id:', threadId, '. The error was:', err)
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
                        commentDownVoted: commentDownVoted
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
                                    commentDownVoted: commentDownVoted
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
                    Category.findOne({_id: result.threadCategory}).lean().then(data =>{ 
                        if (data) {
                            var categoryImageKey = data.imageKey
                            if (data.imageKey == "") {
                                categoryImageKey = null
                            }

                            User.findOne({_id: result.creatorId}).lean().then(data => {
                                if (data) {
                                    User.findOne({_id: {$eq: userId}}).lean().then(userRequestingThread => {
                                        if (userRequestingThread) {
                                            if (data.blockedAccounts.includes(userRequestingThread.secondId)) {
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
                        console.error('An error occurred while finding category with title:', result.threadCategory, '. The error was:', error)
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

                                    if (pollCreator.blockedAccounts.includes(result.secondId)) {
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

                                        if (commentCreator.blockedAccounts.includes(result.secondId)) {
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

                                    if (postCreator.blockedAccounts.includes(result.secondId)) {
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

                                        if (commentCreator.blockedAccounts.includes(result.secondId)) {
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

                                    if (postCreator.blockedAccounts.includes(result.secondId)) {
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

                                        if (commentCreator.blockedAccounts.includes(result.secondId)) {
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

                                    if (postCreator.blockedAccounts.includes(result.secondId)) {
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

                                        if (commentCreator.blockedAccounts.includes(result.secondId)) {
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

                                    if (postCreator.blockedAccounts.includes(result.secondId)) {
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

                                        if (commentCreator.blockedAccounts.includes(result.secondId)) {
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

                                    if (postCreator.blockedAccounts.includes(result.secondId)) {
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

                                        if (commentCreator.blockedAccounts.includes(result.secondId)) {
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
                        if (!userGettingFollowed || userGettingFollowed.blockedAccounts.includes(userFollowingFound.secondId)) {
                            //If the user could not be found or if the user has blocked the user trying to follow
                            return resolve(HTTPWTHandler.notFound('User not found'))
                        }

                        if (userId === String(userGettingFollowed._id)) {
                            return resolve(HTTPWTHandler.forbidden('You cannot follow yourself'))
                        }


                        if (userGettingFollowed.privateAccount == true) {
                            if (userGettingFollowed.followers.includes(userFollowingFound.secondId)) {
                                //UnFollow private account
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

                                User.bulkWrite(dbUpdates).then(() => {
                                    return resolve(HTTPWTHandler.OK('UnFollowed user'))
                                }).catch(error => {
                                    console.error('An error occurred while unfollowing private account using bulkWrite on the User collection. The updates array was:', dbUpdates, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while unfollowing user. Please try again.'))
                                })
                            } else {
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
                            }
                        } else {
                            if (!userGettingFollowed.followers.includes(userFollowingFound.secondId)) {
                                //Follow

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

                                User.bulkWrite(dbUpdates).then(() => {
                                    var notifMessage = {
                                        title: "New Follower",
                                        body: userFollowingFound[0].name + " has followed you."
                                    }
                                    var notifData = {
                                        type: "Follow",
                                        pubIdOfFollower: userFollowingFound[0].secondId
                                    }
                                    sendNotifications(userGettingFollowed[0]._id, notifMessage, notifData)

                                    return resolve(HTTPWTHandler.OK('Followed User'))
                                }).catch(error => {
                                    console.error('An error occurred while following not-private account using bulkWrite on the User collection. The updates array was:', dbUpdates, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while following user. Please try again.'))
                                })
                            } else {
                                //UnFollow

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

                                User.bulkWrite(dbUpdates).then(() => {
                                    return resolve(HTTPWTHandler.OK('UnFollowed User'))
                                }).catch(error => {
                                    console.error('An error occurred while unfollowing not-private account using bulkWrite on the User collection. The updates array was:', dbUpdates, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while unfollowing user. Please try again.'))
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
                            if (userData.blockedAccounts.includes(userSearchingPubId)) {
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
                                    if (userData[0].followers.includes(userSearchingPubId)) {
        
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
                            if (userFound.blockedAccounts.includes(requestingUser.secondId)) {
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
            const makeAccountPublic = () => {
                User.findOneAndUpdate({_id: {$eq: userId}}, {privateAccount: false}).then(function() {
                    return resolve(HTTPWTHandler.OK('Account is now public.'))
                }).catch((error) => {
                    console.error('An error occurred while setting privateAccount to false for user with id:', userId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while making the account public. Please try again.'))
                })
            };
        
            User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
                if (userFound) {
                    //User found
                    const accountsRequestingToFollow = userFound.accountFollowRequests
                    if (accountsRequestingToFollow) {
                        const dbUpdates = [
                            {
                                updateOne: {
                                    filter: {_id: {$eq: userId}},
                                    update: {$push: {followers: {$each: accountsRequestingToFollow}}}
                                }
                            },
                            {
                                updateOne: {
                                    filter: {_id: {$eq: userId}},
                                    update: {accountFollowRequests: []}
                                }
                            },
                            ...accountsRequestingToFollow.map(accountPubId => {
                                return {
                                    updateOne: {
                                        filter: {secondId: {$eq: accountPubId}},
                                        update: {$push: {following: userFound.secondId}}
                                    }
                                }
                            })
                        ]
        
                        User.bulkWrite(dbUpdates).then(() => {
                            makeAccountPublic()
                        }).catch(error => {
                            console.error('An error occurred while making bulkWrite database updates to the User collection. The updates were:', dbUpdates, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while adding users that requested to follow you to your followers list. Please try again.'))
                        })
                    } else {
                        makeAccountPublic()
                    }
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

    static sendnotificationkey = async (userId, notificationKey) => {
        return await this.#sendnotificationkey(userId, notificationKey)
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

    static searchforpollposts = async (userId, pubId) => {
        return await this.#searchforpollposts(userId, pubId)
    }

    static pollpostcomment = async (userId, comment, userName, pollId) => {
        return await this.#pollpostcomment(userId, comment, userName, pollId)
    }

    static pollpostcommentreply = async (userId, comment, userName, pollId, commentId) => {
        return await this.#pollpostcommentreply(userId, comment, userName, pollId, commentId)
    }

    static searchforpollcomments = async (userId, pollId) => {
        return await this.#searchforpollcomments(userId, pollId)
    }

    static voteonpoll = async (userId, optionSelected, pollId) => {
        return await this.#voteonpoll(userId, optionSelected, pollId)
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

    static getImagesFromProfile = async (userId, pubId) => {
        return await this.#getImagesFromProfile(userId, pubId)
    }

    static getProfilePic = async (pubId) => {
        return await this.#getProfilePic(pubId)
    }

    static imagepostcomment = async (userId, comment, userName, imageId) => {
        return await this.#imagepostcomment(userId, comment, userName, imageId)
    }

    static imagepostcommentreply = async (userId, comment, userName, imageId, commentId) => {
        return await this.#imagepostcommentreply(userId, comment, userName, imageId, commentId)
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

    static searchpagesearchcategories = async (userId, val) => {
        return await this.#searchpagesearchcategories(userId, val)
    }

    static getcategoryimage = async (val) => {
        return await this.#getcategoryimage(val)
    }

    static findcategorybyid = async (userId, categoryId) => {
        return await this.#findcategorybyid(userId, categoryId)
    }

    static findcategoryfromprofile = async (userId, pubId) => {
        return await this.#findcategoryfromprofile(userId, pubId)
    }

    static joincategory = async (userId, categoryId) => {
        return await this.#joincategory(userId, categoryId)
    }

    static posttextthread = async (userId, threadTitle, threadSubtitle, threadTags, threadCategory, threadBody, threadNSFW, threadNSFL, sentAllowScreenShots) => {
        return await this.#posttextthread(userId, threadTitle, threadSubtitle, threadTags, threadCategory, threadBody, threadNSFW, threadNSFL, sentAllowScreenShots)
    }

    static postimagethread = async (userId, threadTitle, threadSubtitle, threadTags, threadCategory, threadImageDescription, threadNSFW, threadNSFL, sentAllowScreenShots, file) => {
        return await this.#postimagethread(userId, threadTitle, threadSubtitle, threadTags, threadCategory, threadImageDescription, threadNSFW, threadNSFL, sentAllowScreenShots, file)
    }

    static getthreadsfromcategory = async (userId, categoryId) => {
        return await this.#getthreadsfromcategory(userId, categoryId)
    }

    static getthreadsfromprofile = async (userId, pubId) => {
        return await this.#getthreadsfromprofile(userId, pubId)
    }

    static upvotethread = async (userId, threadId) => {
        return await this.#upvotethread(userId, threadId)
    }

    static downvotethread = async (userId, threadId) => {
        return await this.#downvotethread(userId, threadId)
    }

    static threadpostcomment = async (userId, comment, userName, threadId) => {
        return await this.#threadpostcomment(userId, comment, userName, threadId)
    }

    static threadpostcommentreply = async (userId, comment, userName, threadId, commentId) => {
        return await this.#threadpostcommentreply(userId, comment, userName, threadId, commentId)
    }

    static searchforthreadcomments = async (userId, threadId) => {
        return await this.#searchforthreadcomments(userId, threadId)
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
}

module.exports = TempController;