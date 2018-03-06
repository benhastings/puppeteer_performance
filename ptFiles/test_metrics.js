const urllib = require('url');
const http = require('http');
//******************************************************************************
//  Async function to capture Performance metrics
//  Types include:
//    'resource' - resourceTiming API & navigationTiming 2.0 API > > > RUM
//    'page' - navigationTiming 1.0 API & google paint timing > > > RUM
//    'memory' - capture memory observations
//    'user' - userTiming API (performance.mark)  > > > RUM
//    'metrics' - puppeteer page metrics not exposed by API
//
// ******************************************************************************/
exports.collectMetrics = async function(page,testMeta,startTime,navTimingRequested){
  const run_type=testMeta.loglevel
  if(run_type==='dev'){
    console.log('collectMetrics function :: navTimingRequested value', navTimingRequested)
    console.log('-- collectMetrics --')}
    console.time('collectMetricsFunction')
  // console.log(testMeta,'testMeta')

  metrics={}


  commonMetricBase=testMeta.product+"'"+testMeta.env+"'"+testMeta.pgNm+"'"+startTime+"'"+testMeta.sessID+'!'


  //***********************************************************************
  //  Navigation Start
  let ns = JSON.parse(await page.evaluate(
        () => JSON.stringify(window.performance.timing.navigationStart)
      ));
  if(run_type==='dev'){
    console.log('ns',ns)}

  //***********************************************************************
  //  Resource Timing
  if(run_type==='dev'){
    console.time('captureResources')}

  let res = JSON.parse(await page.evaluate(
        () => JSON.stringify(window.performance.getEntriesByType('resource'))
      ));
  // Flush already captured resources
  await page.evaluate(() => window.performance.clearResourceTimings())

  let resource_object = parseResources(res)
  if(run_type==='dev'){
    console.timeEnd('captureResources')}
  // console.log(resource_object,'resource_object')


  //***********************************************************************
  //  If a "hard" navigation event and page level timings requested
  //
  if(navTimingRequested===true){
    //***********************************************************************
    //  Navigation Timing
    // nav=performance.getEntriesByType('navigation')[0]
    if(run_type==='dev'){
      console.time('captureNav')}
    console.log('captureNav')
    console.time('captureNav')

    const nav = JSON.parse(await page.evaluate(
          () => JSON.stringify(window.performance.getEntriesByType('navigation'))
        ));

    // console.log(nav[0])

    const navigation_object = navTiming(nav[0])
    if(run_type==='dev'){
      console.timeEnd('captureNav')}
    console.timeEnd('captureNav')
    // console.log(navigation_object)

    // Add Navigation Timing to other Resources
    if(resource_object[navigation_object['host']]===undefined) resource_object[navigation_object['host']]=[]
    resource_object[navigation_object['host']].push(navigation_object['entry'])


    //***********************************************************************
    //  Paint Timing
    // paint_object = performance.getEntriesByType('paint') !== [] ? performance.getEntriesByType('paint') : []
    if(run_type==='dev'){
      console.time('capturePaint')}
    let paint_object = JSON.parse(await page.evaluate(
          () => JSON.stringify(window.performance.getEntriesByType('paint'))
        ));

    metrics['paint']=paint_object
    if(run_type==='dev'){
      console.time('capturePaint')}

    page_object=timing(nav[0],paint_object,ns)
    // page_object.send=testMeta.product+"'"+testMeta.env+"'"+testMeta.pgNm+"'"+startTime+"'"+testMeta.sessID+'!'+page_object.send
    page_object.send=commonMetricBase+page_object.send
    metrics['page']=page_object


  }
  // metrics['resources']=resource_object
  //***********************************************************************
  // ----------------------------------------------------
  // Combine resources & page level timing
  startTime = startTime > 0 ? startTime : ns
  // resLine=testMeta.product+"'"+testMeta.env+"'"+testMeta.pgNm+"'"+startTime+"'"+testMeta.sessID+'!'
  resLine=commonMetricBase
  for(s in resource_object){
    // console.log(s)
    resLine+=s+'('+resource_object[s].join('+')+')'
  }
  // console.log(resLine)
  metrics['resourceLine']=resLine
  // ----------------------------------------------------


  //***********************************************************************
  //  User Timing
  // paint_object = performance.getEntriesByType('paint') !== [] ? performance.getEntriesByType('paint') : []
  if(run_type==='dev'){
    console.time('captureUserMarks')}
    let user_marks=[]
    user_marks = JSON.parse(await page.evaluate(
        () => JSON.stringify(window.performance.getEntriesByType('mark'))
      ));
    console.log('user_marks',user_marks)
    // Flush already captured resources
    await page.evaluate(() => window.performance.clearMarks())
  if(user_marks.length>0){
    userTStr=commonMetricBase
    console.log('user_marks',user_marks)
    for(m in user_marks){
      name=user_marks[m].name.replace(/:/g,'__')
      ts=Math.round(user_marks[m].startTime)
      console.log('user mark\t',name,ts)
      if(ts > 0){
        userTStr+=name+'-'+ts
      }
      if(m < user_marks.length-1){userTStr+="'"}
    }
    console.log(userTStr)
    metrics['userString']=userTStr
  }





  //***********************************************************************
  //  Browser Metrics
  let browserMetrics=await page.metrics()
  let memory = JSON.parse(await page.evaluate(
        () => JSON.stringify({'used':performance.memory.usedJSHeapSize,'total':performance.memory.usedJSHeapSize,'limit':performance.memory.jsHeapSizeLimit})
      ));
  browserMetrics['memory']=memory

  // let domLevels = await page.evaluate(
  //   () =>{
  //     function getNestedLevel (el) {var level = 0;while (el = el.parentNode) {level++;}return level;}
  //     levels=[].slice.call(document.querySelectorAll('*'))
  //       .map(function (el) {return getNestedLevel(el)})
  //       .sort((a,b)=>{return a-b});
  //     return levels
  //     // JSON.stringify(levels)
  //   }
  // )
  // browserMetrics['domLevels']=domLevels

  let finalBrowserMetrics = browserProcess(browserMetrics,testMeta,ns)
  // finalBrowserMetrics.send=testMeta.product+"'"+testMeta.env+"'"+testMeta.pgNm+"'"+ns+"'"+testMeta.sessID+'!'+finalBrowserMetrics.send
  finalBrowserMetrics.send=commonMetricBase+finalBrowserMetrics.send

  metrics['browser']=finalBrowserMetrics
  //!!!!!!!!!!!!!!  Later !!!!!!!!!!!!!!!!!!
  // //***********************************************************************
  // //  User Timing
  // user = performance.getEntriesByType('mark') !== [] ? performance.getEntriesByType('mark') : []
  // for(p of user){
  //   console.log(p.name,Math.round(p.startTime))
  //
  // }

  if(run_type==='dev'){
    console.time('collectMetricsFunction')
    console.log(Object.keys(metrics))}

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
    port:18081,
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

// //=====================================================================
// //  Helper functions to quantify DOM Depth
// function quantileOfSorted(array, percentile) {
//   console.time('percentile'+percentile)
//   index = percentile/100. * (array.length-1);
//   console.timeEnd('percentile'+percentile)
//   return array[Math.round(index)]
// }
// // Simple average or mean calculation
// function getAverage (arr) {
//   return arr.reduce(function (prev, cur) {
//     return prev + cur;
//   }) / arr.length;
// }
// Combine functions to caluculate DOM depth statistics
// function calculateDomDepth (levelsArray) {
//   console.time('totalDomDepthCalc')
//   // var all = [].slice.call(document.querySelectorAll('*'));
//   // var levels = all.map(function (el) {
//   //   return getNestedLevel(el);
//   //   })
//   var levels=levelsArray.sort((a,b)=>{return a-b});
//
//   var mean=Math.round(getAverage(levels))
//
//   console.timeEnd('totalDomDepthCalc')
//
//   return({'total':all.length,'max':levels[levels.length-1],'mean':mean,'median':quantileOfSorted(levels,50),'p90':quantileOfSorted(levels,90)})
// }
// Browser Metrics
function browserProcess(browser_ob,meta,navStart){
  if(run_type==='dev'){
    console.log('---test_metrics--- in browser metrics function')}
  // console.log('browser_ob',browser_ob)
  // console.log('meta',meta)
  //
  b={}


// depths=calculateDomDepth()
// console.log('test_metrics::browserProcess::domDepth',depths)


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

// Navigation Timing 1.0
function timing(nav_ob,paint,navStart){
  if(run_type==='dev'){
    console.log('---test_metrics--- in timing metrics function')}
  // console.log('nav_ob',nav_ob)
  // console.log('paint',paint)
  t={}
  t.red = Math.round(nav_ob.redirectEnd)
  t.dns = Math.round(nav_ob.domainLookupEnd)
  t.tcp = Math.round(nav_ob.connectEnd)
  t.ttfb = Math.round(nav_ob.responseStart)
  t.html = Math.round(nav_ob.responseEnd)
  t.pgl = Math.round(nav_ob.loadEventEnd)
  paint.map((p)=>{  // works fine for chrome only - not a solution for RUM
    if(p.name.indexOf('contentful') > -1) { t.fpaintC = Math.round(p.startTime)}
    if(p.name.indexOf('contentful') == -1) {t.fpaint = Math.round(p.startTime)}
  })

  // console.log(t,'t in timing')

  tLine=navStart+"'"+t.red+"'"+t.dns+"'"+t.tcp+"'"+t.ttfb+"'"+t.html+"'"+t.fpaint+"'"+t.fpaintC+"'"+t.pgl


  return {'timings':t,'send':tLine}

}

// Navigation Timing 2.0
function navTiming(timingObject){
  if(run_type==='dev'){
    console.log('---test_metrics--- in navTiming metrics function')}
  t=timingObject
  // let p=new URL(nav.name) // <- for use in browser // RUM
  let p=urllib.parse(timingObject.name) // <- for use in puppeteer // nodeJS
  // console.log('navTiming url:',p)
  host=p.hostname
  pn=p.pathname !== null && p.pathname !== undefined ? p.pathname.split('/') : ['']
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
  file += '*11' // add identifier for HTML resource
  file += '*'+t.transferSize+"'"+t.encodedBodySize+"'"+t.decodedBodySize

  navigation_entry={'host':host,'entry':file}
  return navigation_entry
}

typeMapSend = {
    css: 0,
    img: 1,
    link: 2,
    script: 3,
    xmlhttprequest: 4,
    xmlhttprequest: 4,
    frame: 5,
    iframe: 5,
    embed: 5,
    object: 6,
    subdocument: 7,
    svg: 8,
    other: 9,
    beacon:10,
    html:11
};
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

// Resource Timing API
function parseResources(res){
  if(run_type==='dev'){
    console.log('---test_metrics--- in resourceTiming metrics function')}
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
    if(file.indexOf('%')){
      file=file.split('%').pop()
    }
    if(file.indexOf(',')){
      file=file.split(',').pop()
    }
    if(file.indexOf('=')){
      file=file.split('=').pop()
    }

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

    res_type_idx = typeMapSend[r.initiatorType] !== undefined ? typeMapSend[r.initiatorType] : '9'
    if(res_type_idx === '9'){
      console.log('\n-- novel initiatorType ::',r.initiatorType,'--\n')
    }
    file += '*'+res_type_idx

    // console.log(r.decodedBodySize,r.encodedBodySize,r.transferSize)
    if(r.transferSize !==0 && r.encodedBodySize !==0 && r.decodedBodySize !==0){
      file += '*'+r.transferSize+"'"+r.encodedBodySize+"'"+r.decodedBodySize
    }
    // console.log(file)
    returnResources[host].push(file)
  }

  // console.log(JSON.stringify(returnResources))

  return returnResources

}
