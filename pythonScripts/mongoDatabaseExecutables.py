from pymongo import MongoClient
from dotenv import load_dotenv, find_dotenv
from bson.objectid import ObjectId
import os
import time

last_timestamp = time.time()

load_dotenv(find_dotenv())
print("MDE1: " + str(time.time()-last_timestamp))
last_timestamp = time.time()
client = MongoClient(os.environ.get("PYTHON_MONGODB_URI"))
print("MDE2: " + str(time.time()-last_timestamp))
last_timestamp = time.time()
print(client.list_database_names())
db = client.UserDB
print(db.list_collection_names())

user = db.users
image_post = db.imageposts
popular_posts = db.popularposts
#poll = db.polls
#thread = db.threads


def find_one_user(filter, args):
    print("FOU")
    return user.find_one(filter, args)

def find_multiple_users(filter, args):
    print("FMU")
    return user.find(filter, args)

def find_one_image_post(filter, args):
    print("FOI")
    return image_post.find_one(filter, args)

def find_multiple_image_posts(filter, args):
    print("FMIP")
    return image_post.find(filter, args)

def find_popular_posts():
    print("FPP")
    return popular_posts.find_one({}) #only one document here anyway

#client.close()