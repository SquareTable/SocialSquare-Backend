const LibClass = require('../../libraries/Random');
const lib = new LibClass();

const {test, expect, describe} = require('@jest/globals')

describe('generateRandomHexString', () => {
    for (let i = 1; i < 100; i++) {
        test(`Creates string of length: ${i}`, () => {
            expect(lib.generateRandomHexString(i)).toHaveLength(i)
        })
    }
})