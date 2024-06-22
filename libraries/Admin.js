const Admin = require('../models/Admin')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const AccountReports = require('../models/AccountReports')
const PostReports = require('../models/PostReports')
const ImagePost = require('../models/ImagePost')
const Poll = require('../models/Poll')
const Thread = require('../models/Thread')
const ImagePostLibrary = require('./ImagePost')
const imagePostLib = new ImagePostLibrary()
const User = require('../models/User')
const fs = require('fs')
const PollPostLibrary = require('./PollPost')
const pollPostLib = new PollPostLibrary()
const ThreadPostLibrary = require('./ThreadPost')
const threadPostLib = new ThreadPostLibrary()
const path = require('path')

const { tokenValidation, refreshTokenEncryption, refreshTokenDecryption } = require("../middleware/TokenHandler");

const { blurEmailFunction, mailTransporter } = require('../globalFunctions.js')

class AdminClass {
    #generateAuthJWT(toSign) {
        //to sign should be something like a user name or user id
        return jwt.sign({_id: toSign, accountType: 'admin'}, process.env.SECRET_FOR_TOKENS, {expiresIn: 30}) //30 seconds
    }

    #generateRefreshToken(toSign) {
        return jwt.sign({_id: toSign, accountType: 'admin'}, process.env.SECRET_FOR_REFRESH_TOKENS, {expiresIn: 900}) //900s is 15 minutes
    }

    #filterAdminInformationToSend(adminObject) {
        return {
            name: adminObject.name,
            email: adminObject.email
        }
    }

    #findOneAdminByEmail(email) {
        return Admin.findOne({email: {$eq: email}}).lean()
    }

    #findOneAdminById(id) {
        return Admin.findOne({_id: {$eq: id}}).lean()
    }

    #getAssignedPostReportsByAdminId(id) {
        return new Promise((resolve, reject) => {
            PostReports.find({assignedTo: {$eq: id}}).lean().then(reports => {
                Promise.all(
                    reports.map(report => {
                        if (report.format == 'Image') {
                            return ImagePost.findOne({_id: {$eq: report.postId}}).lean()
                        } else if (report.format == 'Poll') {
                            return Poll.findOne({_id: {$eq: report.postId}}).lean()
                        } else if (report.format == 'Thread') {
                            return Thread.findOne({_id: {$eq: report.postId}}).lean()
                        }
                    })
                ).then(posts => {
                    const toSend = posts.map((post, index) => {
                        const report = reports[index]
                        delete report.assignedTo;
                        return {
                            ...report,
                            post,
                            reportType: 'post'
                        }
                    })
                    resolve(toSend)
                }).catch(reject)
            }).catch(reject)
        })
    }

    #getAssignedAccountReportsByAdminId(id) {
        return new Promise((resolve, reject) => {
            AccountReports.find({assignedTo: {$eq: id}}).lean().then(reports => {
                const toSend = reports.map(report => {
                    delete report.assignedTo;
                    return {
                        ...report,
                        reportType: 'account'
                    }
                })
                resolve(toSend)
            }).catch(reject)
        })
    }

    #getAssignedReportsByAdminId(id) {
        return new Promise((resolve, reject) => {
            Promise.all([
                this.#getAssignedPostReportsByAdminId(id),
                this.#getAssignedAccountReportsByAdminId(id)
            ]).then(([postReports, accountReports]) => {
                resolve([...postReports, ...accountReports])
            }).catch(reject)
        })
    }

    #deletePostReport(id) {
        return PostReports.deleteOne({_id: {$eq: id}})
    }

    #sendEmail(emailData) {
        return new Promise((resolve, reject) => {
            mailTransporter.sendMail(emailData, function(error, response) {
                if (error) {
                    console.error('An error occured while sending an email to user with email: ' + emailData.email)
                    console.error('The error was:', error)
                    reject('An error occured while sending email: ' + error)
                } else {
                    resolve()
                }
            })
        })
    }

    #findOnePostReportById(reportId) {
        return PostReports.findOne({_id: {$eq: reportId}}).lean()
    }

    #deleteImagePostAndReport(report) {
        return new Promise((resolve, reject) => {
            ImagePost.findOne({_id: {$eq: report.postId}}).lean().then(postData => {
                if (postData) {
                    User.findOne({_id: {$eq: postData.creatorId}}).lean().then(creator => {
                        let postTags = ''
                        try {
                            postTags = postData.tags.join(', ')
                        } catch {}
                        var emailData = {
                            from: process.env.SMTP_EMAIL,
                            to: creator.email,
                            subject: "Image post removed",
                            text: `Someone reported your post for "${report.reason}". SocialSquare staff have looked at the report and your post, and have found your post to not be fit to be on SocialSquare, and as such this post has been removed from SocialSquare. The image attached to your image post has been attached to this email.\n Post Title: "${postData.imageTitle}"\n Post Description: "${postData.imageDescription}"\n Tags: "${postTags}"`,
                            attachments: [{   // stream as an attachment
                                filename: 'image.jpg',
                                content: fs.createReadStream(path.resolve(process.env.UPLOADED_PATH, postData.imageKey))
                            }]
                        };

                        this.#sendEmail(emailData).then(() => {
                            imagePostLib.deleteOneImagePostById(postData._id, false).then(() => {
                                this.#deletePostReport(report._id).then(() => {
                                    resolve()
                                }).catch(error => {
                                    console.error('An error occured while deleting post report with id:', report._id)
                                    console.error('The error was:', error)
                                    reject('An error occured while deleting post report: ' + error)
                                })
                            }).catch(error => reject(error))
                        }).catch(error => {
                            reject(error)
                        })
                    }).catch(error => {
                        console.error('An error occured while finding user with id:', postData.creatorId)
                        console.error('The error was:', error)
                        reject('An error occured while finding post creator: ' + error)
                    })
                } else {
                    this.#deletePostReport(report._id).then(() => {
                        resolve('Post could not be found, so report was successfully deleted')
                    }).catch(error => {
                        console.error('An error occured while deleting post report with id:', report._id)
                        console.error('The error was:', error)
                        reject('Post could not be found, so server attempted to delete report, but an error occured: ' + error)
                    })
                }
            }).catch(error => {
                console.error('An error occured while finding image post with id:', report.postId)
                console.error('The error was:', error)
                reject("An error occured while finding image post: " + error)
            })
        })
    }

    #deletePollPostAndReport(report) {
        return new Promise((resolve, reject) => {
            Poll.findOne({_id: {$eq: report.postId}}).lean().then(postData => {
                if (postData) {
                    User.findOne({_id: {$eq: postData.creatorId}}).lean().then(creator => {
                        var emailData = {
                            from: process.env.SMTP_EMAIL,
                            to: creator.email,
                            subject: "Poll post removed",
                            text: `Someone reported your post for "${report.reason}". SocialSquare staff have looked at the report and your post, and have found your post to not be fit to be on SocialSquare, and as such this post has been removed from SocialSquare.\n Post Title: "${postData.pollTitle}"\n Post SubTitle: "${postData.pollSubTitle}"\n Option One: "${postData.optionOne}\n Option Two: "${postData.optionTwo}" ${postData.optionThree ? `\n Option Three: "${postData.optionThree}"` : ''} ${postData.optionFour ? `\n Option Four: "${postData.optionFour}"` : ''} ${postData.optionFive ? `\n Option Five: "${postData.optionFive}"` : ''} ${postData.optionSix ? `\n Option Six: "${postData.optionSix}"` : ''}`
                        };

                        this.#sendEmail(emailData).then(() => {
                            pollPostLib.deleteOnePollPostById(postData._id, false).then(() => {
                                this.#deletePostReport(report._id).then(() => {
                                    resolve()
                                }).catch(error => {
                                    console.error('An error occured while deleting post report with id:', report._id)
                                    console.error('The error was:', error)
                                    reject('An error occured while deleting post report: ' + error)
                                })
                            }).catch(error => reject(error))
                        }).catch(error => {
                            reject(error)
                        })
                    }).catch(error => {
                        console.error('An error occured while finding user with id:', postData.creatorId)
                        console.error('The error was:', error)
                        reject('An error occured while finding post creator: ' + error)
                    })
                } else {
                    this.#deletePostReport(report._id).then(() => {
                        resolve('Post could not be found, so report was successfully deleted')
                    }).catch(error => {
                        console.error('An error occured while deleting post report with id:', report._id)
                        console.error('The error was:', error)
                        reject('Post could not be found, so server attempted to delete report, but an error occured: ' + error)
                    })
                }
            }).catch(error => {
                console.error('An error occured while finding poll post with id:', report.postId)
                console.error('The error was:', error)
                reject("An error occured while finding image post: " + error)
            })
        })
    }

    #deleteThreadPostAndReport(report) {
        return new Promise((resolve, reject) => {
            Thread.findOne({_id: {$eq: report.postId}}).lean().then(postData => {
                if (postData) {
                    User.findOne({_id: {$eq: postData.creatorId}}).lean().then(creator => {
                        let postTags = ''
                        try {
                            postTags = postData.tags.join(', ')
                        } catch {}
                        var emailData = {
                            from: process.env.SMTP_EMAIL,
                            to: creator.email,
                            subject: "Thread post removed",
                            text: `Someone reported your post for "${report.reason}". SocialSquare staff have looked at the report and your post, and have found your post to not be fit to be on SocialSquare, and as such this post has been removed from SocialSquare. ${postData.threadImageKey ? 'The image that was in your thread has been attached to this email.' : ''} \n Thread Title: ${postData.threadTitle}\nThread Subtitle: ${postData.threadSubtitle} \nThread Tags: ${postData.threadTags} \nThread Category: ${postData.threadCategory} ${postData.threadImageKey ? `\nThread Image Description: ${postData.threadImageDescription}` : `\nThread Body: ${postData.threadBody}`} \nThread NSFW: ${postData.threadNSFW ? 'Yes' : 'No'} \nThread NSFL: ${postData.threadNSFL ? 'Yes' : 'No'}`
                        };

                        if (postData.threadImageKey) {
                            emailData.attachments = [{   // stream as an attachment
                                filename: 'image.jpg',
                                content: fs.createReadStream(path.resolve(process.env.UPLOADED_PATH, postData.threadImageKey))
                            }]
                        }

                        this.#sendEmail(emailData).then(() => {
                            threadPostLib.deleteOneThreadPostById(postData._id, false).then(() => {
                                this.#deletePostReport(report._id).then(() => {
                                    resolve()
                                }).catch(error => {
                                    console.error('An error occured while deleting post report with id:', report._id)
                                    console.error('The error was:', error)
                                    reject('An error occured while deleting post report: ' + error)
                                })
                            }).catch(error => reject(error))
                        }).catch(error => {
                            reject(error)
                        })
                    }).catch(error => {
                        console.error('An error occured while finding user with id:', postData.creatorId)
                        console.error('The error was:', error)
                        reject('An error occured while finding post creator: ' + error)
                    })
                } else {
                    this.#deletePostReport(report._id).then(() => {
                        resolve('Post could not be found, so report was successfully deleted')
                    }).catch(error => {
                        console.error('An error occured while deleting post report with id:', report._id)
                        console.error('The error was:', error)
                        reject('Post could not be found, so server attempted to delete report, but an error occured: ' + error)
                    })
                }
            }).catch(error => {
                console.error('An error occured while finding thread post with id:', report.postId)
                console.error('The error was:', error)
                reject("An error occured while finding thread post: " + error)
            })
        })
    }

    login(email, password) {
        return new Promise((resolve, reject) => {
            // Check if admin exist
            this.#findOneAdminByEmail(email).then((data) => {
                if (data) {
                    //Admin Exists
                    const hashedPassword = data.password

                    let passwordIsCorrect;

                    try {
                        passwordIsCorrect =  bcrypt.compareSync(password, hashedPassword);
                    } catch (error) {
                        console.error('An error occurred while comparing passwords for admin with email:', email, '. The error was:', error)
                        reject("An error occurred while comparing passwords")
                    }

                    if (!passwordIsCorrect) return reject("Invalid password entered!")
                   
                    const token = this.#generateAuthJWT(data._id);
                    const refreshToken = this.#generateRefreshToken(data._id);
                    const encryptedRefreshToken = refreshTokenEncryption(refreshToken)
                    Admin.findOneAndUpdate({_id: {$eq: data._id}}, {$push: {refreshTokens: encryptedRefreshToken}}).then(() => {
                        const filteredAdminData = this.#filterAdminInformationToSend(data)
                        const toSend = {
                            data: filteredAdminData,
                            token: `Bearer ${token}`,
                            refreshToken: `Bearer ${refreshToken}`
                        }
                        resolve(toSend)
                    }).catch(error => {
                        console.error('An error occured while pushing refresh token to Admin with id:', data._id)
                        console.error('The error was:', error)
                        reject("An error occured while pushing refresh token to Admin document")
                    })
                } else {
                    reject("Invalid credentials entered!")
                }
            }).catch(err => {
                console.error('An error occured while finding admin with email:', email)
                console.error('The error was:', err)
                reject("An error occured while checking for existing admin")
            })
        })
    }

    getAssignedReports(adminId) {
        return new Promise((resolve, reject) => {
            this.#findOneAdminById(adminId).then(admin => {
                if (admin) {
                    this.#getAssignedReportsByAdminId(adminId).then(reports => resolve(reports)).catch(error => {
                        console.error('An error occured while finding account and post reports assigned to admin with id:', adminId)
                        console.error('The error was:', error)
                        reject("Error occured while finding assigned reports")
                    })
                } else {
                    reject("Admin not found")
                }
            }).catch(error => {
                console.error('An error occured while finding admin by id:', adminId)
                console.error('The error was:', error)
                reject("Error occured while finding admin: " + error)
            })
        })
    }

    assignReports(adminId) {
        const limit = 10
        return new Promise((resolve, reject) => {
            this.#findOneAdminById(adminId).then(admin => {
                if (admin) {
                    Promise.all([
                        AccountReports.find({assignedTo: {$exists: false}}).limit(limit).lean(),
                        PostReports.find({assignedTo: {$exists: false}}).limit(limit).lean()
                    ]).then(([accountReports, postReports]) => {
                        return Promise.all(
                            accountReports.map(report => {
                                return AccountReports.updateOne({_id: report._id}, {$set: {assignedTo: adminId}})
                            }).concat(postReports.map(report => {
                                return PostReports.updateOne({_id: report._id}, {$set: {assignedTo: adminId}})
                            }))
                        )
                    }).then(() => this.#getAssignedReportsByAdminId(adminId)).then(reports => resolve(reports)).catch(error => {
                        console.error('An error occured while finding reports to assign or assigning reports to admin with id:', adminId)
                        console.error('The error was:', error)
                        reject("An error occured while finding posts to assign: " + error)
                    })
                } else {
                    reject("Admin not found")
                }
            }).catch(error => {
                console.error('An error occured while finding admin by id:', adminId)
                console.error('The error was:', error)
                reject("Error occured while finding admin: " + error)
            })
        })
    }

    dismissPostReport(adminId, reportId) {
        return new Promise((resolve, reject) => {
            this.#findOneAdminById(adminId).then(admin => {
                if (admin) {
                    this.#deletePostReport(reportId).then(() => {
                        resolve()
                    }).catch(error => {
                        console.error('An error occured while deleting post report with id:', reportId)
                        console.error('The error was:', error)
                        resolve('An error occured while deleting post report: ' + error)
                    })
                } else {
                    reject('Admin not found')
                }
            }).catch(error => {
                console.error('An error occured while finding admin by id:', adminId)
                console.error('The error was:', error)
                reject('An error occured while finding admin: ' + error)
            })
        })
    }

    deletePostAndReport(adminId, reportId) {
        return new Promise((resolve, reject) => {
            this.#findOneAdminById(adminId).then(admin => {
                if (admin) {
                    this.#findOnePostReportById(reportId).then(report => {
                        if (report) {
                            if (report.format === "Image") {
                                this.#deleteImagePostAndReport(report).then(() => resolve()).catch(error => reject(error))
                            } else if (report.format === "Poll") {
                                this.#deletePollPostAndReport(report).then(() => resolve()).catch(error => reject(error))
                            } else if (report.format === "Thread") {
                                this.#deleteThreadPostAndReport(report).then(() => resolve()).catch(error => reject(error))
                            } else {
                                reject('Invalid format for report post: ' + report.format)
                            }
                        } else {
                            reject('Report not found')
                        }
                    }).catch(error => {
                        console.error('An error occured while finding post report by id:', reportId)
                        console.error('The error was:', error)
                        reject('An error occured while finding post report: ' + error)
                    })
                } else {
                    reject("Admin not found")
                }
            }).catch(error => {
                console.error('An error occured while finding admin by id:', adminId)
                console.error('The error was:', error)
                reject("An error occured while finding admin: " + error)
            })
        })
    }
}

module.exports = AdminClass;