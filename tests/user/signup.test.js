const MockMongoDBServer = require('../../libraries/MockDBServer');
const mongoose = require('mongoose');


const User = require('../../models/User');
const UserController = require('../../controllers/User');

const INVALID_NAMES = ["abc12!", "abc._.abc", "abc!@#$%^&*()", "(", ")", "$%^&*wegyf"]

/*
TODO:
Test if signup fails if name is not a string
Test if signup fails if name is an empty string
Test if signup fails if name is not only alphanumeric characters
Test if signup fails if name is more than 20 characters
test if signup fails if email is not a string
Test if signup fails if email is an empty string
Test if signup fails when email is not valid (give a list of invalid emails to test against)
Test if signup fails when password is not a string
Test if signup fails when password is an empty string
Test if signup fails if password is less than 8 characters
Test if signup fails if password is more than 17 characters
Test if signup fails if a user with the same email already exists
Test if signup fails if a user with the same username already exists



Test if user gets made successfully
    - Badge added
    - Password is hashed
    - Password can be verified with bcrypt
    - Test JWT token gets generated and is correct and usable
    - Test JWT refresh token gets generated and is correct and usable
    - Test encrypted refresh token gets generated and can be turned back into regular refresh tokens
    - Test refresh token gets made successfully (with admin set to false)
    - Test API returns correct token, refresh token, and refreshTokenId
    - Test API returns correct user data

Test that user creation does not modify other users in the database
*/