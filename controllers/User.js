const CONSTANTS = require('../constants');
const HTTPWTLibrary = require('../libraries/HTTPWT');
const HTTPWTHandler = new HTTPWTLibrary();
const HTTPLibrary = require('../libraries/HTTP');
const HTTPHandler = new HTTPLibrary();
const geoIPLite = require('geoip-lite')
const UserLibrary = require('../libraries/User')
const userHandler = new UserLibrary()
const User = require('../models/User')
const axios = require('axios')
const RefreshToken = require('../models/RefreshToken')
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid');

const { setCacheItem, getCacheItem, delCacheItem } = require('../memoryCache.js')

const { blurEmailFunction, mailTransporter } = require('../globalFunctions.js');
const EmailVerificationCode = require('../models/EmailVerificationCode');

class UserController {
    static #signup = (name, email, password, IP, deviceName) => {
        return new Promise(resolve => {
            if (typeof name !== 'string') {
                return resolve(HTTPWTHandler.badInput(`name must be a string. Provided type: ${typeof name}`))
            }

            if (typeof email !== 'string') {
                return resolve(HTTPWTHandler.badInput(`email must be a string. Provided type: ${typeof email}`))
            }

            if (typeof password !== 'string') {
                return resolve(HTTPWTHandler.badInput(`password must be a string. Provided type: ${typeof password}`))
            }

            name = name.trim();
            let displayName = ""; //Adding displayName via SocialSquare app will be coming soon - For now it'll be an empty string
            email = email.trim();
            let badges = [];
            password = password.trim();

            if (name.length === 0) {
                return resolve(HTTPWTHandler.badInput('Name input field cannot be empty!'))
            }

            if (email.length === 0) {
                return resolve(HTTPWTHandler.badInput('Email input field cannot be empty!'))
            }

            if (password.length === 0) {
                return resolve(HTTPWTHandler.badInput('Password input field cannot be empty!'))
            }

            if (!CONSTANTS.VALID_USERNAME_TEST.test(name)) {
                return resolve(HTTPWTHandler.badInput('Invalid name entered'))
            }

            if (!CONSTANTS.VALID_EMAIL_TEST.test(email)) {
                return resolve(HTTPWTHandler.badInput('Invalid email entered'))
            }

            if (password.length < CONSTANTS.MIN_USER_PASSWORD_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`Password is too short! Password must be ${CONSTANTS.MIN_USER_PASSWORD_LENGTH} characters or longer`))
            }

