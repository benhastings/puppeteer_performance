// var http = require('http');
var https = require('https')
var querystring = require('querystring');

const PORT = 18081;
hgKey = process.argv[2] !== undefined ? process.argv[2] : 'influxdb.XXX.com'

console.log(hgKey)

DEBUG=true

var key = fs.readFileSync('encryption/private.key');
var cert = fs.readFileSync( 'encryption/beaconCatcher.crt' );
var ca = fs.readFileSync( 'encryption/intermediate.crt' );

//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
//  Make this multi-threaded with cluster!!
//
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

// Create server
var server = http.createServer().listen(PORT,()=>{
    console.log("server lisetning on http://localhost:%s",PORT)
});


//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!



//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
//  Magic Happens Here
//
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// Server Definition
server.on('request', function (req, res) {
    if (req.method == 'POST') {
        var body = '';
    }

    req.on('data', function (data) {
        body += data;
    });

    req.on('end', function () {
        // var post = querystring.parse(body);

        if(req.url==='/'){
          res.writeHead(200)
          res.write('ok')
          res.end()
        } else if (req.url==='/favicon.ico') {
          res.writeHead(204)
          res.end()
        } else {

        res.writeHead(204)
        res.end();

        console.log(req.url)
        // console.log(body.substr(0,200));
        if(req.url.indexOf('/resource') > -1){
          console.log('\nresource time!')
          console.log('payload length:',body.length,'\n\tbeginning:',body.substr(0,200))
          console.time('processResource')
          processResource(body)
          console.timeEnd('processResource')
        }

        if(req.url.indexOf('/page') > -1){
          console.log('\npage time!')
          console.log('payload length:',body.length,'\n\tbeginning:',body.substr(0,200))
          console.time('processPage')
          processPage(body)
          console.timeEnd('processPage')
        }

        if(req.url.indexOf('/browser') > -1){
          console.log('\nbrowser time!')
          console.log('payload length:',body.length,'\n\tbeginning:',body.substr(0,200))
          console.time('processBrowser')
          processBrowser(body)
          console.timeEnd('processBrowser')
        }

        if(req.url.indexOf('/user') > -1){
          console.log('\nuser time!')
          console.log('payload length:',body.length,'\n\tbeginning:',body.substr(0,200))
          console.time('processUserT')
          processUserT(body)
          console.timeEnd('processUserT')
        }

        if(req.url.indexOf('/errors') > -1){
          console.log('\nerror time!')
          console.log('payload length:',body.length,'\n\tbeginning:',body.substr(0,200))
          console.time('processError')
          processError(body)
          console.timeEnd('processError')
        }

      }

    });
});

// console.log('Listening on port 8080');
//------------------------------------------------------------------------------
// default timer placement mapping
timers={
  '0':'startTime',
  '1':'redirectStart',
  '2':'redirectEnd',
  '3':'dnsStart',
  '4':'dnsEnd',
  '5':'tcpStart',
  '6':'tcpEnd',
  '7':'requestStart',
  '8':'responseStart',
  '9':'duration'
}

//------------------------------------------------------------------------------
// Process userTiming data
function processUserT(resStr){

  console.log('-- processUserT --')
  if(DEBUG===true){
    console.log('user resStr',resStr)}

  metrics=resStr.split('!')
  meta=metrics[0].split("'")
  perf=metrics[1].split("'")
  // console.log('meta:',meta,'\nperf:',perf)

  if(meta[0].indexOf('_pt_') > -1){
    product=meta[0].substr(4,)
    sendBase='timers_pt'
  } else {
    product=meta[0]
    sendBase='timers'
  }

  sessID = meta[4] !== undefined ? meta[4] : ''

  let userSend=[]
  // console.log('db=',meta[0])
  for(p of perf){
    m=p.split('-')
      // console.log('\t\t',timers[t],currOb.perf[t])
      //---- Don't add session id in influx -----
      // sendLine=sendBase+',env='+meta[1]+',pgNm='+meta[2]+',sessId='+sessID+',metric='+m[0]+' uxt='+m[1]+'i '+meta[3]+'\n'
      sendLine=sendBase+',env='+meta[1]+',pgNm='+meta[2]+',metric='+m[0]+' uxt='+m[1]+'i '+meta[3]+'\n'
      // console.log(sendLine)
      userSend.push(sendLine)

  }

  if(DEBUG===true){
    console.log('-- userSend --',userSend[0])}

  //  To be completed for sending to an influxDB endpoint
  // influxSend(userSend,meta[0],'user')
  influxSend(userSend,product,'user')

  return true


}

