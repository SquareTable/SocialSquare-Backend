import sys
#print(sys.path)
#sys.path.insert(0, "/server/python_venv/lib/Python3.10/site-packages")
#print(sys.path)


from random import randint
from re import S
import pymongo
from pymongo import MongoClient
from bson.objectid import ObjectId
import json
import os
from dotenv import load_dotenv, find_dotenv
import datetime
import time
import mongoDatabaseExecutables


# IM is importance multiplier
# CTBC is chance to be chosen
sectorValues = {
    "recommendation": {"IM": 3}, #higher IM but val moves slower than UR
    "upcomingRecommendation": {"IM": 2}, #lower IM but val moves faster than UR
    "frequentlyPositiveReactions": {"IM": 3}, #higher IM but val moves slower than UFPR
    "upcomingFrequentlyPositiveReactions": {"IM": 2}, #lower IM but val moves faster than FPR
    "frequentlyNegativeReactions": {"IM": 0},
    "postNegativeReactions": {"IM": 0}
}

date_format = "%d/%m/%Y @ %H:%M:%S"
seen_too_much = 5

def get_post_from_recommendations(decided_key, user_object_id, user_pub_id, post_ids_already):
    print("AM2: " + str(datetime.datetime.now()))
    try:
        if decided_key == "~popular": #too speed up we can reduce the amount of db requests made
            print("~popular")
            popular_posts_doc = mongoDatabaseExecutables.find_popular_posts()
            if popular_posts_doc:
                array_of_ids = popular_posts_doc["popularPosts"]
                for i in range (len(array_of_ids)):
                    random_index = randint(0,len(array_of_ids))
                    random_post = array_of_ids[random_index] #As Id rather have random than a descending from top
                    if random_post["_id"] in post_ids_already:
                        array_of_ids.pop(random_index)
                        continue
                    else:
                        this_image_post = mongoDatabaseExecutables.find_one_image_post({"_id": random_post["_id"]}, {"upVotes": 1, "downVotes": 1, "viewedBy": 1})
                        if this_image_post:
                            if user_object_id in this_image_post["upVotes"] or user_object_id in this_image_post["downVotes"]:
                                array_of_ids.pop(random_index)
                                continue
                            else:
                                viewedBy = []
                                if "viewedBy" in this_image_post:
                                    viewedBy = this_image_post["viewedBy"]
                                user_has_viewed = next((item for item in viewedBy if item["pubId"] == user_pub_id), {"amount": 0})
                                if user_has_viewed["amount"] > seen_too_much: #seen too much
                                    array_of_ids.pop(random_index)
                                    continue
                                else:
                                    #print("Success: " + str(random_post["_id"]))
                                    return random_post["_id"]
                        else:
                            #print("Couldn't find this index's post")
                            array_of_ids.pop(random_index)
                            continue
                return "Blacklist" #if there are no valid in the whole 100
            else:
                #print("Couldn't find popular posts doc")
                return None
        else:
            #print("Recommendation " + decided_key)
            image_posts_recommended = list(mongoDatabaseExecutables.find_multiple_image_posts({"tags": decided_key}, {"upVotes": 1, "downVotes": 1, "viewedBy": 1}))
            if len(image_posts_recommended) != 0:
                posts_to_use = []
                for post in image_posts_recommended:
                    if user_object_id in post["upVotes"] or user_object_id in post["downVotes"]:
                        continue
                    elif post["_id"] in post_ids_already:
                        continue
                    else:
                        viewedBy = []
                        if "viewedBy" in post:
                            viewedBy = post["viewedBy"]
                        user_has_viewed = next((item for item in viewedBy if item["pubId"] == user_pub_id), {"amount": 0})
                        if user_has_viewed["amount"] > seen_too_much: #seen too much
                            continue
                        else:
                            posts_to_use.append({"post_id": post["_id"], "viewed_amount": user_has_viewed["amount"], "date_posted": post["datePosted"], "up_to_down_votes": len(post["upVotes"])-len(post["downVotes"])})
                        
                    if len(posts_to_use) != 0:
                        #print(posts_to_use)
                        sorted_posts = sorted(posts_to_use, key=lambda x: (-x["up_to_down_votes"], -x["viewed_amount"], datetime.datetime.strptime(x["date_posted"], date_format)), reverse=True) #negative x since datetime gets sorted some other way
                        #print("Sorted: \n")
                        #print(sorted_posts)
                        return sorted_posts[0]["post_id"]
                    else:
                        return "Blacklist"
            else:
                return "Blacklist"
    except Exception as E:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        #print(exc_type, fname, exc_tb.tb_lineno)
        #print(E)
        return None

