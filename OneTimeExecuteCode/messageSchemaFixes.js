/*
const mongodb = require('mongodb');

//Schemas
const User = require('./../models/User');
const Message = require('./../models/Message');

function messageSchemaFixes() {
    Message.find({senderId: ""}).then(msgsFound => {
        if (msgsFound.length) {
            msgsFound.forEach(function(item, index) {
                Message.findOneAndUpdate({_id: msgsFound[index]._id}, {
                    isServerMessage: true
                }).then(function() {
                    console.log(`Msgs updated.`)
                })
            })
        } else {
            console.log("No msgs?")
        }
    }).catch(err => {
        console.log("Oopsies")
        console.log(err)
    })
}

exports.messageSchemaFixes = messageSchemaFixes
*/