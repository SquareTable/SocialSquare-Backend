const LibClass = require('../../libraries/UUID')
const lib = new LibClass();

const TEST_CONSTANTS = require('../TEST_CONSTANTS');

const {describe, test, expect} = require('@jest/globals');

/*
Tests:
- Test lib.validateV4 method
    - Test if valid UUID v1 returns false
    - Test if valid UUID v3 returns false
    - Test if valid UUID v4 returns true
    - Test if valid UUID v5 returns false
    - Test if a random string returns false
    - Test if non-strings returns false
*/

describe('validateV4 method tests', () => {
    test('If valid UUID v1 returns false', () => {
        expect(lib.validateV4('112ce296-a8a1-11ee-a506-0242ac120002')).toBe(false)
    })

    test('If valid UUID v3 returns false', () => {
        expect(lib.validateV4('9fca1d79-c5e3-36d7-84f9-6a0a45efd5ff')).toBe(false)
    })

    test('If valid UUID v4 returns true', () => {
        expect(lib.validateV4('126676fc-27b3-41cc-be45-918b33d38f0c')).toBe(true)
    })

    test('If valid UUID v5 returns false', () => {
        expect(lib.validateV4('cec2167c-2938-5c23-814d-4dcbb8cbe6ee')).toBe(false)
    })

    test('If random string returns false', () => {
        expect(lib.validateV4('i am a random string')).toBe(false)
    })

    for (const notString of TEST_CONSTANTS.NOT_STRINGS) {
        test(`If non-strings return false. Testing ${notString}`, () => {
            expect(lib.validateV4(notString)).toBe(false)
        })
    }
})