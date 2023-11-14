class ArrayClass {
    returnSomeItems(array, skip, limit) {
        return {items: array.splice(skip, limit), noMoreItems: skip >= array.length}
    }

    returnOwnerPostPairs(posts, owners, ownerIdKey) {
        const users = {};
        for (const user of owners) {
            users[String(user._id)] = user;
        }

        const postOwnerPairMap = new Map();
        const postsWithNoOwners = [];

        for (const post of posts) {
            const ownerId = String(post[ownerIdKey])
            const owner = users[ownerId];

            if (owner) {
                if (postOwnerPairMap.has(owner)) {
                    postOwnerPairMap.get(owner).push(post)
                } else {
                    postOwnerPairMap.set(owner, [post])
                }
            } else {
                postsWithNoOwners.push(post)
            }
        }

        return {
            ownerPostPairs: Array.from(postOwnerPairMap.entries()),
            postsWithNoOwners
        }
    }

    returnMemberCategoryPairs(categoriesReceived, members) {
        const categories = {};
        for (const category of categoriesReceived) {
            categories[String(category._id)] = category;
        }

        const memberCategoryPairMap = new Map();
        const missingCategories = [];

        for (const member of members) {
            const categoryId = member.categoryId;
            const category = categories[categoryId];

            if (category) {
                memberCategoryPairMap.set(category, member)
            } else {
                missingCategories.push(category)
            }
        }

        return {
            memberCategoryPairs: Array.from(memberCategoryPairMap.entries()),
            missingCategories
        }
    }

    returnDocumentsFromIdArray(ids, documentsReceived, idKey) {
        const documents = {};
        for (const doc of documentsReceived) {
            documents[String(doc[idKey])] = doc;
        }

        const foundDocuments = [];
        const missingDocuments = [];

        for (const id of ids) {
            const doc = documents[id];

            if (doc) {
                foundDocuments.push(doc)
            } else {
                missingDocuments.push(doc);
            }
        }

        return {
            foundDocuments,
            missingDocuments
        }
    }
}

module.exports = ArrayClass;