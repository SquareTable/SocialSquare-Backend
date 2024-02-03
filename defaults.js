const DEFAULTS = {
    userFollowingFeedFilterSettings: {
        showImagePosts: true,
        showPolls: true,
        showTextThreads: true,
        showImageThreads: true
    },
    userNotificationSettings: {
        GainsFollower: true,
        FollowRequests: true,
        SendGainsFollower: true,
        SendFollowRequests: true
    },
    validReportOptions: {Content: ["Spam", "Nudity/Sexual", "Don't Like", "Hate", "SelfHarm", "Illegal/Regulated goods", "Violence/Dangerous", "Bullying/Harassment", "Intellectual property violation", "Scam/Fraud", "False Info"], Age: ["Underage"], Impersonation: ["Of Reporter", "Of Someone Reporter Knows", "Celebrity/Public", "Business/Organisation"]},
    userAlgorithmSettings: {
        enabled: false,
        useUserUpvoteData: false,
        useUserDownvoteData: false,
        useUserFollowingData: false
    },
    userPrivacySettings: {
        viewFollowers: 'followers', //Options are: 'no-one', 'followers', 'everyone'
        viewFollowing: 'followers', //Options are 'no-one', 'followers', 'everyone',
        showBadges: 'everyone' //Options are 'no-one', 'followers', 'everyone',
    },
    userLoginActivitySettings: {
        getIP: false,
        getDeviceType: false,
        getLocation: false
    }
}

module.exports = DEFAULTS;