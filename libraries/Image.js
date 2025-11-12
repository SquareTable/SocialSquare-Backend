const path = require('path')
const sharp = require('sharp')
const crypto = require('crypto')
const fs = require('fs')
const sanitizeFilename = require('sanitize-filename');
const CONSTANTS = require('../constants');

class Image {
    compressImage(filename) {
        return new Promise((resolve, reject) => {
            if (typeof filename == 'string') {

                const sanitizedFilename = sanitizeFilename(filename)
                const sanitizedFilepath = path.resolve(process.env.TEMP_IMAGES_PATH, sanitizedFilename)

                const newUUID = crypto.randomUUID();
                const newFileName = newUUID + '.jpg'
                const newPath = process.env.UPLOADED_PATH + '/' + newFileName
                console.log('Compressing image with original path:', sanitizedFilepath)
                console.log('New filepath is:', newPath)
                sharp(sanitizedFilepath).rotate().resize({width: 1000, height: 1000}).toFormat('jpg').jpeg({ quality: 30, mozjpeg: true }).toFile(newPath).then(() => {
                    fs.unlink(sanitizedFilepath, (err) => {
                        if (err) {
                            console.error('An error occured while deleting image with filepath:', filepath, '. The error was:', err)
                        }
                        console.log('Successfully compressed image')
                        resolve(newFileName)
                    })
                }).catch(error => {
                    reject(error)
                })
            } else {
                reject('Image path must be provided.')
            }
        })
    }

    /*
        The difference between deleteImageByKey and deleteImageByKeyPromise is this:
        deleteImage is to be used if you DO NOT care if the image was deleted successfully or not
        If you need to know if the image was actually deleted or not, use deleteImagePromise
    */

    deleteImageByKey(key, notTemp) {
        const filepath = (notTemp ? process.env.UPLOADED_PATH : process.env.TEMP_IMAGES_PATH) + '/' + sanitizeFilename(key)
        fs.unlink(filepath, (err) => {
            if (err) {
                console.error('An error occured while deleting image with key:', key, ' and filepath:', filepath, '. The error was:', err)
            }
        })
    }

    deleteImagePromiseByKey(key, notTemp) {
        const filepath = (notTemp ? process.env.UPLOADED_PATH : process.env.TEMP_IMAGES_PATH) + '/' + sanitizeFilename(key)
        return new Promise((resolve, reject) => {
            fs.unlink(filepath, (err) => {
                if (err) reject(err)
                else resolve()
            })
        })
    }


    deleteMulterTempImage(filename, returnPromise = false) {
        const sanitizedFilename = sanitizeFilename(filename)
        const filepath = process.env.TEMP_IMAGES_PATH + '/' + sanitizedFilename

        if (returnPromise === true) {
            return new Promise((resolve, reject) => {
                fs.unlink(filepath, (err) => {
                    if (err) reject(err)
                    else resolve()
                })
            })
        }

        fs.unlink(filepath, (err) => {
            if (err) console.error('An error occurred while deleting MulterTempImage with filepath:', filepath, '. The error was:', err)
        })
    }
}

module.exports = Image;