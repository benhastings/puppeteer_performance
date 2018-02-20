var http = require('http');
var querystring = require('querystring');

var server = http.createServer().listen(8080);
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

        res.writeHead(204)
        res.end();

        console.log(req.url)
        console.log(body.substr(0,200));
        if(req.url.indexOf('/resource') > -1){
          console.log('resource time!')
          console.time('processResource')
          processResource(body)
          console.timeEnd('processResource')
        }

        if(req.url.indexOf('/page') > -1){
          console.log('page time!')
          console.time('processPage')
          processPage(body)
          console.timeEnd('processPage')
        }

        if(req.url.indexOf('/browser') > -1){
          console.log('browser time!')
          console.time('processBrowser')
          processBrowser(body)
          console.timeEnd('processBrowser')
        }

        if(req.url.indexOf('/user') > -1){
          console.log('user time!')
          console.time('processUserT')
          processUserT(body)
          console.timeEnd('processUserT')
        }
    });
});

console.log('Listening on port 8080');
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
  console.log(resStr)

  metrics=resStr.split('!')
  meta=metrics[0].split("'")
  perf=metrics[1].split("'")
  console.log('meta:',meta,'\nperf:',perf)

  let userSend=[]
  // console.log('db=',meta[0])
  for(p of perf){
    m=p.split('-')
      // console.log('\t\t',timers[t],currOb.perf[t])
      sendLine='user,env='+meta[1]+',pgNm='+meta[2]+',metric='+m[0]+' value='+m[1]+'i '+meta[3]+'\n'
      // console.log(sendLine)
      userSend.push(sendLine)

  }


  console.log('-- userSend --',userSend)

  //  To be completed for sending to an influxDB endpoint
  // influxSend(sendLine,meta)


}

//------------------------------------------------------------------------------
// Process page/navigationTiming data
function processPage(resStr){

  console.log('-- processPage --')
  // console.log(resStr)
  resourcesOb={}
  metrics=resStr.split('!')
  meta=metrics[0].split("'")
  perf=metrics[1].split("'")

  let pageSend=[]
  // console.log('db=',meta[0])
  for(t in timers){
    if(perf[t] > 0 && t > 0){
      // console.log('\t\t',timers[t],currOb.perf[t])
      sendLine='w3cpage,env='+meta[1]+',pgNm='+meta[2]+',metric='+timers[t]+' value='+perf[t]+'i '+perf[0]+'\n'
      // console.log(sendLine)
      pageSend.push(sendLine)
    }
  }


  console.log(pageSend)

  //  To be completed for sending to an influxDB endpoint
  // influxSend(sendLine,meta)


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
  // console.log(resStr)
  resourcesOb={}
  metrics=resStr.split('!')
  meta=metrics[0].split("'")
  perf=metrics[1].split("'")

  let pageSend=[]

  sendLine='browser,env='+meta[1]+',pgNm='+meta[2]+' '



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
  console.log(sendLine)
  return sendLine
  //  To be completed for sending to an influxDB endpoint
  // influxSend(sendLine,meta)


}





//------------------------------------------------------------------------------
// Process resourceTiming data
function processResource(resStr){

  console.log('-- processResource --')
  // console.log(resStr)
  resourcesOb={}
  metrics=resStr.split('!')
  meta=metrics[0].split("'")
  dom=metrics[1].split(')')
  for(d of dom){
    // console.log(d)
    dn=d.split('(')[0]
    resourcesOb[dn]={}
    dentriesEnc=d.substr(d.indexOf('(')+1,)
    // console.log(dn)
    // console.log(dentries)
    dentries=dentriesEnc.split('+')
    // console.log(dentries)

    for(e of dentries){
      row=e.split('*')
      if(row.length > 1){
        file=row[0]
        perf=row[1].split("'")

        resourcesOb[dn][file]={'perf':perf}
        if(row[2]) {resourcesOb[dn][file]['bytes']=row[2].split("'")}
      }
    }
  }
  // console.log(resourcesOb)
  // console.log(JSON.stringify(resourcesOb))
  let resourceSend=[]
  // console.log('db=',meta[0])
  for(r in resourcesOb){
    // console.log(r);
    for(p in resourcesOb[r]){
      currOb=resourcesOb[r][p]
      // console.log('\t',p)
      for(t in timers){
        if(currOb.perf[t] > 0){
          // console.log('\t\t',timers[t],currOb.perf[t])
          sendLine='resources,env='+meta[1]+',pgNm='+meta[2]+',host='+r+',file='+p+',metric='+timers[t]+' value='+currOb.perf[t]+' '+meta[3]+'\n'
          // console.log(sendLine)
          resourceSend.push(sendLine)
        }
      }
    }
  }

  console.log(resourceSend.length,resourceSend[0],'...',resourceSend[resourceSend.length-1])

  //  To be completed for sending to an influxDB endpoint
  // influxSend(sendLine,meta)


}
