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
}

module.exports = ArrayClass;