FROM node:16
WORKDIR /server
COPY  package*.json /server/
RUN mkdir Local-Images
RUN yarn install --network-timeout 100000
COPY . /server/
CMD ["yarn", "start"]

#FROM python:3.10 AS build

#WORKDIR /server
#RUN python3 -m venv /server/python_venv

#COPY requirements.txt .
#RUN . /server/python_venv/bin/activate && pip install -r requirements.txt

#working for python is double ##
##FROM nikolaik/python-nodejs:latest

#RUN apt update -y \
    #&& apt install software-properties-common -y \
    #&& apt update -y \
    #&& apt install python -y
#RUN apt-get update || : && apt-get install python3 -y
#RUN apt-get install -y python-pymongo
#RUN apt-get install -y python3-dotenv-cli
#RUN apt-get install -y python3-dotenv
##COPY requirements.txt .
##RUN pip install -r requirements.txt
##WORKDIR /server
#COPY --from=build /server/python_venv /server/python_venv
##ENV PATH="/server/python_venv/bin:$PATH"
#ENV PYTHONPATH="/server/python_venv/bin:$PATH"
#ENV NODE_ENV=container
##COPY  package*.json /server
##RUN mkdir Local-Images
##RUN yarn install --network-timeout 100000
##COPY . /server
##CMD ["yarn", "start"]
#CMD ["npm", "run", "dev"]