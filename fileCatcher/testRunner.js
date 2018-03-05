var exports = module.exports= {}
const fs = require('fs');
// const put=require('./sftpFunctions').sftpTextToFile

let base='-- testRunner.';

 function createScript (userCount) {
   let funNm=base+'createScript'
   console.log(funNm)
  nowStr="`date +%s`"
  testGrep="`ps -ef|grep [d]'umb-init nodejs /FeTest/performanceTest'|wc -l`"
  return `#!/bin/bash

  #while true
  #do
    # Check time and run cleanup at top of hour
    now=${nowStr}
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
      testCount=${testGrep}


      #if test $chromedriverCount -lt 8; then
      if (( $testCount < ${userCount} )); then
        /usr/local/bin/dumb-init nodejs /FeTest/performanceTest.js /FeTest/tests/test.json 1h run&
        sleep 45
      else
        sleep 60
      fi
    else
      killall nodejs
      sleep 60
    fi
  #done
  `
}

exports.createTestRunnerScript = function(userCount){
  let funNm=base+'createTestRunnerScript'
  console.log(funNm)

  // fs.writeFile('/FeTest/tests/testRunner.sh',createScript(userCount))
  return new Promise((fulfill,reject)=>{
    fs.writeFile('/FeTest/tests/testRunner.sh',createScript(userCount),(err)=>{
      if(err){console.log(err);reject('failure')}//return 'failure'}
      if(!err){fulfill('success')}//{return 'success'}
    })
  })
}
