const Poll = require("../models/Poll");
const PollVote = require("../models/PollVote");

let dbOperations = [];
let pollCount = 0;

Poll.find({}).lean().then(polls => {
    pollCount = polls.length;
    for (const poll of polls) {
        for (const vote of poll.optionOnesVotes) {
            const newVote = new PollVote({
                pollId: poll._id,
                userId: vote,
                vote: "One",
                dateVoted: Date.now()
            })
            dbOperations.push(newVote.save())
        }
        for (const vote of poll.optionTwosVotes) {
            const newVote = new PollVote({
                pollId: poll._id,
                userId: vote,
                vote: "Two",
                dateVoted: Date.now()
            })
            dbOperations.push(newVote.save())
        }
        for (const vote of poll.optionThreesVotes) {
            const newVote = new PollVote({
                pollId: poll._id,
                userId: vote,
                vote: "Three",
                dateVoted: Date.now()
            })
            dbOperations.push(newVote.save())
        }
        for (const vote of poll.optionFoursVotes) {
            const newVote = new PollVote({
                pollId: poll._id,
                userId: vote,
                vote: "Four",
                dateVoted: Date.now()
            })
            dbOperations.push(newVote.save())
        }
        for (const vote of poll.optionFivesVotes) {
            const newVote = new PollVote({
                pollId: poll._id,
                userId: vote,
                vote: "Five",
                dateVoted: Date.now()
            })
            dbOperations.push(newVote.save())
        }
        for (const vote of poll.optionSixesVotes) {
            const newVote = new PollVote({
                pollId: poll._id,
                userId: vote,
                vote: "Six",
                dateVoted: Date.now()
            })
            dbOperations.push(newVote.save())
        }
    }

    console.log('Making', dbOperations.length, 'database operations to move poll votes from within the poll document to a dedicated PollVote collection.')

    Promise.allSettled(dbOperations).then(results => {
        const errors = results.filter(result => result.status === 'rejected')
        console.log(`${dbOperations.length - errors.length}/${dbOperations.length} operations were successful. There were ${errors.length} errors.`)
        console.log('List of errors:', errors)
    }).then(() => {
        Poll.updateMany({}, {$unset: {optionOnesVotes: "", optionTwosVotes: "", optionThreesVotes: "", optionFoursVotes: "", optionFivesVotes: "", optionSixesVotes: ""}}).then(() => {
            console.log(`Successfully removed all votes arrays from all ${pollCount} poll documents!`)
        }).catch(error => {
            console.error('An error occurred while removing all vote arrays from all polls:', error)
        })
    })
}).catch(error => {
    console.error('An error occurred while getting all polls from SocialSquare. The error was:', error)
})