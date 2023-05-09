const path = require('path')
const sharp = require('sharp')
const { v4: uuidv4 } = require('uuid');
const fs = require('fs')
const sanitizeFilename = require('sanitize-filename');
const CONSTANTS = require('../constants');

class Image {
    compressImage(filename) {
        return new Promise((resolve, reject) => {
            if (typeof filename == 'string') {

                const sanitizedFilename = sanitizeFilename(filename)
                const sanitizedFilepath = path.resolve(CONSTANTS.MULTER_UPLOAD_DIR, sanitizedFilename)

                const newUUID = uuidv4();
                const newFileName = newUUID + '.jpg'
                const newPath = process.env.UPLOADED_PATH + '/' + newFileName
                console.log('Compressing image with original path:', sanitizedFilepath)
                console.log('New filepath is:', newPath)
                sharp(sanitizedFilepath).rotate().resize({width: 1000, height: 1000}).toFormat('jpg').jpeg({ quality: 30, mozjpeg: true }).toFile(newPath).then(() => {
                    fs.unlink(sanitizedFilepath, (err) => {
                        if (err) {
                            console.error('An error occured while deleting image with filepath:', filepath)
                            console.error('The error was:', err)
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
        The difference between deleteImage and deleteImagePromise is this:
        deleteImage is to be used if you DO NOT care if the image was deleted successfully or not
        If you need to know if the image was actually deleted or not, use deleteImagePromise
    */

    deleteImage(filepath) {
        filepath = sanitizeFilename(filepath)
        fs.unlink(filepath, (err) => {
            if (err) {
                console.error('An error occured while deleting image with filepath:', filepath)
                console.error('The error was:', err)
            }
        })
    }

    deleteImagePromise(filepath) {
        filepath = sanitizeFilename(filepath)
        return new Promise((resolve, reject) => {
            fs.unlink(filepath, (err) => {
                if (err) reject(err)
                else resolve()
            })
        })
    }

    deleteImageByKey(key) {
        const filepath = process.env.UPLOAD_PATH + '/' + sanitizeFilename(key)
        fs.unlink(filepath, (err) => {
            if (err) {
                console.error('An error occured while deleting image with key:', key, ' and filepath:', filepath)
                console.error('The error was:', err)
            }
        })
    }

    deleteImagePromiseByKey(key) {
        const filepath = process.env.UPLOAD_PATH + '/' + sanitizeFilename(key)
        return new Promise((resolve, reject) => {
            fs.unlink(filepath, (err) => {
                if (err) reject(err)
                else resolve()
            })
        })
    }
}

module.exports = Image;