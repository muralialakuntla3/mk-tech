#!/bin/bash
echo "deployment started"
git pull
docker container rm -f mk
docker build -t mk .
docker container run -dt --name mk -p 80:80 mk
echo "deployment done"