//------------------------------------------------------------------------------
// Process Errors
function processError(resStr){

  console.log('-- processError --')
  if(DEBUG===true){
    console.log('error resStr',resStr)}

  incoming=resStr.split("!")
  meta=incoming[0].split("'")
  data=incoming[1].split("'")

  if(meta[0].indexOf('_pt_') > -1){
    product=meta[0].substr(4,)
    sendBase='errors_pt'
  } else {
    product=meta[0]
    sendBase='errors'
  }

  sessID = meta[4] !== undefined ? meta[4] : ''


  let errorSend=[]

  //--- No session id in Influx -----
  // sendLine=sendBase+',env='+meta[1]+',action='+meta[2]+',pgNm='+meta[3]+',sessId='+sessID
  sendLine=sendBase+',env='+meta[1]+',action='+meta[2]+',pgNm='+meta[3]
  if(data.length > 1){
    if(data[0]==='timeout'){
      error='timeout'
      if(data[0].indexOf('nav')){
        type='nav'
      } else if (data[0].indexOf('wait')) {
        type='wait'
      } else{
        type='other'
      }
      sendLine+=',error='+error+',type='+type+' count=1,value='+data[1]
    } else {
      sendLine+=',error=unhandled count=1'
    }
  } else {
    sendLine+=',error=unhandled count=1'
  }

  sendLine+=' '+meta[5]+'\n'
  // console.log(sendLine)
  errorSend.push(sendLine)



  if(DEBUG===true){
    console.log('-- errorSend --',errorSend[0])}

  //  To be completed for sending to an influxDB endpoint
  // influxSend(userSend,meta[0],'user')
  influxSend(errorSend,product,'error')

  return true


}

pg_timers={
  '0':'navigationStart',
  '1':'redirect',
  '2':'dns',
  '3':'tcp',
  '4':'ttfb',
  '5':'html',
  '6':'fpaint',
  '7':'fpaintC',
  '8':'pgl'
}
//------------------------------------------------------------------------------
// Process page/navigationTiming data
function processPage(resStr){

  console.log('-- processPage --')
  if(DEBUG===true){
    console.log(resStr)}

  metrics=resStr.split('!')
  meta=metrics[0].split("'")
  perf=metrics[1].split("'")

  if(meta[0].indexOf('_pt_') > -1){
    product=meta[0].substr(4,)
    sendBase='w3cpage_pt'
  } else {
    product=meta[0]
    sendBase='w3cpage'
  }

  sessID = meta[4] !== undefined ? meta[4] : ''

  let pageSend=[]
  // console.log('db=',meta[0])
  for(t in pg_timers){
    if(perf[t] > 0 && t > 0){
      // console.log('\t\t',timers[t],currOb.perf[t])
      // No session id in influx!
      // sendLine=sendBase+',env='+meta[1]+',pgNm='+meta[2]+',sessId='+sessID+',metric='+pg_timers[t]+' value='+perf[t]+'i '+perf[0]+'\n'
      sendLine=sendBase+',env='+meta[1]+',pgNm='+meta[2]+',metric='+pg_timers[t]+' value='+perf[t]+'i '+perf[0]+'\n'
      // console.log(sendLine)
      pageSend.push(sendLine)
    }
  }

  if(DEBUG===true){
    console.log(pageSend[0])}

  //  To be completed for sending to an influxDB endpoint
  // influxSend(pageSend,meta[0],'page')
  influxSend(pageSend,product,'page')

  return true



}
//------------------------------------------------------------------------------
//  Browser data metrics map
// "browser":{"dom_nodes":3209,"layout":"49-0.212","recalc_style":"67-0.102","scripts":0.337,"js_event_listeners":261,"task":0.832,"mem":"12809840-12812600-2181038080"}
browserMetrics={
  '0':'dom_nodes',
  '1':'layout',
  '2':'recalc_style',
  '3':'scripts',
  '4':'task',
  '5':'js_event_listeners',
  '6':'mem_used',
  '7':'mem_total',
  '8':'mem_limit'
}
//------------------------------------------------------------------------------
// Process browser data
function processBrowser(resStr){

  console.log('-- processBrowser --')
  if(DEBUG===true){
    console.log(resStr)}

  metrics=resStr.split('!')
  meta=metrics[0].split("'")
  perf=metrics[1].split("'")

  if(meta[0].indexOf('_pt_') > -1){
    product=meta[0].substr(4,)
    sendBase='browser_pt'
  } else {
    product=meta[0]
    sendBase='browser'
  }

  sessID = meta[4] !== undefined ? meta[4] : ''

  let browserSend=[]

  //--- Don't add session id in influx ----
  // sendLine=sendBase+',env='+meta[1]+',pgNm='+meta[2]+',sessId='+sessID+' '
  sendLine=sendBase+',env='+meta[1]+',pgNm='+meta[2]+' '


  // console.log('db=',meta[0])
  for(b in browserMetrics){
    if(perf[b].indexOf('-') > -1){
      entry=perf[b].split('-')
      sendLine+=browserMetrics[b]+'_count='+entry[0]+'i,'+browserMetrics[b]+'_time='+entry[1]+'i'
    } else {
      sendLine+=browserMetrics[b]+'='+perf[b]+'i'
    }
    if(b < 8) {
      sendLine+=','
    } else {
      sendLine+=' '+meta[3]+'\n'
    }

  }
  if(DEBUG===true){
    console.log(sendLine)}
  browserSend.push(sendLine)

  //  To be completed for sending to an influxDB endpoint
  // influxSend(browserSend,meta[0],'browser')
  influxSend(browserSend,product,'browser')

  return true

}