def get_post_from_post_creator(decided_user, user_object_id, user_pub_id, post_ids_already, following):
    print("AM3: " + str(datetime.datetime.now()))
    try: 
        #print("1 following: " + str(following))
        if decided_user == "~following":
            print("following")
            #print("1")
            users_if_any = list(mongoDatabaseExecutables.find_multiple_users({"secondId": {"$in": following}}, {"_id": 1}))
            #print(users_if_any)
            if len(users_if_any) != 0:
                users_if_any = list(map(lambda i: i["_id"], users_if_any))
                #print("2")
                possible_image_posts = list(mongoDatabaseExecutables.find_multiple_image_posts({"creatorId": {"$in": users_if_any}}, {"upVotes" : 1, "downVotes": 1, "viewedBy": 1, "datePosted": 1})) #only need these values _id is there by defailt
                if len(possible_image_posts) != 0:
                    #print("3")
                    #print(possible_image_posts)
                    posts_to_use = []
                    for post in possible_image_posts:
                        if user_object_id in post["upVotes"] or user_object_id in post["downVotes"]:
                            continue
                        elif post["_id"] in post_ids_already:
                            continue
                        else:
                            viewedBy = []
                            if "viewedBy" in post:
                                viewedBy = post["viewedBy"]
                            user_has_viewed = next((item for item in viewedBy if item["pubId"] == user_pub_id), {"amount": 0})
                            if user_has_viewed["amount"] > seen_too_much: #seen too much
                                continue
                            else:
                                posts_to_use.append({"post_id": post["_id"], "viewed_amount": user_has_viewed["amount"], "date_posted": post["datePosted"]})
                        
                    if len(posts_to_use) != 0:
                        #print(posts_to_use)
                        #print("4")
                        sorted_posts = sorted(posts_to_use, key=lambda x: (-x["viewed_amount"], datetime.datetime.strptime(x["date_posted"], date_format)), reverse=True) #negative x since datetime gets sorted some other way
                        #print("5")
                        #print("Sorted: \n")
                        #print(sorted_posts)
                        return sorted_posts[0]["post_id"]
                    else:
                        return "Blacklist"
                else:
                    print("No posts from following")
                    return "Blacklist"
            else:
                print("Likely none they are following")
                return "Blacklist"
        else:
            #print("User " + decided_user)
            post_creator_object_id = ObjectId(decided_user)
            post_creator = mongoDatabaseExecutables.find_one_user({"_id": post_creator_object_id})
            if post_creator:
                #user exists
                post_creators_image_posts = list(mongoDatabaseExecutables.find_multiple_image_posts({"creatorId": post_creator_object_id}, {"upVotes" : 1, "downVotes": 1, "viewedBy": 1, "datePosted": 1})) #only need these values _id is there by defailt
                #print(post_creators_image_posts)
                if len(post_creators_image_posts) != 0:
                    posts_to_use = []
                    for post in post_creators_image_posts:
                        if user_object_id in post["upVotes"] or user_object_id in post["downVotes"]:
                            continue
                        elif post["_id"] in post_ids_already:
                            continue
                        else:
                            user_has_viewed = next((item for item in post["viewedBy"] if item["pubId"] == user_pub_id), {"amount": 0})
                            if user_has_viewed["amount"] > seen_too_much: #seen too much
                                continue
                            else:
                                posts_to_use.append({"post_id": post["_id"], "viewed_amount": user_has_viewed["amount"], "date_posted": post["datePosted"]})
                    
                    if len(posts_to_use) != 0:
                        #print(posts_to_use)
                        sorted_posts = sorted(posts_to_use, key=lambda x: (-x["viewed_amount"], datetime.datetime.strptime(x["date_posted"], date_format)), reverse=True) #negative x since datetime gets sorted some other way
                        #print("Sorted: \n")
                        #print(sorted_posts)
                        return sorted_posts[0]["post_id"]
                    else:
                        return "Blacklist"
                else:
                    print("No posts by this user")
                    return None
            else:
                return None
    except Exception as E:
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        #print(exc_type, fname, exc_tb.tb_lineno)
        #print(E)
        return None
#print(get_post_from_post_creator("61416af34b1919000421eb68", "61413c93818714000457c09f", "34a0d72d-971a-4284-a9bb-b78adf954c0f", [''ObjectId("61bda9c499aefa0004226e88")''])) #missing few speech marks due to test

