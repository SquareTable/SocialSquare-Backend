const User = require('./models/User');
const ImagePost = require('./models/ImagePost')
const PopularPosts = require('./models/PopularPosts')
const { generateTwoDigitDate } = require('./generateTwoDigitDate')

const hoursPerRefresh = 1;

function decidePopularPosts(callback) {
    const now = new Date();
    const last24hours = now.getTime() - (24 * 60 * 60 * 1000);

    ImagePost.aggregate([
        {
            $lookup: {
                from: 'upvotes',
                let: { postId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$postId', '$$postId'] },
                                    { $gte: ['$interactionDate', last24hours] }
                                ]
                            }
                        }
                    }
                ],
                as: 'upvotes'
            }
        },
        {
            $lookup: {
                from: 'downvotes',
                let: { postId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$postId', '$$postId'] },
                                    { $gte: ['$interactionDate', last24hours] }
                                ]
                            }
                        }
                    }
                ],
                as: 'downvotes'
            }
        },
        {
            $addFields: {
                upvotes: {
                    $size: '$upvotes'
                },
                downvotes: {
                    $size: '$downvotes'
                },
                score: {
                    $subtract: [
                        {$size: '$upvotes'},
                        {$size: '$downvotes'}
                    ]
                }
            }
        },
        {
            $sort: {
                score: -1
            }
        },
        {
            $limit: 100
        },
        {
            $project: {
                upvotes: 0,
                downvotes: 0,
                score: 0
            }
        }
    ]).then(posts => {
        console.log('Popular Posts:', posts)
        callback(posts)
    }).catch(error => {
        console.error('An error occured whil getting popular posts')
        console.error(error)
    })
}

function popularPostHandler() {
    try {
        var dateNow = Date.now()
        PopularPosts.findOne({}, {lastUpdated: 1}).then(popularPosts => {
            if (popularPosts) {
                var hoursDiff = Math.floor((dateNow-popularPosts.lastUpdated)/3600000)
                console.log("hourDiff: " + hoursDiff)
                if (hoursDiff >= hoursPerRefresh) {
                    decidePopularPosts(function(decidedPosts) {
                        PopularPosts.findOneAndUpdate({}, {lastUpdated: dateNow, popularPosts: decidedPosts}).then(() => {
                            console.log("Updated popular posts.");
                            return "SUCCESS"; // this might not return where I want it to
                        }).catch(err => {
                            console.log("Error while updating popular posts.");
                            console.log(err)
                            return "FAILED"; // this might not return where I want it to
                        })
                    })
                }
            } else {
                console.log("Couldn't find popular posts?");
                decidePopularPosts(function(decidedPosts) {
                    updatePosts = new PopularPosts({lastUpdated: dateNow, popularPosts: decidedPosts})
                    updatePosts.save().then(results => {
                        console.log("Updated popular posts.");
                        return "SUCCESS"; // this might not return where I want it to
                    }).catch(err => {
                        console.log("Error while updating popular posts.");
                        console.log(err)
                        return "FAILED"; // this might not return where I want it to
                    })
                })
            }
        }).catch(err => {
            console.log("Error finding popularPost document.");
            console.log(err);
            return "FAILED";
        })
    } catch (err) {
        console.log("Error in popular post handler");
        console.log(err);
        return "FAILED";
    }
}

exports.popularPostHandler = popularPostHandler;
