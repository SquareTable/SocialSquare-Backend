const Thread = require('../models/Thread')
const Category = require('../models/Category')

const makeThreadsReferenceCategoryById = () => {
    Thread.find({}).lean().then(threads => {
        console.log('Number of threads received:', threads.length)
        let processedCount = 0;
        let deletedCount = 0;
        for (const thread of threads) {
            Category.findOne({categoryTitle: thread.threadCategory}).lean().then(category => {
                if (!category) {
                    console.error('Category could not be found with title:', thread.threadCategory)
                }

                Thread.deleteOne({_id: thread._id}).then(() => {
                    console.log(`Deleted thread ${++deletedCount}`)

                    delete thread.threadCategory;
                    delete thread._id;
                    thread.threadCategoryId = category._id

                    const newThread = new Thread(thread);
                    newThread.save().then(() => {
                        console.log(`Successfully saved and processed thread ${++processedCount}`)
                    }).catch(error => {
                        console.error('An error occurred while saving new thread. The error was:', error)
                    })
                }).catch(error => {
                    console.error('An error occurred while deleting one thread with id:', thread._id, '. The error was:', error)
                })
            }).catch(error => {
                console.error('An error occurred while finding category with title:', thread.threadCategory, '. The error was:', error)
            })
        }
    }).catch(error => {
        console.error('An error occurred while finding all threads in SocialSquare:', error)
    })
}

module.exports = makeThreadsReferenceCategoryById;