//------------------------------------------------------------------------------
// Resource Timing Type map
typeMapRcv = {
    0:'css',
    1:'img',
    2:'link',
    3:'script',
    4:'xhr',
    5:'frame',
    6:'object',
    7:'subdocument',
    8:'svg',
    9:'other',
    10:'beacon',
    11:'html'
};

//------------------------------------------------------------------------------
// Process resourceTiming data
function processResource(resStr){

  console.log('-- processResource --')
  if(DEBUG===true){
    console.log(resStr)}

  metrics=resStr.split('!')
  meta=metrics[0].split("'")

  if(meta[0].indexOf('_pt_') > -1){
    product=meta[0].substr(4,)
    // sendBase='browser_pt'
  } else {
    product=meta[0]
    // sendBase='browser'
  }

  sessID = meta[4] !== undefined ? meta[4] : ''

  dom=metrics[1].split(')')
  let resourceSend=[]
  let resourceSum={}

  for(d of dom){
    // console.log(d)
    hostname=d.split('(')[0]
    // console.log(hostname)
    dentriesEnc=d.substr(d.indexOf('(')+1,)
    dentries=dentriesEnc.split('+')

    // console.log('dentries\n',dentries,'\n\n')

    for(r of dentries){
      if(r.length > 0){
        // console.log('r',r.length,r);
        row=r.split('*');
        if(row.length > 1){
          // console.log(row)
          res_type=typeMapRcv[row[2]] !== undefined ? typeMapRcv[row[2]] : 'other'

          // //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
          // //!!!!! Diagnostic/Discovery !!!!!!
          if(DEBUG===true){
            if(res_type === 'other'){
              console.log('\n\n!!!!!!!!-----------',row[2],typeMapRcv[row[2]],res_type,'\n\t',r,'-------------------')
            }
          }
          // //!!!!! Diagnostic/Discovery !!!!!!
          // //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

          if(resourceSum[res_type]===undefined){
            resourceSum[res_type]={count:1,bytes_c:0,bytes_d:0,total_time:0}
          } else {
            resourceSum[res_type]['count']+=1
          }


          sendLine='resources,env='+meta[1]+',pgNm='+meta[2]+',host='+hostname


          fileName= row[0] !== '' ? row[0] : 'blank'
          //--- Don't add session id in influx ----
          // sendLine+=',file='+fileName+',res_type='+res_type+',sessId='+sessID
          sendLine+=',file='+fileName+',res_type='+res_type



          perf=row[1].split("'")
          for(t in timers){
            // console.log(t,typeof(t))
            if(t === '0'){
              // console.log(hostname,fileName,perf[t])
              sendLine+=' startTime='+perf[t]
            } else {
              if(perf[t]>0){
                  sendLine+=','+timers[t]+'='+perf[t]+'i'
              }
              if(timers[t]==='duration'){
                resourceSum[res_type]['total_time']+= +perf[t]
              }
            }

          }

          if(row[3]!== undefined){
            // console.log('\t\tbytes-',row[2])
            bytes=row[3].split("'")
            if(bytes.length == 3){
              // console.log(res_type,fileName,bytes,bytes[0],bytes[1],bytes[2],resourceSum[res_type])
              sendLine+=',bytes_total='+bytes[0]+'i,bytes_enc='+bytes[1]+'i,bytes='+bytes[2]+'i'
              resourceSum[res_type]['bytes_d'] += +bytes[2]
              resourceSum[res_type]['bytes_c'] += +bytes[1]
              // console.log(resourceSum[res_type])
            }
          }
          sendLine+=' '+meta[3]+'\n'
          if(DEBUG===true){
            console.log(sendLine.substr(0,100))}
          // console.log('sendLine --',sendLine)
          resourceSend.push(sendLine)
        }
      }
    }


  }
  // console.log('resourceSum >>>>>',resourceSum,'<<<<< resourceSum')
  // console.log(resourceSend.length,resourceSend[0],'...',resourceSend[resourceSend.length-1])

  //  To be completed for sending to an influxDB endpoint

  influxSend(resourceSend,product,'resources')


  resourceSumSend=[]
  //--- Don't add session id in influx ----
  // resSumBase='res_sum,env='+meta[1]+',pgNm='+meta[2]+',sessId='+sessID
  resSumBase='res_sum,env='+meta[1]+',pgNm='+meta[2]
  for(e in resourceSum){
    entry=resourceSum[e]
    // console.log(e,entry)
    let resSumLine = resSumBase+',res_type='+e+' count='+entry.count+'i,total_time='+entry.total_time+'i'
    if(entry.bytes_c > 0) resSumLine+=',bytes_c='+entry.bytes_c+'i'
    if(entry.bytes_d > 0) resSumLine+=',bytes_d='+entry.bytes_d+'i'

    resSumLine += ' '+meta[3]+'\n'
    resourceSumSend.push(resSumLine)
  }

  // console.log(resourceSumSend)
  influxSend(resourceSumSend,product,'resource_sum')

}


