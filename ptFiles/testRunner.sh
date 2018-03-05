#!/bin/bash

  # while true
  # do
    # Check time and run cleanup at top of hour
    now=`date +%s`
    hr=$(( ((now)/3600)*3600 ))

    delta=$(($now - $hr))
    #echo 'now: '$now' delta:'$delta

    #if [ "$(echo $DISPLAY)" != ":98" ]; then
    #if test $delta -lt 58 ; then
    if (( $delta < 58 )); then
       bash /FeTest/cleanup.sh
    fi



    testName='/FeTest/tests/test.json'


    if [ -s "$testName" ]
    then
      testCount=`ps -ef|grep [d]'umb-init nodejs /FeTest/performanceTest'|wc -l`


      #if test $chromedriverCount -lt 8; then
      if (( $testCount < 2 )); then
        /usr/local/bin/dumb-init nodejs /FeTest/performanceTest.js /FeTest/tests/test.json 1h run&
        sleep 45
      else
        sleep 60
      fi
    else
      killall nodejs
      sleep 60
    fi
  # done
