const CONSTANTS = {
    BCRYPT_COST_FACTOR: 10,
    MIN_USER_PASSWORD_LENGTH: 8,
    MAX_USER_PASSWORD_LENGTH: 17, //Due to bcrypt limitations, passwords can only be 72 bytes. Some characters can be up to 4 bytes long. 72 / 4 = 18, so to stay under the 72 byte limit the current max is 17 characters long
    MAX_USER_USERNAME_LENGTH: 20,
    VALID_EMAIL_TEST: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
    VALID_USERNAME_TEST: /^[a-z0-9]*$/,
    MAX_USER_DISPLAY_NAME_LENGTH: 20,
    MAX_USER_BIO_LENGTH: 250,
    VALID_BIO_TEST: /^([^\n]*\n){0,9}[^\n]*$/, //Tests to make sure bio has less than 10 lines
    MAX_USER_BIO_LINES: 10, //Update this value to reflect the VALID_BIO_TEST above
    SEARCH_PAGE_USER_SEARCH_MAX_USERS_TO_RETURN: 20,
    MAX_USER_COMMENT_LENGTH: 1000,
    VALID_COMMENT_TEST: /^([^\n]*\n){0,9}[^\n]*$/, //Tests to make sure comment has less than 10 lines
    MAX_USER_COMMENT_LINES: 10, //Update this value to reflect the MAX_USER_COMMENT_LINES above
    MAX_CATEGORY_TITLE_LENGTH: 20,
    MAX_CATEGORY_DESCRIPTION_LENGTH: 150,
    VALID_CATEGORY_TITLE_TEST: /^[a-z]+$/, //Tests to make sure category titles only have lowercase a - z characters
    CATEGORY_TITLE_FAILED_TEST_ERROR_MESSAGE: 'Category title must only contain lowercase a - z characters', //Update this value to reflect the VALID_CATEGORY_TITLE_TEST above
    VALID_CATEGORY_DESCRIPTION_TEST: /^([^\n]*\n){0,2}[^\n]*$/, //Tests to make sure category description has less than 3 lines
    MAX_CATEGORY_DESCRIPTION_LINES: 3, //Update this value to reflect the VALID_BIO_TEST above
    MAX_THREAD_TITLE_LENGTH: 30,
    VALID_THREAD_TITLE_TEST: /^([^\n]*\n){0}[^\n]*$/, //Tests to make sure threadTitle is single line only
    THREAD_TITLE_FAILED_TEST_ERROR_MESSAGE: 'threadTitle must only have one line', //Update this value to reflect the VALID_THREAD_TITLE_TEST above
    MAX_THREAD_SUBTITLE_LENGTH: 30,
    VALID_THREAD_SUBTITLE_TEST: /^([^\n]*\n){0}[^\n]*$/, //Tests to make sure threadSubtitle is single line only
    THREAD_SUBTITLE_FAILED_TEST_ERROR_MESSAGE: 'threadSubtitle must only have one line', //Update this value to reflect the VALID_THREAD_SUBTITLE_TEST
    MAX_THREAD_BODY_LENGTH: 1000,
    VALID_THREAD_BODY_TEST: /^([^\n]*\n){0,9}[^\n]*$/, //Tests to make sure thread body has less than 10 lines
    MAX_THREAD_BODY_LINES: 10, //Update this value to reflect the VALID_THREAD_BODY_TEST above
    MAX_THREAD_TAGS_LENGTH: 100,
    VALID_THREAD_TAGS_TEST: /^([^\n]*\n){0}[^\n]*$/, //Tests to make sure threadTags is single line only
    THREAD_TAGS_FAILED_TEST_ERROR_MESSAGE: 'threadTags must only have one line', //Update this value to reflect the VALID_THREAD_TAGS_TEST above
    MAX_THREAD_IMAGE_DESCRIPTION_LENGTH: 1000,
    VALID_THREAD_IMAGE_DESCRIPTION_TEST: /^([^\n]*\n){0,9}[^\n]*$/, //Tests to make sure thread image description has less than 10 lines
    THREAD_IMAGE_DESCRIPTION_FAILED_TEST_ERROR_MESSAGE: 'threadImageDescription must have less than 10 lines', //Update this value to reflect the VALID_THREAD_IMAGE_DESCRIPTION_TEST above
    GET_USER_ACTIVITY_API_LIMIT: 20, //This is the limit for the temp/getUserActivity API - Limits the amount of posts returns
    PRIVACY_SETTINGS_ALLOWED_VALUES: { //These are the allowed values for updating the users' privacy settings. Change these whenever a new privacy setting is added or an existing one is modified.
        viewFollowers: ['no-one', 'followers', 'everyone'],
        viewFollowing: ['no-one', 'followers', 'everyone'],
        showBadges: ['no-one', 'followers', 'everyone']
    },
    LOGIN_ACTIVITY_SETTINGS_ALLOWED_VALUES: { //These are the allowed keys and values for updating the users' login activity settings. Change these whenever a new privacy setting is added or an existing one is modified.
        getIP: [false, true],
        getDeviceType: [false, true],
        getLocation: [false, true]
    },
    EMAIL_VERIFICATION_CODE_SALT_ROUNDS: 10,
    EMAIL_VERIFICATION_CODE_EXPIRE_TIME_SECONDS: 60 * 5, //5 minutes
    NUM_POLLS_TO_SEND_PER_API_CALL: 10,
    NUM_IMAGE_POSTS_TO_SEND_PER_API_CALL: 10,
    NUM_THREAD_POSTS_TO_SEND_PER_API_CALL: 10,
    NUM_CATEGORIES_TO_SEND_PER_API_CALL: 10
}

module.exports = CONSTANTS