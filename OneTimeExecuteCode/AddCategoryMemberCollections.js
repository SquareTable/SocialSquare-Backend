const Category = require('../models/Category');
const CategoryMember = require('../models/CategoryMember');

Category.find({}).lean().then(async categories => {
    for (const category of categories) {
        if (category.members?.length > 0) {
            const docs = [];
            for (const member of category.members) {
                docs.push({
                    userId: member,
                    categoryId: String(category._id),
                    dateJoined: Date.now(),
                    roles: []
                })
            }
            await CategoryMember.insertMany(docs);
        }
    }

    await Category.updateMany({}, {$unset: {members: "", categoryModeratorIds: ""}})

    console.log('SUCCESS!')
}).catch(error => {
    console.error('ERROR:', error)
})