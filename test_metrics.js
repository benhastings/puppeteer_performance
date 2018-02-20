const urllib = require('url');
const http = require('http');
//******************************************************************************
//  Async function to capture Performance metrics
//  Types include:
//    'resource' - resourceTiming API & navigationTiming 2.0 API > > > RUM
//    'page' - navigationTiming 1.0 API & google paint timing > > > RUM
//    'memory' - capture memory observations
//    'user' - userTiming API (performance.mark)  > > > RUM
//    'metrics' - puppeteer page metrics not exposed out
//
// ******************************************************************************/
exports.collectMetrics = async function(page,testMeta,startTime,types){
  console.log('-- collectMetrics --')
  // console.log(testMeta,'testMeta')

  metrics={}

  //***********************************************************************
  //  Navigation Start
  let ns = JSON.parse(await page.evaluate(
        () => JSON.stringify(window.performance.timing.navigationStart)
      ));
  console.log('ns',ns)

  //***********************************************************************
  //  Resource Timing
  console.time('captureResources')
  let res = JSON.parse(await page.evaluate(
        () => JSON.stringify(window.performance.getEntriesByType('resource'))
      ));
  // Flush already captured resources
  await page.evaluate(() => window.performance.clearResourceTimings())

  let resource_object = parseResources(res)

  console.timeEnd('captureResources')
  // console.log(resource_object,'resource_object')


  //***********************************************************************
  //  Navigation Timing
  // nav=performance.getEntriesByType('navigation')[0]
  console.time('captureNav')
  const nav = JSON.parse(await page.evaluate(
        () => JSON.stringify(window.performance.getEntriesByType('navigation'))
      ));

  // console.log(nav[0])

  const navigation_object = navTiming(nav[0])
  console.timeEnd('captureNav')
  // console.log(navigation_object)

  // Add Navigation Timing to other Resources
  if(resource_object[navigation_object['host']]===undefined) resource_object[navigation_object['host']]=[]
  resource_object[navigation_object['host']].push(navigation_object['entry'])

  // metrics['resources']=resource_object
  //***********************************************************************
  // ----------------------------------------------------
  // Combine resources & page level timing
  startTime = startTime > 0 ? startTime : ns
  resLine=testMeta.product+"'"+testMeta.env+"'"+testMeta.pgNm+"'"+startTime+'!'
  for(s in resource_object){
    // console.log(s)
    resLine+=s+'('+resource_object[s].join('+')+')'
  }
  // console.log(resLine)
  metrics['resourceLine']=resLine
  // ----------------------------------------------------

  //***********************************************************************
  //  Paint Timing
  // paint_object = performance.getEntriesByType('paint') !== [] ? performance.getEntriesByType('paint') : []
  let paint_object = JSON.parse(await page.evaluate(
        () => JSON.stringify(window.performance.getEntriesByType('paint'))
      ));

  let memory = JSON.parse(await page.evaluate(
        () => JSON.stringify({'used':performance.memory.usedJSHeapSize,'total':performance.memory.usedJSHeapSize,'limit':performance.memory.jsHeapSizeLimit})
      ));

  page_object=timing(nav[0],paint_object,ns)
  page_object.send=testMeta.product+"'"+testMeta.env+"'"+testMeta.pgNm+'!'+page_object.send
  metrics['page']=page_object


  //***********************************************************************
  //  Browser Metrics
  let browserMetrics=await page.metrics()
  browserMetrics['memory']=memory

  let finalBrowserMetrics = browserProcess(browserMetrics,testMeta,ns)
  finalBrowserMetrics.send=testMeta.product+"'"+testMeta.env+"'"+testMeta.pgNm+'!'+finalBrowserMetrics.send
  metrics['browser']=finalBrowserMetrics
  //!!!!!!!!!!!!!!  Later !!!!!!!!!!!!!!!!!!
  // //***********************************************************************
  // //  User Timing
  // user = performance.getEntriesByType('mark') !== [] ? performance.getEntriesByType('mark') : []
  // for(p of user){
  //   console.log(p.name,Math.round(p.startTime))
  //
  // }

  console.log(Object.keys(metrics))
  return metrics

}

//***********************************************************************
//***********************************************************************
// Metrics Sending function
//  --- Only for puppeteer ---
//  -- use the add img element in RUM --
exports.sendMetrics = function(page,path,data){
  // console.log('--- in sendMetrics')

  // await page.evaluate((path,data) => window.navigator.sendBeacon(path,data) ) <-- Try again in a RUM environment

  options={
    hostname:'localhost',
    port:8080,
    method:'POST',
    path:path
  }

  req=http.request(options)
  req.write(data)
  req.end();

}



//***********************************************************************
//***********************************************************************
// Metrics Processing functions

