const User = require('../models/User');
const Poll = require('../models/Poll');

const HTTPWTLibrary = require('../libraries/HTTPWT');
const CONSTANTS = require('../constants');
const HTTPWTHandler = new HTTPWTLibrary()

const HTTPLibrary = require('../libraries/HTTP');
const HTTPHandler = new HTTPLibrary();

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
}

module.exports = TempController;