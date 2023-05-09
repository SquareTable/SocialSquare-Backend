class Array {
    returnSomeItems(array, skip, limit) {
        return {items: array.splice(skip, limit), noMoreItems: skip >= array.length}
    }
}

module.exports = Array;