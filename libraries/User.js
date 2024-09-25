const jwt = require('jsonwebtoken')
const { tokenValidation, refreshTokenEncryption, refreshTokenDecryption } = require("../middleware/TokenHandler");

class User {
    #generateAuthJWT(toSign) {
        return jwt.sign({_id: toSign}, process.env.SECRET_FOR_TOKENS, {expiresIn: 30}) //30s
    }

    #generateRefreshToken(toSign) {
        return jwt.sign({_id: toSign}, process.env.SECRET_FOR_REFRESH_TOKENS, {expiresIn: 900}) //900s is 15 minutes
    }

    filterUserInformationToSend(userObject) {
        if (userObject === null) {
            throw new Error('userObject is null. userObject must be an object')
        }

        if (Array.isArray(userObject)) {
            throw new Error('userObject is an array. userObject must be an object')
        }

        if (typeof userObject !== 'object') {
            throw new Error('userObject is ' + typeof userObject + '. userObject must be an object.')
        }

        const notIncludedKeys = [
            'notificationKeys',
            'password',
            'refreshTokens',
            'algorithmData',
            'accountFollowRequests',
            'blockedAccounts',
            'authenticationFactorsEnabled',
            'MFAEmail',
            'followers',
            'following',
            '__v',
            '_id',
            'totalLikes',
            'settings'
        ]

        const followers = userObject.followers.length;
        const following = userObject.following.length;

        console.log('Followers length:', followers, '   |   Followers Type:', typeof followers)

        notIncludedKeys.forEach(x => delete userObject[x])

        userObject.followers = followers
        userObject.following = following

        userObject._id = userObject._id.toString()

        return userObject;
    }

    returnPublicInformation(userObject, requestingUserObject) {
        if (userObject === null) {
            throw new Error('userObject is null. userObject must be an object')
        }

        if (Array.isArray(userObject)) {
            throw new Error('userObject is an array. userObject must be an object')
        }

        if (typeof userObject !== 'object') {
            throw new Error('userObject is ' + typeof userObject + '. userObject must be an object.')
        }

        if (requestingUserObject === null) {
            throw new Error('requestingUserObject is null. requestingUserObject must be an object')
        }

        if (Array.isArray(requestingUserObject)) {
            throw new Error('requestingUserObject is an array. requestingUserObject must be an object')
        }

        if (typeof requestingUserObject !== 'object') {
            throw new Error('requestingUserObject is ' + typeof requestingUserObject + '. requestingUserObject must be an object.')
        }

        const isFollowing = userObject.followers.includes(requestingUserObject.secondId)

        return {
            displayName: userObject.displayName,
            name: userObject.name,
            profileImageKey: userObject.profileImageKey,
            pubId: userObject.secondId,
            privateAccount: typeof userObject.privateAccount === 'boolean' ? userObject.privateAccount : false,
            badges: userObject.secondId === requestingUserObject.secondId ? userObject.badges : userObject?.settings?.privacySettings?.showBadges === 'no-one' ? [] : userObject?.settings?.privacySettings?.showBadges === 'everyone' ? userObject.badges : isFollowing ? userObject.badges : [],
            followers: userObject.followers.length,
            following: userObject.following.length,
            totalLikes: userObject.totalLikes,
            profileKey: userObject.profileImageKey,
            bio: userObject.bio
        };
    }

    generateNewAuthAndRefreshTokens(userId) {
        const token = this.#generateAuthJWT(userId);
        const refreshToken = this.#generateRefreshToken(userId);
        const encryptedRefreshToken = refreshTokenEncryption(refreshToken)

        return {token, refreshToken, encryptedRefreshToken}
    }
}

module.exports = User;