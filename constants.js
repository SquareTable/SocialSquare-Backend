const CONSTANTS = {
    BCRYPT_COST_FACTOR: 10,
    MIN_USER_PASSWORD_LENGTH: 8,
    MAX_USER_PASSWORD_LENGTH: 17, //Due to bcrypt limitations, passwords can only be 72 bytes. Some characters can be up to 4 bytes long. 72 / 4 = 18, so to stay under the 72 byte limit the current max is 17 characters long
    MAX_USER_USERNAME_LENGTH: 20,
    VALID_EMAIL_TEST: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
    VALID_USERNAME_TEST: /^[a-z0-9]*$/,
    MAX_USER_DISPLAY_NAME_LENGTH: 20,
    MAX_USER_BIO_LENGTH: 250,
    VALID_BIO_TEST: /^([^\n]*\n){0,9}[^\n]*$/, //Tests to make sure bio has less than 10 lines,
    MAX_USER_BIO_LINES: 10, //Update this value to reflect the VALID_BIO_TEST above
    SEARCH_PAGE_USER_SEARCH_MAX_USERS_TO_RETURN: 20,
    MAX_USER_COMMENT_LENGTH: 1000,
    MAX_CATEGORY_TITLE_LENGTH: 20,
    MAX_CATEGORY_DESCRIPTION_LENGTH: 150
}

module.exports = CONSTANTS