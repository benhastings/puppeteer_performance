#!/bin/bash
imageName='helios_beacon_catcher'

imgCount=$((`docker ps|grep $imageName|wc -l`))
# if [ -s "$testName" ]
# then

  if [ "$imgCount" -eq "0" ]; then
    echo "nothing's running... start it up!"
    docker run --rm --name helios_beacon_catcher -h `hostname`  -p 18081:18081 -v /var/log:/common -d -t docker.fmr.com/fmr-ap116455/helios_beacon_catcher
  elif [ "$imgCount" -gt "1" ]; then
    echo "woah, there!  too many clowns for this rodeo!"
    docker stop $(docker ps -q)
  else
    echo "move along..."
  fi

#docker run --rm --name helios_performance_test -h `hostname` -v /dev/shm:/dev/shm -v /var/log:/FeTest/log -p 8090:8090 -it docker.fmr.com/fmr-ap116455/helios_performance_test:latest /bin/bash