def main():
    try:
        print("AM1: " + str(str(datetime.datetime.now())))
        #print(sys.argv)
        user_id = "61413c93818714000457c09f" #sys.argv[1]
        already_on_feed = "" #sys.argv[2]
        amount_requesting = 10 #change later maybe to an argument

        if already_on_feed != '""':
            already_on_feed = already_on_feed.split(",")
            #print(already_on_feed)
            already_on_feed = list(map(lambda i: i.strip().replace('"', ''), already_on_feed))
            #print(already_on_feed)
        else: 
            already_on_feed = []

        #print("Python program:")
        #print(user_id)
        #print(already_on_feed)
        #print(user.count_documents({}))
        user_object_id = ObjectId(user_id)
        user_found = mongoDatabaseExecutables.find_one_user({"_id": user_object_id}, None)
        if user_found:
            user_pub_id = user_found["secondId"]
            users_r = user_found["algorithmData"]["recommendation"]
            users_ur = user_found["algorithmData"]["upcomingRecommendation"]
            users_fpr = user_found["algorithmData"]["frequentlyPositiveReactions"]
            users_ufpr = user_found["algorithmData"]["upcomingFrequentlyPositiveReactions"]

            array_of_all = [{"CTBC": 0}] #inital value for 0 just bc
            ctbc_sum = 0
            #CTBC is a range type of thing if there is only two in array and the second has a 1000/5000 chance, the first in array will be 4000 and second will be 5000
            for item in users_r:
                ctbc_sum += item["val"]*sectorValues["recommendation"]["IM"]
                array_of_all.append({"CTBC": item["val"]*sectorValues["recommendation"]["IM"]+array_of_all[-1]["CTBC"], "stringVal": item["stringVal"], "sector": "recommendation"})

            for item in users_ur:
                ctbc_sum += item["val"]*sectorValues["upcomingRecommendation"]["IM"]
                array_of_all.append({"CTBC": item["val"]*sectorValues["upcomingRecommendation"]["IM"]+array_of_all[-1]["CTBC"], "stringVal": item["stringVal"], "sector": "upcomingRecommendation"})

            for item in users_fpr:
                if item["stringVal"] != "~none":
                    ctbc_sum += item["val"]*sectorValues["frequentlyPositiveReactions"]["IM"]
                    array_of_all.append({"CTBC": item["val"]*sectorValues["frequentlyPositiveReactions"]["IM"]+array_of_all[-1]["CTBC"], "stringVal": item["stringVal"], "sector": "frequentlyPositiveReactions"})

            for item in users_ufpr:
                ctbc_sum += item["val"]*sectorValues["upcomingFrequentlyPositiveReactions"]["IM"]
                array_of_all.append({"CTBC": item["val"]*sectorValues["upcomingFrequentlyPositiveReactions"]["IM"]+array_of_all[-1]["CTBC"], "stringVal": item["stringVal"], "sector": "upcomingFrequentlyPositiveReactions"})

            #print(array_of_all)
            
            posts_for_response = []
            black_list = [] #if no posts eligible (dont really have to seperate to user ids for fpr/ufpr and keywords for r/ur as a userid as a keyword is a stupid keyword anyway)
            while len(posts_for_response) < amount_requesting:
                #print(ctbc_sum)
                sectorSelector = randint(1, ctbc_sum)
                #print(sectorSelector)
                for index in range(len(array_of_all)):
                    if sectorSelector < array_of_all[index]["CTBC"] and sectorSelector > array_of_all[index-1]["CTBC"]:
                        print("Chose:")
                        print(array_of_all[index])
                        if array_of_all[index]["sector"] == "recommendation" or array_of_all[index]["sector"] == "upcomingRecommendation":
                            post_from_recommendations = get_post_from_recommendations(array_of_all[index]["stringVal"], user_object_id, user_pub_id, posts_for_response)
                            if post_from_recommendations == None:
                                #print("Posts from: " + array_of_all[index]["stringVal"] + " failed in get_post_from_recommendations")
                                continue
                            elif post_from_recommendations == "Blacklist":
                                black_list.append(array_of_all[index]["stringVal"])
                                continue
                            else: 
                                posts_for_response.append(str(post_from_recommendations))
                                print("Success")
                                print("AM4: " + str(datetime.datetime.now()))
                        else:
                            #the post creator based ones (FPR, UFPR)
                            post_from_post_creator = get_post_from_post_creator(array_of_all[index]["stringVal"], user_object_id, user_pub_id, posts_for_response, user_found["following"] if array_of_all[index]["stringVal"] == "~following" else None)
                            if post_from_post_creator == None:
                                #print("Posts from: " + array_of_all[index]["stringVal"] + " failed in get_post_from_post_creator")
                                continue
                            elif post_from_post_creator == "Blacklist":
                                black_list.append(array_of_all[index]["stringVal"])
                                continue
                            else: 
                                posts_for_response.append(str(post_from_post_creator))
                                print("Success")
                                print("AM5: " + str(datetime.datetime.now()))
            print("Done")
            #print(posts_for_response)
            print(str(json.dumps({"status" : "SUCCESS", "message" : "Done (python)", "data": posts_for_response})))
        else:
            print(json.dumps({"status" : "FAILED", "message" : "Couldn't find user in python."}))
    except Exception as E:
        print("Error occured in for you feed (python)")
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        #print(exc_type, fname, exc_tb.tb_lineno)
        #print(E)
        print(str(json.dumps({"status" : "FAILED", "message" : "Error occured in for you feed (python)"})))

main()
