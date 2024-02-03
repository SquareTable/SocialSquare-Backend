const mongoose = require('mongoose');
const DEFAULTS = require('../defaults');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    secondId: String,
    name: {type: String, unique: true},
    displayName: String,
    email: String,
    password: String,
    badges: Array,
    followers: Array,
    following: Array,
    totalLikes: {type: Number, default: 0},
    status: String,
    profileImageKey: String,
    notificationKeys: Array,
    refreshTokens: Array,
    bio: String,
    privateAccount: {type: Boolean, default: false},
    accountFollowRequests: Array,
    blockedAccounts: Array,
    authenticationFactorsEnabled: {type: Array, default: []},
    MFAEmail: String,
    settings: {type: Object, default: {
        notificationSettings: {
            GainsFollower: true,
            FollowRequests: true,
            SendGainsFollower: true,
            SendFollowRequests: true
        },
        algorithmSettings: DEFAULTS.userAlgorithmSettings,
        privacySettings: {
            viewFollowers: 'followers', //Options are 'no-one', 'followers', and 'everyone'
            viewFollowing: 'followers', //Options are 'no-one', 'followers', and 'everyone',
            showBadges: 'everyone' //Options are 'no-one', 'followers', and 'everyone',
        },
        loginActivitySettings: {
            getIP: false,
            getDeviceType: false,
            getLocation: false
        },
        followingFeedFilterSettings: DEFAULTS.userFollowingFeedFilterSettings
    }},
    algorithmData: {
        recommendation: {type: Array, default: [{"stringVal": "~popular", "val": 1000}]},
        upcomingRecommendation: Array,
        frequentlyPositiveReactions: {type: Array, default: [{"stringVal": "~following", "val": 400}, {"stringVal": "~none", "val": 600}]},
        upcomingFrequentlyPositiveReactions: Array,
        frequentlyNegativeReactions: Array,
        postNegativeReactions: Array
    },
});

const User = mongoose.model('User', UserSchema);

module.exports = User;