// Browser Metrics
function browserProcess(browser_ob,meta,navStart){
  console.log('---test_metrics--- in browser metrics function')
  // console.log('browser_ob',browser_ob)
  // console.log('meta',meta)
  //
  b={}

  b.dom_nodes=browser_ob.Nodes;
  b.layout=browser_ob.LayoutCount+'-'+Math.round(browser_ob.LayoutDuration*1000);
  b.recalc_style=browser_ob.RecalcStyleCount+'-'+Math.round(browser_ob.RecalcStyleDuration*1000);
  b.scripts=Math.round(browser_ob.ScriptDuration*1000);
  b.js_event_listeners=browser_ob.JSEventListeners;
  b.task=Math.round(browser_ob.TaskDuration*1000);
  b.mem=browser_ob.memory.used+'-'+browser_ob.memory.total+'-'+browser_ob.memory.limit

  b.send=b.dom_nodes+"'"+b.layout+"'"+b.recalc_style+"'"+b.scripts+"'"+b.task+"'"+b.js_event_listeners+"'"+browser_ob.memory.used+"'"+browser_ob.memory.total+"'"+browser_ob.memory.limit
  //
  // tLine=navStart+"'"+t.red+"'"+t.dns+"'"+t.tcp+"'"+t.ttfb+"'"+t.html+"'"+t.fpaint+"'"+t.fpaintC+"'"+t.pgl
  //
  //
  // return {'timings':t,'send':tLine}

  return b

}

// Navigation Timing 1.0
function timing(nav_ob,paint,navStart){
  console.log('---test_metrics--- in timing metrics function')
  // console.log('nav_ob',nav_ob)
  // console.log('paint',paint)
  t={}
  t.red = Math.round(nav_ob.redirectEnd)
  t.dns = Math.round(nav_ob.domainLookupEnd)
  t.tcp = Math.round(nav_ob.connectEnd)
  t.ttfb = Math.round(nav_ob.responseStart)
  t.html = Math.round(nav_ob.responseEnd)
  t.pgl = Math.round(nav_ob.loadEventEnd)
  paint.map((p)=>{
    if(p.name.indexOf('contentful') > -1) { t.fpaintC = Math.round(p.startTime)}
    if(p.name.indexOf('contentful') == -1) {t.fpaint = Math.round(p.startTime)}
  })

  // console.log(t,'t in timing')

  tLine=navStart+"'"+t.red+"'"+t.dns+"'"+t.tcp+"'"+t.ttfb+"'"+t.html+"'"+t.fpaint+"'"+t.fpaintC+"'"+t.pgl


  return {'timings':t,'send':tLine}

}

// Navigation Timing 2.0
function navTiming(timingObject){
  console.log('---test_metrics--- in navTiming metrics function')
  t=timingObject
  // let p=new URL(nav.name) // <- for use in browser // RUM
  let p=urllib.parse(timingObject.name) // <- for use in puppeteer // nodeJS
  host=p.hostname
  pn=p.pathname.split('/')
  file_op=pn.pop()
  file_name = file_op !== '' ? file_op : pn.pop()
  file = file_name === '' ? 'root' : file_name

  file += '*'+Math.round(t.startTime*100)/100
  redS = Math.round(t.redirectStart)
  redE = Math.round(t.redirectEnd)
  dnsS = Math.round(t.domainLookupStart)
  dnsE = Math.round(t.domainLookupEnd)
  conS = Math.round(t.connectStart)
  conE = Math.round(t.connectEnd)
  reqS = Math.round(t.requestStart)
  resS = Math.round(t.responseStart)
  dur = Math.round(t.duration)
  file += "'"+redS+"'"+redE+"'"+dnsS+"'"+dnsE+"'"+conS+"'"+conE+"'"+reqS+"'"+resS+"'"+dur

  file += '*'+t.transferSize+"'"+t.encodedBodySize+"'"+t.decodedBodySize

  navigation_entry={'host':host,'entry':file}
  return navigation_entry
}


// Resource Timing API
function parseResources(res){
  console.log('---test_metrics--- in resourceTiming metrics function')
  let returnResources={}
  for(r of res){
    // console.log(r)
    // p=new URL(r.name) // for browser/RUM execution
    p=urllib.parse(r.name) // for nodeJS execution
    host=p.hostname
    if(returnResources[host]===undefined) returnResources[host]=[]

    pn=p.pathname.split('/')
    file_op=pn.pop()
    file = file_op !== '' ? file_op : pn.pop()
    file += '*'+Math.round(r.startTime*100)/100
    redS = r.redirectStart === 0 ? 0 : Math.round(r.redirectStart-r.startTime)
    redE = r.redirectEnd === 0 ? 0 : Math.round(r.redirectEnd-r.startTime)
    dnsS = r.domainLookupStart === 0 ? 0 : Math.round(r.domainLookupStart-r.startTime)
    dnsE = r.domainLookupEnd === 0 ? 0 : Math.round(r.domainLookupEnd-r.startTime)
    conS = r.connectStart === 0 ? 0 : Math.round(r.connectStart-r.startTime)
    conE = r.connectEnd === 0 ? 0 : Math.round(r.connectEnd-r.startTime)
    reqS = r.requestStart === 0 ? 0 : Math.round(r.requestStart-r.startTime)
    resS = r.responseStart === 0 ? 0 : Math.round(r.responseStart-r.startTime)
    dur = r.duration === 0 ? 0 : Math.round(r.duration)
    file += "'"+redS+"'"+redE+"'"+dnsS+"'"+dnsE+"'"+conS+"'"+conE+"'"+reqS+"'"+resS+"'"+dur

    // console.log(r.decodedBodySize,r.encodedBodySize,r.transferSize)
    if(r.transferSize !==0 && r.encodedBodySize !==0 && r.decodedBodySize !==0){
      file += '*'+r.transferSize+"'"+r.encodedBodySize+"'"+r.decodedBodySize
    }
    // console.log(file)
    returnResources[host].push(file)
  }

  return returnResources

}
