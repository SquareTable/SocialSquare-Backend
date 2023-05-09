//Schemas
const User = require('./../models/User');
const ImagePost = require('./../models/ImagePost');
const Category = require('./../models/Category');
const Thread = require('./../models/Thread');
const Conversation = require('../models/Conversation');

const path = require('path')

function ChangeImagesToJpg() {
    console.log('CHANGING ALL IMAGE KEYS')
    User.find({}).then(result => {
        const filteredResult = result.filter(x => x.profileImageKey.split('.')[1] !== 'jpg' && x.profileImageKey !== '')
        console.log(filteredResult)
        const newKeys = filteredResult.map(item => {
            const oldKey = item.profileImageKey.split('.')[0];
            const newKey = oldKey + '.jpg';
            return newKey
        })
        Promise.allSettled(
            filteredResult.map((item, index) => (
                User.findOneAndUpdate({_id: item._id}, {profileImageKey: newKeys[index]})
            ))
        ).then(result => {
            const filteredResult = result.filter(x => x.status == 'rejected')
            if (filteredResult.length == 0) {
                console.log('Updated all profile image keys without any error!')
            } else {
                console.log('Errors updating profile image keys:', filteredResult)
            }
        })
    }).catch(error => {
        console.error('Whoops:', error)
    })

    ImagePost.find({}).then(result => {
        const filteredResult = result.filter(x => x.imageKey.split('.')[1] !== 'jpg' && x.imageKey !== '')
        const newKeys = filteredResult.map(item => {
            const oldKey = item.imageKey.split('.')[0];
            const newKey = oldKey + '.jpg';
            return newKey
        })
        Promise.allSettled(
            filteredResult.map((item, index) => (
                ImagePost.findOneAndUpdate({_id: item._id}, {imageKey: newKeys[index]})
            ))
        ).then(result => {
            const filteredResult = result.filter(x => x.status == 'rejected')
            if (filteredResult.length == 0) {
                console.log('Updated all image post image keys without any error!')
            } else {
                console.log('Errors updating image post image keys:', filteredResult)
            }
        })
    }).catch(error => {
        console.error('Whoopsies:', error)
    })

    Category.find({}).then(result => {
        const filteredResult = result.filter(x => x.imageKey.split('.')[1] !== 'jpg' && x.imageKey !== '')
        const newKeys = filteredResult.map(item => {
            const oldKey = item.imageKey.split('.')[0];
            const newKey = oldKey + '.jpg';
            return newKey
        })
        Promise.allSettled(
            filteredResult.map((item, index) => (
                Category.findOneAndUpdate({_id: item._id}, {imageKey: newKeys[index]})
            ))
        ).then(result => {
            const filteredResult = result.filter(x => x.status == 'rejected')
            if (filteredResult.length == 0) {
                console.log('Updated all category image keys without any error!')
            } else {
                console.log('Errors updating category image keys:', filteredResult)
            }
        })
    })

    Thread.find({}).then(result => {
        const filteredResult = result.filter(x => x.threadImageKey.split('.')[1] !== 'jpg' && x.threadImageKey !== '')
        const newKeys = filteredResult.map(item => {
            const oldKey = item.threadImageKey.split('.')[0];
            const newKey = oldKey + '.jpg';
            return newKey
        })
        Promise.allSettled(
            filteredResult.map((item, index) => (
                Thread.findOneAndUpdate({_id: item._id}, {threadImageKey: newKeys[index]})
            ))
        ).then(result => {
            const filteredResult = result.filter(x => x.status == 'rejected')
            if (filteredResult.length == 0) {
                console.log('Updated all image thread image keys without any error!')
            } else {
                console.log('Errors updating image thread image keys:', filteredResult)
            }
        })
    })

    Conversation.find({}).then(result => {
        const filteredResult = result.filter(x => x.conversationImageKey.split('.')[1] !== 'jpg' && x.conversationImageKey !== '')
        const newKeys = filteredResult.map(item => {
            const oldKey = item.conversationImageKey.split('.')[0];
            const newKey = oldKey + '.jpg';
            return newKey
        })
        Promise.allSettled(
            filteredResult.map((item, index) => (
                Conversation.findOneAndUpdate({_id: item._id}, {conversationImageKey: newKeys[index]})
            ))
        ).then(result => {
            const filteredResult = result.filter(x => x.status == 'rejected')
            if (filteredResult.length == 0) {
                console.log('Updated all conversation image keys without any error!')
            } else {
                console.log('Errors updating conversation image keys:', filteredResult)
            }
        })
    })
}

exports.ChangeImagesToJpg = ChangeImagesToJpg