/*
const mongodb = require('mongodb');

const { generateTwoDigitDate } = require('./../generateTwoDigitDate')

//Schemas
const User = require('./../models/User');
const Poll = require('./../models/Poll');
const ImagePost = require('./../models/ImagePost');
const Category = require('./../models/Category');
const Thread = require('./../models/Thread')

// Get the objectID type
var ObjectID = require('mongodb').ObjectID;

const randomTags = ["test", "socialsquare", "testingtags", "testingalgorithm", "howfun"] //tags should be lowered when stored in db, in desc as technically it is the visual aspect of the tags it doenst matter there but does here.

function testTagsAdder() {
    ImagePost.find({}).then(imagePosts => {
        if (imagePosts.length) {
            imagePosts.forEach(function(item, index) {
                const randomChoice = randomTags[Math.floor(Math.random() * randomTags.length)]
                ImagePost.findOneAndUpdate({_id: imagePosts[index]._id}, {$push: { tags: randomChoice }}).then(function() {
                    console.log(`image interactions updated for ${imagePosts[index]._id} / ${imagePosts[index].imageTitle}.`)
                })
            })
        } else {
            console.log("No imageposts?")
        }
    }).catch(err => {
        console.log("Oopsies")
        console.log(err)
    })
}

exports.testTagsAdder = testTagsAdder
*/