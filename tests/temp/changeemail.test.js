const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const TempController = require('../../controllers/Temp');
const User = require('../../models/User');

/*
TODO:
Test if change fails if userId is not a string
Test if change fails if userId is not an objectId
Test if change fails if password is not a string
Test if change fails if password is an empty string
Test if change fails if desiredEmail is not a string
Test if change fails if desiredEmail is an empty string
Test if change fails if desiredEmail does not pass the valid email test
Test if change fails if user with userId could not be found
Test if change fails if there is already a user with the desired email
test if change fails if password is wrong
Test if change is successful when inputs are correct
Test if change does not modify other User documents
*/