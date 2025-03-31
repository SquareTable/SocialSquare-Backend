const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const refreshTokenEncryptionKey = process.env.REFRESH_TOKEN_ENCRYPTION_KEY
const IV_LENGTH = 16; // 16 for AES (this is the cryptographic nonce pretty much)

function generateAuthJWT(toSign) { //to sign should be something like a user name or user id
    return jwt.sign({_id: toSign}, process.env.SECRET_FOR_TOKENS, {expiresIn: 60}) //900s is 15 minutes
}

// mongodb user model
const User = require('./../models/User');

const Admin = require('../models/Admin');

const RefreshToken = require('../models/RefreshToken');

function refreshTokenEncryption(refreshToken) {
    let iv = crypto.randomBytes(IV_LENGTH);// make nonce
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(refreshTokenEncryptionKey), iv); // create a unique cipher with the iv/nonce
    let encrypted = cipher.update(refreshToken); // encrypt token with said cypher
   
    encrypted = Buffer.concat([encrypted, cipher.final()]);
   
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

exports.refreshTokenEncryption = refreshTokenEncryption;

function refreshTokenDecryption(refreshToken) {
    let splitUpEncryptedString = refreshToken.split(':'); // because the nonce/iv is in front
    let iv = Buffer.from(splitUpEncryptedString.shift(), 'hex');
    let encryptedText = Buffer.from(splitUpEncryptedString.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(refreshTokenEncryptionKey), iv);
    let decrypted = decipher.update(encryptedText);
       
    decrypted = Buffer.concat([decrypted, decipher.final()]);
       
    return decrypted.toString(); 
}

exports.refreshTokenDecryption = refreshTokenDecryption;

function generateNewAuthToken(res, refreshToken) {
    jwt.verify(refreshToken, process.env.SECRET_FOR_REFRESH_TOKENS, (err, decoded) => {
        if (err) {
            console.log("Refresh Failed")
            console.log("Issue with refresh token may be incorrect or expired.")
            res.status(403).json({message: "Issue with refresh token may be incorrect or expired.", logout: true});
        } else {
            console.log(decoded)
            if (decoded.accountType == 'admin') {
                Admin.findOne({_id: decoded._id}).lean().then(adminFoundWithTokensId => {
                    if (adminFoundWithTokensId) {
                        RefreshToken.find({admin: true, userId: decoded._id}).lean().then(encryptedTokens => {
                            const validTokenFound = () => {
                                console.log("Refresh token matches generating new auth token.")
                                const token = generateAuthJWT(adminFoundWithTokensId._id);
                                res.status(403).json({
                                    message: "Token generated.",
                                    token: `Bearer ${token}`,
                                    userId: adminFoundWithTokensId._id
                                })
                            }
        
                            //check if token is a valid refresh token
                            for (let i = 0; i < encryptedTokens.length; i++) {
                                let decryptedToken = refreshTokenDecryption(encryptedTokens[i].encryptedRefreshToken)
                                if (decryptedToken == refreshToken) {
                                    return validTokenFound()
                                }
                            }
        
                            // only would happen if all done and none matched
                            console.log("Refresh Failed")
                            console.log("Refresh token didn't match valid ones.")
                            res.status(403).json({message: "Refresh token didn't match valid ones.", logout: true})
                        }).catch(error => {
                            console.error('An error occurred while finding all refresh tokens with admin set to true and userId:', decoded._id, '. The error was:', error)
                            res.status(500).json({message: "Error finding refresh tokens with token provided."})
                        })
                    } else {
                        console.log("Refresh Failed")
                        console.log("Couldn't find admin with token provided.")
                        res.status(403).json({message: "Couldn't find admin with token provided.", logout: true})
                    }
                }).catch(err => {
                    console.log(`Error occured when finding admin with the token: ${err}`)
                    console.log("Refresh Failed")
                    console.log("Error finding admin with token provided.")
                    res.status(500).json({message: "Error finding admin with token provided."})
                })
            } else {
                User.findOne({_id: decoded._id}).lean().then(userFoundWithTokensId => {
                    if (userFoundWithTokensId) {
                        RefreshToken.find({admin: false, userId: decoded._id}).lean().then(encryptedTokens => {
                            const validTokenFound = () => {
                                console.log("Refresh token matches generating new auth token.")
                                const token = generateAuthJWT(userFoundWithTokensId._id);
                                res.status(403).json({
                                    message: "Token generated.",
                                    token: `Bearer ${token}`,
                                    userId: userFoundWithTokensId._id
                                })
                            }
                            //check if token is a valid refresh token
                            for (let i = 0; i < encryptedTokens.length; i++) {
                                let decryptedToken = refreshTokenDecryption(encryptedTokens[i].encryptedRefreshToken)
                                if (decryptedToken == refreshToken) {
                                    return validTokenFound()
                                }
                            }
    
                            // only would happen if all done and none matched
                            console.log("Refresh Failed")
                            console.log("Refresh token didn't match valid ones.")
                            res.status(403).json({message: "Refresh token didn't match valid ones.", logout: true})
                        }).catch(error => {
                            console.error('An error occurred while finding all refresh tokens with admin set to false and userId:', decoded._id, '. The error was:', error)
                            res.status(500).json({message: "An error occurred while finding refresh tokens to reauthenticate user. Please try again."})
                        })
                    } else {
                        console.log("Refresh Failed")
                        console.log("Couldn't find user with token provided.")
                        res.status(403).json({message: "Couldn't find user with token provided.", logout: true})
                    }
                }).catch(err => {
                    console.log(`Error occured when finding user with the token: ${err}`)
                    console.log("Refresh Failed")
                    console.log("Error finding user with token provided.")
                    res.status(500).json({message: "An error occurred while finding user to authenticate. Please try again."})
                })
            }
        }
    })
}

function tokenValidation(req, res, next) {
    console.log("req.headers")
    console.log(JSON.stringify(req.headers))
    const authHeader = req.headers["auth-web-token"];
    const refreshHeader = req.headers["auth-refresh-token"];
    const token = authHeader && authHeader.split(" ")[1];
    const refreshToken = refreshHeader && refreshHeader.split(" ")[1];
    console.log(token)

    if (token == null) return res.status(403).json({logout: true});

    jwt.verify(token, process.env.SECRET_FOR_TOKENS, (err, decoded) => {
        if (err) {
            //Invalid jwt attempt refresh
            generateNewAuthToken(res, refreshToken)
        } else {
            req.tokenData = decoded._id;
            next();
        }
    })
    //next();
}

exports.tokenValidation = tokenValidation;