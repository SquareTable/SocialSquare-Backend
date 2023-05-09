/*
const mongodb = require('mongodb');

const { generateTwoDigitDate } = require('./../generateTwoDigitDate')

//Schemas
const User = require('./../models/User');
const Poll = require('./../models/Poll');
const ImagePost = require('./../models/ImagePost');
const Category = require('./../models/Category');
const Thread = require('./../models/Thread')

function addAlgorithmDataArray() {
    User.find({}).then(usersFound => {
        if (usersFound.length) {
            usersFound.forEach(function(item, index) {
                User.findOneAndUpdate({_id: usersFound[index]._id}, {algorithmData: {
                    recommendation: [{"stringVal": "~popular", "val": 1000}],
                    upcomingRecommendation: [],
                    frequentlyPositiveReactions: [{"stringVal": "~following", "val": 600}, {"stringVal": "~none", "val": 400}],//!none just means no specific
                    upcomingFrequentlyPositiveReactions: [],
                    frequentlyNegativeReactions: [],
                    postNegativeReactions: []
                 }}).then(function() {
                    console.log(`algorithmData updated for ${usersFound[index]._id} / ${usersFound[index].name}.`)
                })
            })
        } else {
            console.log("No users?")
        }
    }).catch(err => {
        console.log("Oopsies")
        console.log(err)
    })
}

exports.addAlgorithmDataArray = addAlgorithmDataArray
*/