            if (name.length > CONSTANTS.MAX_USER_USERNAME_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`Username is too long! Please keep your username at ${CONSTANTS.MAX_USER_USERNAME_LENGTH} characters or less.`))
            }

            if (password.length > CONSTANTS.MAX_USER_PASSWORD_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`Password is too long! Due to current limitations, please keep your password at ${CONSTANTS.MAX_USER_PASSWORD_LENGTH} or less characters.`))
            }

            // Checking if user already exists
            User.findOne({email: {$eq: email}}).then(result => {
                if (result) {
                    // A user already exists
                    return resolve(HTTPWTHandler.conflict('User with the provided email already exists.'))
                } else { 
                    User.findOne({name: {$eq: name}}).then(result => {
                        // A username exists
                        if (result) {
                            return resolve(HTTPWTHandler.conflict('User with the provided username already exists'))
                        } else {
                            User.findOne({displayName: {$eq: displayName}}).lean().then(result => {
                                if (result && displayName !== "") {
                                    return resolve(HTTPWTHandler.conflict('User with the provided display name already exists'))
                                } else {
                                    //Try to create a new user
                                    badges.push({badgeName: "onSignUpBadge", dateRecieved: Date.now()});
                                    console.log(badges);
                                    // password handling
                                    const saltRounds = CONSTANTS.BCRYPT_COST_FACTOR
                                    bcrypt.hash(password, saltRounds).then(hashedPassword => {
                                        var newUUID = uuidv4(); 
                                        const newUser = new User({
                                            secondId: newUUID,
                                            name,
                                            displayName,
                                            email,
                                            badges,
                                            password: hashedPassword,
                                            followers: [],
                                            following: [],
                                            totalLikes: 0,
                                            profileImageKey: ""
                                        });

                                        newUser.save().then(result => {
                                            const {token, refreshToken, encryptedRefreshToken} = userHandler.generateNewAuthAndRefreshTokens(result._id)

                                            const newRefreshTokenObject = {
                                                encryptedRefreshToken,
                                                userId: result._id,
                                                createdAt: Date.now(),
                                                admin: false
                                            }

                                            const formattedIP = HTTPHandler.formatIP(IP)
            
                                            if (result?.settings?.loginActivitySettings?.getIP) {
                                                newRefreshTokenObject.IP = formattedIP
                                            }
            
                                            if (result?.settings?.loginActivitySettings?.getLocation) {
                                                const location = geoIPLite.lookup(formattedIP)
                                                newRefreshTokenObject.location = location?.city + ', ' + location?.country
                                            }
            
                                            if (result?.settings?.loginActivitySettings?.getDeviceType) {
                                                newRefreshTokenObject.deviceType = deviceName
                                            }
            
                                            const newRefreshToken = new RefreshToken(newRefreshTokenObject)

                                            newRefreshToken.save().then(refreshTokenResult => {
                                                return resolve(HTTPWTHandler.OK('Signup successful', userHandler.filterUserInformationToSend(result.toJSON()), {token: `Bearer ${token}`, refreshToken: `Bearer ${refreshToken}`, refreshTokenId: String(refreshTokenResult._id)}))
                                            }).catch(error => {
                                                console.error('An error occurred while saving new RefreshToken to database. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while logging you into your new account. Your account was successfully created so please go to the login screen to login to your account.'))
                                            })
                                        }).catch(err => {
                                            console.error('An error occured while saving user account:', err)
                                            return resolve(HTTPWTHandler.serverError('An error occurred while saving user account! Please try again.'))
                                        })
                                    }).catch(error => {
                                        console.error('An error occured while hashing password:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while hashing password. Please try again.'))
                                    })
                                }
                            }).catch(error => {
                                console.error('An error occured while finding one user with displayName:', displayName, '. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while checking for existing user. Please try again.'))
                            })
                        }
                    }).catch(err => {
                        console.error('An error occured while finding user with name:', name, '. The error was:', err)
                        return resolve(HTTPWTHandler.serverError('An error occurred while checking for existing user. Please try again.'))
                    })
                }
            }).catch(err => {
                console.error('An error occured while checking for user with email:', email, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while checking for existing user. Please try again.'))
            })
        })
    }

    static #signin = (email, password, IP, deviceName) => {
        return new Promise(resolve => {
            if (typeof email !== 'string') {
                return resolve(HTTPWTHandler.badInput(`email must be a string. Provided type: ${typeof email}`))
            }
        
            if (typeof password !== 'string') {
                return resolve(HTTPWTHandler.badInput(`password must be a string. Provided type: ${typeof password}`))
            }
        
            email = email.trim();
            password = password.trim();

            if (email.length === 0) {
                return resolve(HTTPWTHandler.badInput('Email cannot be blank'))
            }

            if (password.length === 0) {
                return resolve(HTTPWTHandler.badInput('Password cannot be blank'))
            }

            User.findOne({email: {$eq: email}}).lean().then(userFound => {
                if (!userFound) return resolve(HTTPWTHandler.notFound('A user with the specified email does not exist.'))

                const hashedPassword = userFound.password;
                bcrypt.compare(password, hashedPassword).then(async result => {
                    if (!result) return resolve(HTTPWTHandler.unauthorized('Invalid password entered!'))

                    if (data.authenticationFactorsEnabled?.includes('Email')) {
                        try {
                            var randomString = await axios.get('https://www.random.org/integers/?num=1&min=1&max=1000000000&col=1&base=16&format=plain&rnd=new')
                            randomString = String(randomString.data).trim();
                            console.log('Random string generated: ' + randomString)
                    
                            if (randomString.length != 8) {
                                console.log('An error occured while generating random string. The random string that was generated is: ' + randomString)
                                return resolve(HTTPWTHandler.serverError('An error occurred while generating random string. Please try again.'))
                            }
                        } catch (error) {
                            console.error('An error occurred while getting a random string. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while generating a random string. Please try again'))
                        }

                        try {
                            var hashedRandomString = await bcrypt.hash(randomString, CONSTANTS.EMAIL_VERIFICATION_CODE_SALT_ROUNDS);
                        } catch (error) {
                            console.error('An error occurred while hashing random string. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while hashing the random string. Please try again'))
                        }

                        const userId = data._id

                        const emailVerificationCodeData = {
                            userId,
                            hashedVerificationCode: hashedRandomString
                        }

                        EmailVerificationCode.findOneAndReplace({userId: {$eq: userId}}, emailVerificationCodeData, {upsert: true}).then(() => {
                            //If there is a document that already matches the query criteria, it'll get replaced with the new emailVerificationCodeData
                            //If it does not exist, it'll get added to the database because of upsert: true

                            var emailData = {
                                from: process.env.SMTP_EMAIL,
                                to: data.MFAEmail,
                                subject: "Code to login to your SocialSquare account",
                                text: `Someone is trying to login to your account. If this is you, please enter this code into SocialSquare to login: ${randomString}. If you are not trying to login to your account, change your password immediately as someone else knows it.`,
                                html: `<p>Someone is trying to login to your account. If this is you, please enter this code into SocialSquare to login: ${randomString}. If you are not trying to login to your account, change your password immediately as someone else knows it.</p>`
                            };

                            mailTransporter.sendMail(emailData, function(error, response){ // Modified answer from https://github.com/nodemailer/nodemailer/issues/169#issuecomment-20463956
                                if(error){
                                    console.error('An error occurred while sending email to user for task:', task, '. User ID for user was:', userId, '. Error type:', error.name, '. SMTP log:', error.data)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while sending email verification code. Please try again'))
                                }

                                console.log('Sent random string to user.')
                                return resolve(HTTPWTHandler.OK('Email', {email: blurEmailFunction(data.MFAEmail), fromAddress: process.env.SMTP_EMAIL, secondId: data.secondId}))
                            });
                        }).catch(error => {
                            console.error('An error occurred while doing findOneAndReplace for EmailVerificationCode querying {userId:', userId, '}. emailVerificationCodeData is:', emailVerificationCodeData, '. Options: {upsert: true}. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while saving verification code. Please try again.'))
                        })
                
                    } else {
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

                        if (data?.settings?.loginActivitySettings?.getLocation) {
                            const location = geoIPLite.lookup(formattedIP)
                            newRefreshTokenObject.location = location?.city + ', ' + location?.country
                        }

                        if (data?.settings?.loginActivitySettings?.getDeviceType) {
                            newRefreshTokenObject.deviceType = deviceName
                        }

                        const newRefreshToken = new RefreshToken(newRefreshTokenObject)

                        newRefreshToken.save().then(refreshTokenSaved => {
                            const dataToSend = userHandler.filterUserInformationToSend(data)
                            return resolve(HTTPWTHandler.OK('Signin successful', dataToSend, {token: `Bearer ${token}`, refreshToken: `Bearer ${refreshToken}`, refreshTokenId: String(refreshTokenSaved._id)}))
                        }).catch(error => {
                            console.error('An error occurred while saving new refresh token. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while saving refresh token. Please try again.'))
                        })
                    }
                }).catch(error => {
                    console.error('An error occurred while comparing password with bcrypt:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while authenticating. Please try again.'))
                })
            }).catch(error => {
                console.error('An error occurred while finding one user with email:', email, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
            })
        })
    }

    static #checkusernameavailability = (username) => {
        return new Promise(resolve => {
            if (typeof username !== 'string') {
                return resolve(HTTPWTHandler.badInput(`username must be a string. Provided type: ${typeof username}`))
            }
           
            if (username.length < 1) {
                return resolve(HTTPWTHandler.badInput('Username cannot be blank'))
            }
        
            if (username.length > 20) {
                return resolve(HTTPWTHandler.badInput('Username must be 20 or less characters'))
            }
        
            User.findOne({name: {$regex: `^${username}$`, $options: 'i'}}).lean().then(userFound => {
                if (userFound) {
                    return resolve(HTTPWTHandler.OK('Username is not available'))
                } else {
                    return resolve(HTTPWTHandler.OK('Username is available'))
                }
            }).catch(err => {
                console.error('An error occurred while finding one user with name:', username, '. The error was:', err)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user with username. Please try again.'))
            })
        })
    }

    static #sendemailverificationcode = (userID, task, getAccountMethod, username, email, secondId) => {
        return new Promise(async resolve => {
            try {
                var randomString = await axios.get('https://www.random.org/integers/?num=1&min=268500000&max=1000000000&col=1&base=16&format=plain&rnd=new')
                randomString = String(randomString.data).trim();
                console.log('Random string generated: ' + randomString)
        
                if (randomString.length != 8) {
                    console.log('An error occured while generating random string. The string is not 8 characters long. The random string that was generated is: ' + randomString)
                    return resolve(HTTPWTHandler.serverError('An error occurred while generating random string. Please try again later.'))
                }
            } catch (error) {
                console.error('An error occurred while getting a random string. Data returned from random.org axios call:' + randomString.data, '.The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while generating random string. Please try again.'))
            }

            let user;
        
            try {
                console.log('Task:', task, '  |   getAccountMethod:', getAccountMethod)
                if (getAccountMethod === 'userID') {
                    if (typeof userID !== 'string') return resolve(HTTPWTHandler.badInput(`userID must be a string. Provided type: ${typeof userID}`))
                    if (userID.length === 0) return resolve(HTTPWTHandler.badInput('userID cannot be blank'))

                    user = await User.findOne({_id: {$eq: userID}}).lean()
                } else if (getAccountMethod === 'username') {
                    if (typeof username !== 'string') return resolve(HTTPWTHandler.badInput(`username must be a string. Provided type: ${typeof username}`))
                    if (username.length === 0) return resolve(HTTPWTHandler.badInput('username cannot be blank'))

                    user = await User.findOne({name: {$eq: username}}).lean()
                } else if (getAccountMethod === 'secondId') {
                    if (typeof secondId !== 'string') return resolve(HTTPWTHandler.badInput(`secondId must be a string. Provided type: ${typeof secondId}`))
                    if (secondId.length === 0) return resolve(HTTPWTHandler.badInput('secondId cannot be blank'))

                    user = await User.findOne({secondId: {$eq: secondId}}).lean()
                } else {
                    return resolve(HTTPWTHandler.badInput('Unrecognized getAccountMethod sent'))
                }
            } catch (error) {
                console.error('An error occurred while finding one user with getAccountMethod:', getAccountMethod, 'and the value of the getAccountMethod being:', getAccountMethod === 'userID' ? userID : getAccountMethod === 'username' ? username : secondId, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding the user. Please try again.'))
            }

            if (!user) {
                return resolve(HTTPWTHandler.notFound('Could not find user'))
            }

            //Would use bcrypt.hash (async version) but since each request makes a new thread, having it sync doesn't matter and it won't affect other requests being processed
            let hashedRandomString;
            try {
                hashedRandomString = bcrypt.hashSync(randomString, CONSTANTS.EMAIL_VERIFICATION_CODE_SALT_ROUNDS)
            } catch (error) {
                console.error('An error occurred while hashing random string:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while hashing verification code. Please try again.'))
            }

            const emailVerificationCodeData = {
                userId: user._id,
                hashedVerificationCode: hashedRandomString
            }

            EmailVerificationCode.findOneAndReplace({userId: {$eq: user._id}}, emailVerificationCodeData, {upsert: true}).then(() => {
                //If there is a document that already matches the query criteria, it'll get replaced with the new emailVerificationCodeData
                //If it does not exist, it'll get added to the database because of upsert: true

                let emailData;

                let blurredMail;

                if (task == "Add Email Multi-Factor Authentication") {
                    emailData = {
                        from: process.env.SMTP_EMAIL,
                        to: email,
                        subject: "Add Email as a Multi-Factor Authentication to your SocialSquare account",
                        text: `Your account requested to add email as a factor for multi-factor authentication. Please enter this code into SocialSquare to add email as a factor for multi-factor authentication: ${randomString}. If you did not request this, please change your password as only users who are logged into your account can make this request.`,
                        html: `<p>Your account requested to add email as a factor for multi-factor authentication. Please enter this code into SocialSquare to add email as a factor for multi-factor authentication: ${randomString}. If you did not request this, please change your password as only users who are logged into your account can make this request.</p>`
                    };
                    blurredMail = blurEmailFunction(email)
                } else if (task == 'Check Before Reset Password') {
                    emailData = {
                        from: process.env.SMTP_EMAIL,
                        to: user.email,
                        subject: "Reset password for your SocialSquare account",
                        text: `Your account requested a password reset. Please enter this code into SocialSquare to reset your password: ${randomString}. If you did not request a password reset, please ignore this email.`,
                        html: `<p>Your account requested a password reset. Please enter this code into SocialSquare to reset your password: ${randomString}. If you did not request a password reset, please ignore this email.</p>`
                    };
                    blurredMail = blurEmailFunction(user.email)
                } else if (task == 'Verify Email MFA Code') {
                    emailData = {
                        from: process.env.SMTP_EMAIL,
                        to: user.MFAEmail,
                        subject: "Code to login to your SocialSquare account",
                        text: `Someone is trying to login to your account. If this is you, please enter this code into SocialSquare to login: ${randomString}. If you are not trying to login to your account, change your password immediately as someone else knows it.`,
                        html: `<p>Someone is trying to login to your account. If this is you, please enter this code into SocialSquare to login: ${randomString}. If you are not trying to login to your account, change your password immediately as someone else knows it.</p>`
                    };
                    blurredMail = blurEmailFunction(user.MFAEmail)
                } else {
                    return resolve(HTTPWTHandler.badInput('Unrecognized task sent'))
                }

                mailTransporter.sendMail(emailData, function(error, response){ // Modified answer from https://github.com/nodemailer/nodemailer/issues/169#issuecomment-20463956
                    if(error){
                        console.error('An error occurred while sending email verification code to user. Email Data was:', emailData, 'The error object was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while sending email verification code. Please try again.'))
                    } else if (response) {
                        return resolve(HTTPWTHandler.OK('Email verification code has been sent.', {blurredEmail: blurredMail, fromAddress: process.env.SMTP_EMAIL}))
                    }
                });
            }).catch(error => {
                console.error('An error occurred while finding email verification code with userId:', user._id, 'and replacing it with:', emailVerificationCodeData, 'with upsert set to true. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while saving verification code. Please try again.'))
            })
        })
    }

    static #checkverificationcode = (username, verificationCode, task, getAccountMethod, userID, email, secondId, IP, deviceType) => {
        return new Promise(resolve => {
            if (getAccountMethod == 'username') {
                if (typeof username !== 'string') {
                    return resolve(HTTPWTHandler.badInput(`username must be a string. Type provided: ${typeof username}`))
                }
        
                username = username.trim()

                if (username.length === 0) {
                    return resolve(HTTPWTHandler.badInput('username cannot be blank'))
                }
        
                User.findOne({name: {$eq: username}}).lean().then(userFound => {
                    if (userFound) {
                        const userID = userFound._id.toString();

                        EmailVerificationCode.findOne({userId: userFound._id}).lean().then(verificationCodeFound => {
                            if (!verificationCodeFound) {
                                return resolve(HTTPWTHandler.forbidden('Verification code has expired. Please create a new verification code.'))
                            }

                            if ((Date.now() - verificationCodeFound.createdAt) / 1000 > CONSTANTS.EMAIL_VERIFICATION_CODE_EXPIRE_TIME_SECONDS) {
                                return resolve(HTTPWTHandler.forbidden('Verification code has expired. Please create a new verification code.'))
                            }

                            bcrypt.compare(verificationCode, verificationCodeFound.hashedVerificationCode).then(result => {
                                if (result) {
                                    if (task === 'Check Before Reset Password') {
                                        return resolve(HTTPWTHandler.OK('Verification code is correct.'))
                                    } else {
                                        return resolve(HTTPWTHandler.badInput('Task is not supported.'))
                                    }
                                } else {
                                    return resolve(HTTPWTHandler.badInput('Verification code is incorrect.'))
                                }
                            }).catch(error => {
                                console.error('An error occurred while comparing a string and its hash with bcrypt. The error was:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while comparing verification code. Please try again.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while finding email verification code with userId:', userFound._id, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding email verification code. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('There is no user with that username. Please try again.'))
                    }
                }).catch((error) => {
                    console.error('An error occured while finding a user with username:', username, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again.'))
                })
            } else if (getAccountMethod == 'userID') {
                if (typeof userID !== 'string') {
                    return resolve(HTTPWTHandler.badInput(`userID must be a string. Provided type: ${typeof userID}`))
                }
        
                userID = userID.trim();

                if (userID.length === 0) {
                    return resolve(HTTPWTHandler.badInput('userID cannot be blank.'))
                }
        
                User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
                    if (userFound) {
                        EmailVerificationCode.findOne({userId: userID}).lean().then(verificationCodeFound => {
                            if (!verificationCodeFound) {
                                return resolve(HTTPWTHandler.forbidden('Verification code has expired. Please create a new one.'))
                            }

                            if ((Date.now() - verificationCodeFound.createdAt) / 1000 > CONSTANTS.EMAIL_VERIFICATION_CODE_EXPIRE_TIME_SECONDS)  {
                                return resolve(HTTPWTHandler.forbidden('Verification code has expired. Please create a new one.'))
                            }

                            bcrypt.compare(verificationCode, verificationCodeFound.hashedVerificationCode).then(result => {
                                if (result) {
                                    EmailVerificationCode.deleteOne({userId: {$eq: userID}}).then(() => {
                                        if (task == 'Add Email Multi-Factor Authentication') {
                                            User.findOneAndUpdate({_id: {$eq: userID}}, {$push: {authenticationFactorsEnabled: 'Email'}, MFAEmail: String(email)}).then(function() {
                                                var emailData = {
                                                    from: process.env.SMTP_EMAIL,
                                                    to: userFound.email,
                                                    subject: "Email Multi-Factor Authentication Turned On",
                                                    text: `Email Multi-Factor authentication has now been turned on for your account. If you did not request for this to happen, someone else may be logged into your account and you might not be able to get back in. Try changing your password and if you can't contact SocialSquare support.`,
                                                    html: `<p>Email Multi-Factor authentication has now been turned on for your account. If you did not request for this to happen, someone else may be logged into your account and you might not be able to get back in. Try changing your password and if you can't contact SocialSquare support.</p>`
                                                };
                            
                                                mailTransporter.sendMail(emailData, function(error, response) {
                                                    if (error) {
                                                        console.error('An error occured while sending an email to user with ID: ' + userID)
                                                    }
                                                })
    
                                                return resolve(HTTPWTHandler.OK('Email is now a multi-factor authentication factor for your account.'))
                                            }).catch(error => {
                                                console.error('An error occurred while pushing Email to authenticationFactorsEnabled and setting MFAEmail to:', String(email), 'for user with id:', userID, '. The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while adding email to the list of authentication factors enabled for your account. Please try again.'))
                                            })
                                        } else {
                                            return resolve(HTTPWTHandler.badInput('Task is not supported.'))
                                        }
                                    }).catch(error => {
                                        console.error('An error occurred while deleting one email verification code with userId:', userID, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting used email verification code. Please try again.'))
                                    })
                                } else {
                                    return resolve(HTTPWTHandler.forbidden('Verification code is incorrect.'))
                                }
                            }).catch(error => {
                                console.error('An error occurred while comparing two strings with bcrypt:', error)
                                return resolve(HTTPWTHandler.serverError('An error occurred while comparing verification code. Please try again.'))
                            })
                        }).catch(error => {
                            console.error('An error occurred while finding one email verification code with userId:', userID, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding email verification code. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('User not found.'))
                    }
                }).catch(error => {
                    console.error('An error occured while finding user with ID:', userID, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding the user. Please try again.'))
                })
            } else if (getAccountMethod == 'secondId') {
                if (typeof secondId !== 'string') {
                    return resolve(HTTPWTHandler.badInput(`secondId must be a string. Provided type: ${typeof secondId}`))
                }
        
                User.findOne({secondId: {$eq: secondId}}).lean().then(userFound => {
                    if (userFound) {
                        EmailVerificationCode.findOne({userId: userFound._id}).lean().then(verificationCodeFound => {
                            if (!verificationCodeFound) {
                                console.log('Verification code expired - code not found in database')
                                return resolve(HTTPWTHandler.forbidden('Verification code has expired. Please create a new one.'))
                            }

                            if ((Date.now() - verificationCodeFound.createdAt) / 1000 > CONSTANTS.EMAIL_VERIFICATION_CODE_EXPIRE_TIME_SECONDS)  {
                                console.log('Verification code still in database - has expired though')
                                return resolve(HTTPWTHandler.forbidden('Verification code has expired. Please create a new one.'))
                            }

                            bcrypt.compare(verificationCode, verificationCodeFound.hashedVerificationCode).then(result => {
                                if (result) {
                                    EmailVerificationCode.deleteOne({userId: {$eq: userID}}).then(() => {
                                        if (task == "Verify Email MFA Code") {
                                            const {token, refreshToken, encryptedRefreshToken} = userHandler.generateNewAuthAndRefreshTokens(userFound._id)
            
                                            const newRefreshTokenObject = {
                                                encryptedRefreshToken,
                                                userId: userFound._id,
                                                createdAt: Date.now(),
                                                admin: false
                                            }
    
                                            const formattedIP = HTTPHandler.formatIP(IP)
            
                                            if (userFound?.settings?.loginActivitySettings?.getIP) {
                                                newRefreshTokenObject.IP = formattedIP
                                            }
            
                                            if (userFound?.settings?.loginActivitySettings?.getLocation) {
                                                const location = geoIPLite.lookup(formattedIP)
                                                newRefreshTokenObject.location = location.city + ', ' + location.country
                                            }
            
                                            if (userFound?.settings?.loginActivitySettings?.getDeviceType) {
                                                newRefreshTokenObject.deviceType = deviceType;
                                            }
            
                                            const newRefreshToken = new RefreshToken(newRefreshTokenObject)
            
                                            newRefreshToken.save().then(refreshTokenSaved => {
                                                return resolve(HTTPWTHandler.OK('Signin successful', userHandler.filterUserInformationToSend(userFound), {token: `Bearer ${token}`, refreshToken: `Bearer ${refreshToken}`, refreshTokenId: String(refreshTokenSaved._id)}))
                                            }).catch(error => {
                                                console.error('An error occurred while saving new refresh token. The refresh token object is:', newRefreshTokenObject, 'The error was:', error)
                                                return resolve(HTTPWTHandler.serverError('An error occurred while saving refresh token. Please try again.'))
                                            })
                                        } else {
                                            return resolve(HTTPWTHandler.badInput('Unsupported task sent.'))
                                        }
                                    }).catch(error => {
                                        console.error('An error occurred while deleting one email verification code with userId:', userID, '. The error was:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while deleting used email verification code. Please try again.'))
                                    })
                                } else {
                                    return resolve(HTTPWTHandler.forbidden('Verification code is incorrect.'))
                                }
                            }).catch(error => {
                                console.error('An error occured while comparing a string against its hash. The error was:', error)
                                return resolve(HTTPWTHandler.serverError("An error occurred while comparing verification code against it's hash. Please try again later."))
                            })
                        }).catch(error => {
                            console.error('An error occurred while finding one email verification code with userId:', userFound._id, '. The error was:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while finding email verification code. Please try again.'))
                        })
                    } else {
                        return resolve(HTTPWTHandler.notFound('User not found.'))
                    }
               }).catch(error => {
                    console.error('An error occured while finding user with secondId:', secondId, '. The error was:', error)
                    return resolve(HTTPWTHandler.serverError('An error occurred while finding the user. Please try again.'))
               })
            } else {
                return resolve(HTTPWTHandler.badInput('Provided getAccountMethod is not supported.'))
            }
        })
    }

    static #changepasswordwithverificationcode = (newPassword, confirmNewPassword, verificationCode, username) => {
        return new Promise(resolve => {
            if (typeof newPassword !== 'string') {
                return resolve(HTTPWTHandler.badInput(`newPassword must be a string. Provided type: ${typeof newPassword}`))
            }
        
            if (typeof confirmNewPassword !== 'string') {
                return resolve(HTTPWTHandler.badInput(`confirmNewPassword must be a string. Provided type: ${typeof confirmNewPassword}`))
            }
        
            if (typeof verificationCode !== 'string') {
                return resolve(HTTPWTHandler.badInput(`verificationCode must be a string. Type provided: ${typeof verificationCode}`))
            }
        
            if (typeof username !== 'string') {
                return resolve(HTTPWTHandler.badInput(`username must be a string. Provided type: ${typeof username}`))
            }
        
            newPassword = newPassword.trim()
            confirmNewPassword = confirmNewPassword.trim()
        
            if (newPassword == "" || confirmNewPassword == "") {
                return resolve(HTTPWTHandler.badInput('Empty credentials supplied!'))
            }
            
            if (newPassword !== confirmNewPassword) {
                return resolve(HTTPWTHandler.badInput('Passwords do not match'))
            } 
            
            if (newPassword.length < CONSTANTS.MIN_USER_PASSWORD_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`New password is too short! Password must be at least ${CONSTANTS.MIN_USER_PASSWORD_LENGTH} characters long.`))
            } 
            
            if (newPassword.length > CONSTANTS.MAX_USER_PASSWORD_LENGTH) {
                return resolve(HTTPWTHandler.badInput(`New password is too long! Due to current limitations, your new password must be ${CONSTANTS.MAX_USER_PASSWORD_LENGTH} or less characters long.`))
            }
            
            User.findOne({name: {$eq: username}}).lean().then(userFound => {
                if (userFound) {
                    //User exists
                    const userID = userFound._id.toString();

                    EmailVerificationCode.findOne({userId: userID}).lean().then(verificationCodeFound => {
                        if (!verificationCodeFound) {
                            return resolve(HTTPWTHandler.forbidden('Verification code has expired. Please create a new one.'))
                        }

                        if ((Date.now() - verificationCodeFound.createdAt) / 1000 > CONSTANTS.EMAIL_VERIFICATION_CODE_EXPIRE_TIME_SECONDS)  {
                            return resolve(HTTPWTHandler.forbidden('Verification code has expired. Please create a new one.'))
                        }

                        bcrypt.compare(verificationCode, verificationCodeFound.hashedVerificationCode).then(result => {
                            if (result) {
                                //Verification code is correct
                                EmailVerificationCode.deleteOne({userId: {$eq: userID}}).then(() => {
                                    bcrypt.hash(newPassword, CONSTANTS.EMAIL_VERIFICATION_CODE_SALT_ROUNDS).then(hashedPassword => {
                                        User.findOneAndUpdate({_id: {$eq: userID}}, {password: hashedPassword}).then(() => {
                                            return resolve(HTTPWTHandler.OK('Password changed successfully.'))
                                        }).catch(error => {
                                            console.error('An error occured while updating user with id:', userID, ' to have password:', hashedPassword, '. The error was:', error)
                                            return resolve(HTTPWTHandler.serverError('An error occurred while changing password. Please try again.'))
                                        })
                                    }).catch(error => {
                                        console.error('An error occured while hashing a password:', error)
                                        return resolve(HTTPWTHandler.serverError('An error occurred while hashing the password. Please try again.'))
                                    })
                                }).catch(error => {
                                    console.error('An error occurred while deleting one email verification code with userId:', userID, '. The error was:', error)
                                    return resolve(HTTPWTHandler.serverError('An error occurred while deleting used code. Please try again.'))
                                })
                            } else {
                                return resolve(HTTPWTHandler.forbidden('Verification code is incorrect.'))
                            }
                        }).catch(error => {
                            console.error('An error occured while comparing hashes:', error)
                            return resolve(HTTPWTHandler.serverError('An error occurred while comoaring verificaation to hash. Please try again.'))
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding one email verification code with userId:', userID, '. The error was:', error)
                        return resolve(HTTPWTHandler.serverError('An error occurred while finding email verification code. Please try again.'))
                    })
                } else {
                    return resolve(HTTPWTHandler.notFound('There is no user with that username.'))
                }
            }).catch((error) => {
                console.error('An error occured while finding user with username:', username, '. The error was:', error)
                return resolve(HTTPWTHandler.serverError('An error occurred while finding user. Please try again later.'))
            })
        })
    }

    static signup = async (name, email, password, IP, deviceName) => {
        return await this.#signup(name, email, password, IP, deviceName)
    }
    
    static signin = async (email, password, IP, deviceName) => {
        return await this.#signin(email, password, IP, deviceName)
    }

    static checkusernameavailability = async (name) => {
        return await this.#checkusernameavailability(name)
    }

    static sendemailverificationcode = async (userID, task, getAccountMethod, username, email, secondId) => {
        return await this.#sendemailverificationcode(userID, task, getAccountMethod, username, email, secondId)
    }

    static checkverificationcode = async (username, verificationCode, task, getAccountMethod, userID, email, secondId, IP, deviceType) => {
        return await this.#checkverificationcode(username, verificationCode, task, getAccountMethod, userID, email, secondId, IP, deviceType)
    }

    static changepasswordwithverificationcode = async (newPassword, confirmNewPassword, verificationCode, username) => {
        return await this.#changepasswordwithverificationcode(newPassword, confirmNewPassword, verificationCode, username)
    }
}

module.exports = UserController;