function influxSend(metricsArray,productName,metricType){
  if(DEBUG===true){
    console.log(metricsArray[0],metricsArray[metricsArray.length-1],'\n--influxSend')}
  toSend=metricsArray.join('')

  // console.log(toSend,metricType)

  // console.log('influxSend: '+metricType+' - \n',toSend)
  // convert message and post to influx
   //var toPost = querystring.stringify(toSend)
   var post_options = {
    // host:'influxdb.fmr.com',
    host:hgKey,
    port:'8086',
    path:'/write?db='+productName+'&precision=ms',
    method: 'POST',
    headers:{
      'Content-Type':'application/x-www-form-urlencoded',
      'Content-Length':Buffer.byteLength(toSend)
    }

   };


   var post_req =http.request(post_options, function(res){
     message=''
     res.on('data', function(d){

       console.log('res.statusCode',res.statusCode)

       // handle non-existing DB error
       // if(res.statusCode==404 && d.indexOf('database not found')>-1){
       if(res.statusCode==404){
          console.log('requested db not found... create it')
           // http://localhost:8086/query --data-urlencode "q=CREATE DATABASE mydb"
          url="http://"+hgKey+":8086/query?q=CREATE%20DATABASE%20";
          if(metricType!=='pii'){
            url=url+productName;
          } else {
            url=url+'piiAlert';
          }
          console.log(url)
          http.get(url,(res) => {
            console.log(`Got response: ${res.statusCode}`);
            // consume response body
            res.resume();
          }).on('error', (e) => {
            console.log(`Got error: ${e.message}`);
          });
       }

       message+=d

     })

     res.on('end',()=>{
       if(res.statusCode === 400){
         console.log('HTTP 400 - message:',message,'product -',productName,'type -',metricType)
       }
     })
   });

   // console.log(toSend.substr(0,200))
   post_req.write(toSend)
   post_req.end()
   if(DEBUG===true){
     console.log(toSend.substr(0,100),'\n-- metric type',metricType)}

}
