//Schemas
const User = require('./../models/User');
const ImagePost = require('./../models/ImagePost');
const Category = require('./../models/Category');
const Thread = require('./../models/Thread');
const Conversation = require('../models/Conversation');

const fs = require('fs')

class Files {
    constructor() {
        this.imageKeys = []
    }

    addKeys(keys) {
        console.log('Adding keys')
        this.imageKeys = [...this.imageKeys, ...keys]
    }

    returnKeys() {
        return this.imageKeys
    }
}

function DeleteImagesNotFoundInDatabase() {
    const files = new Files()
    User.find({}).then(result => {
        files.addKeys(result.filter(x => x.profileImageKey !== '').map(x => x.profileImageKey))
        ImagePost.find({}).then(result => {
            files.addKeys(result.filter(x => x.imageKey !== '').map(x => x.imageKey))
            Category.find({}).then(result => {
                files.addKeys(result.filter(x => x.imageKey !== '').map(x => x.imageKey))
                Thread.find({}).then(result => {
                    files.addKeys(result.filter(x => x.threadImageKey !== '').map(x => x.threadImageKey))
                    Conversation.find({}).then(result => {
                        files.addKeys(result.filter(x => x.conversationImageKey !== '').map(x => x.conversationImageKey))
                        const imageFiles = fs.readdirSync(process.env.UPLOADED_PATH)
                        const imagesNotInDatabase = imageFiles.filter(x => !files.returnKeys().includes(x))
                        console.log('Number of images not in database:', imagesNotInDatabase.length)
                        console.log('Images to delete:', imagesNotInDatabase)
                        imagesNotInDatabase.forEach((image, index) => {
                            fs.unlinkSync(process.env.UPLOADED_PATH + '/' + image)
                            console.log('Deleted image #' + index)
                        })
                    }).catch(error => {
                        console.error('Whoops:', error)
                    })
                }).catch(error => {
                    console.error('Whoops:', error)
                })
            }).catch(error => {
                console.error('Whoops:', error)
            })
        }).catch(error => {
            console.error('Whoops:', error)
        })
    }).catch(error => {
        console.error('Whoops:', error)
    })
}

exports.DeleteImagesNotFoundInDatabase = DeleteImagesNotFoundInDatabase