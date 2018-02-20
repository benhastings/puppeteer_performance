
/*============================================================================

  To do:
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  4.  capture metrics to return
      f.  domTreeDepth
      g.  userTiming API metrics
      h.  resources summary <-- In progress !!!!
  5.  waitFor more than just a single element/configurability - leverage waitFor functionality or <element>:<count> type structures.  maybe page.$x(...) & length
  8.  iframe navigation
  9.  dynamic logging
  10. package for distribution to docker
  11. package for distribution to windows // Look at: https://github.com/zeit/pkg, https://github.com/nexe/nexe,http://enclosejs.com/
  12. define duration/looping structure
  13. update documentation for test definition!!
  14. handle random input
      a.  accept array of input values
      b.  choose random value in list
  15. handle clicking random value from list of elements returned.
  20. Abstract "findElement" to functions
  22. Adjust capturePageMetrics to accept requests seeking only partial metrics - e.g. just page.metrics, not nav/resource/paint/user timing APIs
  24. Loop through test definition until requested duration has elapsed
  25. Screenshot & logging for run/dev views for testing
  26. run = headless:false || dev = headless:true
  27. decide on default slowMo setting || completely configurable

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

  Done:
  1.  build test and run  :: 2018-Feb-10
  2.  accept testDefiniton and run steps :: 2018-Feb-12
  3.  send metrics to beaconHost or directly to influxDB :: 2018-Feb-19
  4.  capture metrics to return
      a.  navigationTiming :: 2018-Feb-18
      b.  resourceTiming  :: 2018-Feb-18
      c.  paintTiming :: 2018-Feb-18
      d.  memory  :: 2018-Feb-15
      e.  domcount  :: 2018-Feb-09
  6.  Solve SSO functionality :: 2018-Feb-09
  7.  read dynamic test definition (probably commandline) :: 2018-Feb-14
  16. handle navigation actions :: 2018-Feb-13
  17. handle click actions :: 2018-Feb-13
  18. handle enterText actions :: 2018-Feb-14
  21. handle hover actions :: 2018-Feb-13
  23. Ensure test stops with browser closing after final step :: 2018-Feb-14
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

_________________________________________________________________
  Deferred:
  19. handle chains of actions :: 2018-Feb-13 >>> ActionChains were a requirement for correct Selenium operation.  Doesn't appear necessary for puppeteer!!
_________________________________________________________________

============================================================================*/

/*=======================================
Dig into this some more...
https://github.com/GoogleChrome/puppeteer/blob/master/examples/search.js

https://www.valentinog.com/blog/ui-testing-jest-puppetteer/
*/

//------------------------------------------------------------
//---------------- necessary libraries -----------------------
const puppeteer=require('puppeteer')
const http=require('http')
const querystring = require('querystring');
const urllib = require('url')
const fs = require('fs')

// const influxSend = require('./influxSend').influxSend
const metrics = require('./test_metrics')

//------------------------------------------------------------
//---------------- useful defaults -----------------------
let w=1400
let h=900

// let waitOptions={timeout:20000,waitUntil:['load']} //Possibly add to array --> ,'networkidle2' <--
let global_timeout = 20000
//------------------------------------------------------------
//---------------- commandline options -----------------------
cmd_args=process.argv
// console.log(process.argv)

//------------------------------------
//  Input File
infile_name=process.argv[2]
file_name = infile_name.indexOf('/') > -1 ? infile_name : './'+infile_name
// const testDef = require(file_name)


// fileOut=fs.readFile(file_name, 'utf8', function (err, data) {
//   if (err) {
//     console.log('Error: ' + err);
//     return;
//   }
//   testDef = JSON.parse(data);
//   return JSON.parse(data)
// });
let testDef = JSON.parse(require('fs').readFileSync(file_name, 'utf8'));

console.log(Object.keys(testDef))
console.log(testDef.sso)
console.log(testDef.sso.use)
//-----------------------------------
//  Duration - 30, 10m, 2h
requested_duration = process.argv[3] !== undefined ? process.argv[3] : '30'

if(requested_duration.indexOf('m') > -1){
  duration = +requested_duration.slice(0,-1)*60000
} else if (requested_duration.indexOf('h') > -1){
  duration = +requested_duration.slice(0,-1)*3600000
} else {
  duration = +requested_duration*1000
}
const endTime=Date.now()+duration
console.log(requested_duration,duration,endTime)

//-----------------------------------
//  Run type
run_type = process.argv[4] !== undefined ? process.argv[4] : 'dev'

let width = testDef.width !== undefined ? testDef.width : w
let height = testDef.height !== undefined ? testDef.height : h

let testMetadata = {
  name:testDef.testName,
  product:testDef.productName,
  env:testDef.environment,
  loglevel:testDef.logging !== undefined ? testDef.logging : 'run'
}

//==========================================================================================================
//  The test fuction
async function runTheTest(testDef,testMetadata){
 console.log('in runTheTest')
 const page_metrics_all=[]
//==========================================================================================================
//*****************************************************
//---------------- Common Setup -----------------------
 const browserStart=process.hrtime()
 const browser=await puppeteer.launch({
   headless:false,
   slowMo:500, // selectively enable based on dev view vs running.  Possibly default to low value for "emulation of user"
   // executablePath:'/Users/a584780/Code/puppeteer/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
   args: [ //commandline switch/arguments
     `--window-size=${width},${height}`
     ,'--enable-precise-memory-info'
     // ,'--no-sandbox'
   ]

 });
 // await page.setViewport({width:width,height:height})

 //-------- Open new page/tab --------
 let page=await browser.newPage();
 // log browser console messages to nodeJS console -----------------------
 //page.on('console', msg => console.log('PAGE LOG:', msg.text()));
 await page.setViewport({width,height})
 page.setDefaultNavigationTimeout(20000) // Default = 30000
 browserDone=process.hrtime(browserStart)

 //---------------- SSO Setup -------------------------
 if(testDef.sso.use === true){
   console.log('generate creds for SSO')
   creds = new Buffer(testDef.sso.uid+':'+testDef.sso.pwd).toString('base64')
   page.setExtraHTTPHeaders({'Authorization': 'Basic YTU4NDc4MDpXaWxsb3cwOA=='})
   // this is superceded by page.emulate('devicename')
   page.setUserAgent('Automation - helios_ux_pt')
 }
 //*****************************************************
 //==========================================================================================================


 // for(s of testDef.steps){
 testArray=[]
 const oe=Object.entries(testDef.steps);

 const totalStart=process.hrtime()

 for(let s of oe){

 // Object.entries(testDef.steps).forEach(async (s)=>{
     // console.log('---- iterating through steps ----')
     // console.log('--    on step:  ',s[0],'----')
     // console.log('--    Object.entries(testDef.steps).length:  ',Object.entries(testDef.steps).length,'----')
     // console.log('--    testDef.steps.length:  ',testDef.steps.length,'----')
     next=testDef.actions[s[1]]
     testMetadata['pgNm']=next.name
     console.log(next)

     if(next.action.indexOf('click') > -1){
       console.log('click action',next.action)
       let clickResults = await click(page,next,testMetadata)
       page_metrics_all.push(clickResults)
       // console.log(clickResults,'clickResults')
     }


     if(next.action.indexOf('enterText') > -1){
       console.log('enterText action',next.action)
       let enterResults = await enterText(page,next,testMetadata)
       page_metrics_all.push(enterResults)

     }

     if(next.action.indexOf('navigate') > -1){
       console.log('click navigate',next.action)
       let navResults = await navigate(page,next,testMetadata)
       page_metrics_all.push(navResults)
       // console.log(navResults,'navResults')

     }


     if(next.action.indexOf('hover') > -1){
       console.log('click action',next.action)
       let hoverResults = await hover(page,next,testMetadata)
       page_metrics_all.push(hoverResults)
       // console.log(clickResults,'clickResults')
     }


     // if(next.action.indexOf('chain') > -1){
     //   console.log('click action',next.action)
     //   let chainResults = await chain(page,next)
     // }

     // On last step -------------------------
     // console.log("oe.length-1 == s[0]",oe.length-1 == s[0])
     if(oe.length-1 == s[0]){
       final_execution=process.hrtime(totalStart)
       console.log('page_metrics_all',page_metrics_all)
       await browser.close()
       return {
         'testing_duration':final_execution[0]+Math.round(final_execution[1]/1000000)/1000,
         'browser_initialization':browserDone[0]+Math.round(browserDone[1]/1000000)/1000
        }
     }
   }

}
//*****************************************************************************
//*****************************************************************************
// Loop time around this
// do {
//   let status = await
// runTheTest(testDef,testMetadata)
// } while(Date.now() < endTime)

async function loopTheTest(endTime,testDef,testMetadata){
  for(let i = Date.now(); i< endTime; i=Date.now()){
    console.time('iterationExecution')
    let result = await runTheTest(testDef,testMetadata)
    console.timeEnd('iterationExecution')
    console.log('\n\nresult is:',result,'\nended:',new Date(Date.now()))
    if(Date.now() > endTime){
      console.log('now is:',new Date(Date.now()),'end was planned:',new Date(endTime),' -> time has past')
      break
    }
  }
}

loopTheTest(endTime,testDef,testMetadata)

//*****************************************************************************
//*****************************************************************************

//*****************************************************
//==========================================================================================================

//  Breakout to separate module??
//==========================================================================================================
//*****************************************************
//   Test actions
//*****************************************************

//-----------------------------------------------------
//-------- Navigate/GoTo ------------------------------
async function navigate(page,actionDef,testMetadata){
  console.log('in navigate function')
  a=actionDef
  let perf_results={"name":a.name,"metrics":{}}

  nav_wait = a.nav_wait !== 'undefined' ? a.nav_wait : 'load' //networkidle2??
  local_timeout = a.time_out !== undefined || a.time_out > 3000 ? a.timeout : global_timeout

  // Need to expand on this later for more complex wait conditions
  wait_component = a.waitFor.el.split(':')
  wait_def = wait_component[0]

  // Primary Navigation
  let startTime=Date.now()
  let s=process.hrtime()
  await page.goto(a.url,  {timeout:local_timeout,waitUntil: nav_wait})
  duration=process.hrtime(s)
  perf_results['start']=startTime
  perf_results.metrics[a.name]=duration[0]+Math.round(duration[1]/1000000)/1000
  console.log('navigate',a.name,'duration:',duration[0]+Math.round(duration[1]/1000000)/1000)
  //==============================================================>>>>>>>>>>>>>>
  //  Candidate for abstraction of waitFor
  //----------------------------------------------------------------------------

  if(a.waitFor !== undefined){
    // Wait for Page element
    let element=await page.waitFor(wait_def,{visible:true})
    waitReturn = process.hrtime(s)
    console.log('navigate',a.waitFor.name,waitReturn[0]+Math.round(waitReturn[1]/1000000)/1000)
    perf_results.metrics[a.waitFor.name]=waitReturn[0]+Math.round(waitReturn[1]/1000000)/1000
  }

  //----------------------------------------------------------------------------
  //==============================================================<<<<<<<<<<<<<<

  // let pg_metrics = await captureMetrics(page,startTime,a.name,testMetadata,[])
  //
  // perf_results["start"]=startTime
  // perf_results["duration"]=duration[0]+Math.round(duration[1]/1000000)/1000
  // perf_results["resources"]=pg_metrics
  //
  // // console.log(perf_results)
  // return perf_results

  let total_metrics = await metrics.collectMetrics(page,testMetadata,startTime,[])
  // console.log(total_metrics,'total_metrics')
  //fid_com'prod'search_symbol'1519058232147
  userSend=testMetadata.product+"'"+testMetadata.env+"'"+a.name+"'"+startTime+"!"
  ut=Object.entries(perf_results.metrics)
  for(m in ut){
    userSend+=ut[m][0]+"-"+Math.round(ut[m][1]*1000)
    if(m < ut.length-1){
      userSend+="'"
    }
  }
  console.log('userSend',userSend)
  await metrics.sendMetrics(page,'http://localhost:8080/page',total_metrics.page.send)
  await metrics.sendMetrics(page,'http://localhost:8080/resource',total_metrics.resourceLine)
  await metrics.sendMetrics(page,'http://localhost:8080/browser',total_metrics.browser.send)
  await metrics.sendMetrics(page,'http://localhost:8080/user',userSend)

  console.log('-- navigate --',perf_results)
  return perf_results

}


//-----------------------------------------------------
//-------- enterText ------------------------------
async function enterText(page,actionDef,testMetadata){
  console.log('in enterText function')
  a=actionDef
  let perf_results={"name":a.name}
  let textElement={}

  // Figure out parameterized data to enter here
  let enteredText = a.text

  // -----------------------------------------------
  // Enter main text for element
  console.log('entering primary text')
  startTime=Date.now()
  s=process.hrtime()
  await page.type(a.el, enteredText, {delay: 10})

  // -----------------------------------------------
  // If additional keys needed, send them
  if(a.postText !== undefined){
    console.log('there is postText: ',a.postText)
    if(a.postText.indexOf('+')){
      keys=a.postText.split('+')


      for(k of keys){
        await page.keyboard.press(k)
      }
    } else {
      startTime=Date.now()
      s=process.hrtime()
      await page.keyboard.press(a.postText)
    }
  }
  duration=process.hrtime(s)

  perf_results["start"]=startTime
  perf_results["duration"]=duration[0]+Math.round(duration[1]/1000000)/1000

  // console.log(perf_results)
  return perf_results


}


//-----------------------------------------------------
//-------- click ------------------------------
async function click(page,actionDef,testMetadata){
  console.log('in click function')
  a=actionDef
  let perf_results={"name":a.name,"metrics":{}}
  let clickElement={}

  nav_wait = a.nav_wait !== undefined ? a.nav_wait : 'load' //networkidle2??
  local_timeout = a.time_out !== undefined || a.time_out > 3000 ? a.timeout : global_timeout

  // Need to expand on this later for more complex wait conditions
  wait_component = a.waitFor.el.split(':')
  wait_def = wait_component[0]


  //====================================================>>>>>>>>>>>>>>>>>>>>>>
  // Candidate to Abstract to FIND function
  //--------------------------------------------------------------------------

  // Find if element is xpath or not
  if(a.el.indexOf('//') > -1){
    console.log('click - looking for xpath')
    clickEl = await page.$x(a.el)
    clickElement=clickEl[0]
    console.log('clickElement found - xpath')
  } else {
    console.log('click - looking for selector')
    clickElement = await page.$(a.el)
    // console.log(clickElement,'clickElement found')
    console.log('clickElement found - selector')
  }

  //--------------------------------------------------------------------------
  //====================================================<<<<<<<<<<<<<<<<<<<<<<

  startTime=Date.now()
  if(a.action.indexOf(':noTiming') > -1){
    console.log('noTiming requested, prepare to click')
    await clickElement.click()
    return true

  } else { // ---- Timing Requested/required

    s=process.hrtime()
    if(a.action.indexOf(':hard') > -1){
      const [response] = await Promise.all([
        page.waitForNavigation({timeout:local_timeout,waitUntil:nav_wait}),
        clickElement.click(),
      ]);
    } else {
      await clickElement.click()
    }
    duration=process.hrtime(s)
    perf_results['start']=startTime
    perf_results.metrics[a.name]=duration[0]+Math.round(duration[1]/1000000)/1000

    console.log('click',a.name,'duration:',duration[0]+Math.round(duration[1]/1000000)/1000)
    //==============================================================>>>>>>>>>>>>>>
    //  Candidate for abstraction of waitFor
    //----------------------------------------------------------------------------

    if(a.waitFor !== undefined){
      // Wait for Page element
      let element=await page.waitFor(wait_def,{visible:true})
      waitReturn = process.hrtime(s)
      console.log('click',a.waitFor.name,'duration',waitReturn[0]+Math.round(waitReturn[1]/1000000)/1000)
      perf_results.metrics[a.waitFor.name]=waitReturn[0]+Math.round(waitReturn[1]/1000000)/1000
    }

    //----------------------------------------------------------------------------
    //==============================================================<<<<<<<<<<<<<<


    // let pg_metrics = await captureMetrics(page,startTime,a.name,testMetadata,[])
    //
    // perf_results["start"]=startTime
    // perf_results["duration"]=duration[0]+Math.round(duration[1]/1000000)/1000
    // perf_results["resources"]=pg_metrics
    //
    // // console.log(perf_results)
    // return perf_results

    let total_metrics = await metrics.collectMetrics(page,testMetadata,startTime,[])
    // console.log(total_metrics,'total_metrics')

    userSend=testMetadata.product+"'"+testMetadata.env+"'"+a.name+"'"+startTime+"!"
    ut=Object.entries(perf_results.metrics)
    for(m in ut){
      userSend+=ut[m][0]+"-"+Math.round(ut[m][1]*1000)
      if(m < ut.length-1){
        userSend+="'"
      }
    }

    await metrics.sendMetrics(page,'http://localhost:8080/page',total_metrics.page.send)
    await metrics.sendMetrics(page,'http://localhost:8080/resource',total_metrics.resourceLine)
    await metrics.sendMetrics(page,'http://localhost:8080/browser',total_metrics.browser.send)
    await metrics.sendMetrics(page,'http://localhost:8080/user',userSend)

    console.log('-- click --',perf_results)

    return perf_results
  }

}

//-----------------------------------------------------
//-------- hover ------------------------------
async function hover(page,actionDef,testMetadata){
  console.log('in hover function')
  a=actionDef
  let perf_results={"name":a.name}
  let hoverElement={}
  //====================================================>>>>>>>>>>>>>>>>>>>>>>
  // Candidate to Abstract to FIND function
  //--------------------------------------------------------------------------

  // Find if element is xpath or not
  if(a.el.indexOf('//') > -1){
    console.log('hover - looking for xpath')
    hoverEl = await page.$x(a.el)
    hoverElement=hoverEl[0]
    console.log('hoverElement found - by xpath')
  } else {
    console.log('hover - looking for selector')
    hoverElement = await page.$(a.el)
    console.log('hoverElement found - by selector')
  }

  //--------------------------------------------------------------------------
  //====================================================<<<<<<<<<<<<<<<<<<<<<<


  console.log('prepare to hover')
  startTime=Date.now()
  s=process.hrtime()
  await hoverElement.hover()
  duration=process.hrtime(s)

  perf_results['start']=startTime
  perf_results[a.name]=duration[0]+Math.round(duration[1]/1000000)/1000
  // console.log(perf_results)
  return perf_results

}




//  Breakout to separate module??
//==========================================================================================================
//*****************************************************
//   Metrics
// async function captureMetrics(page,startTime,pageName,testMetadata,returnMetrics){
//   // const urllib=require('urllib')
//   const perfMetrics={}
//   //---------------------------------------------------------------------------------
//   // Capture resource metrics ...if requested?? (maybe not optional??)
//   let ns = await page.evaluate(()=>window.performance.timing.navigationStart)
//   console.log('navigationStart',ns,'startTime',startTime)
//   console.log('before page.evaluate()',testMetadata)
//
//   resArray=[]
//   r_sum={}
//   r_types=['beacon','css','iframe','img','link','other','script','xmlhttprequest']
//
//   res_line='resources,env='+testMetadata.env+',pgNm='+pageName;
//
//   let res=await page.evaluate(()=>{
//     // testMetadata=this.testMetadata
//
//     return performance.getEntriesByType('resource')
//      .map(e =>{
//        return({
//          "name":e.name,
//          "startTime":Math.round(e.startTime*100)/100,
//          "duration":Math.round(e.duration*100)/100,
//          "domainLookupStart":Math.round(e.domainLookupStart*100)/100,
//          "connectStart":Math.round(e.connectStart*100)/100,
//          "requestStart":Math.round(e.requestStart*100)/100,
//          "responseStart":Math.round(e.responseStart*100)/100,
//          "responseEnd":Math.round(e.responseEnd*100)/100,
//          "transferSize":e.transferSize,
//          "encodedBodySize":e.encodedBodySize,
//          "decodedBodySize":e.decodedBodySize,
//          "type":e.initiatorType
//        })
//       })
//
//   })
//
//   // process resource metrics for shipping to influxDB
//   for(r of res){
//     //
//     console.log(r)
//     parsedURL = urllib.parse(r.name);
//     res_line+=',type='+r.type+',hostname='+parsedURL.hostname
//     pn=parsedURL.pathname.split('/')
//     fguess=pn.pop()
//     file=fguess !== '' ? fguess : pn.pop()
//     res_line+=',file='+file
//     res_line+=' start='+r.startTime+',elapsed='+r.duration
//     if(r.requestStart > 0){ res_line+=',req_start='+r.requestStart}
//     res_line+=',bytes='+r.decodedBodySize+'i,bytes_enc='+r.encodedBodySize+'i,bytes_transfer='+r.transferSize+'i '+startTime+'\n'
//
//     resArray.push(res_line)
//
//   }
//
//   // clear current resource timings
//   await page.evaluate(()=>{return performance.clearResourceTimings()})
//   //----------------------------------------------------------------------------
//   //    Finished with Resource Metrics
//   //----------------------------------------------------------------------------
//
//   // -- NEED PAINT TIMING TOO
//
//   let pg = await page.evaluate(()=>{
//     return performance.getEntriesByType('navigation')[0].toJSON()
//   })
//
//   res.push(pg)
//
//   perfMetrics.resourceTiming=res
//
//   let memory = await page.evaluate(()=>{
//     let mo = performance.memory
//     let mem={}
//     mem['mem_total']=mo['totalJSHeapSize']
//     mem['mem_used']=mo['usedJSHeapSize']
//     mem['mem_limit']=mo['jsHeapSizeLimit']
//     return mem
//   })
//
//   console.log('memory',memory)
//   perfMetrics.memory=memory
//
//   // Very likely need to keep track of and run deltas for some of these
//   let currentMetrics= await page.metrics()
//   console.log(currentMetrics)
//   for(m in currentMetrics){
//      console.log('page.metrics',m,currentMetrics[m])
//   }
//
//   perfMetrics.browser=currentMetrics
//
//   // console.log(JSON.stringify(perfMetrics))
//
//   console.log(resArray)
//
//  return(perfMetrics)
// }
//---------------------- End metrics capture ----------------------
//------------------------------------------------------------------


//------------------------------------------------------------------
/*---------------------- Further exploration -----------------------
  // Abstraction model - from https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagewaitforfunctionpagefunction-options-args
    const puppeteer = require('puppeteer');

    puppeteer.launch().then(async browser => {
    const page = await browser.newPage();
    const watchDog = page.waitForFunction('window.innerWidth < 100');
    page.setViewport({width: 50, height: 50});
    await watchDog;
    await browser.close();
    });

  page.emulate(options) - to emulate mobile devices
  https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageemulateoptions
*/

//==============================================================================
//  Working test definition
//==============================================================================
// testDef={
//   "testName":"ssasit_demo",
//   "productName":"ssa",
//   "environment":"sit",
//   "logging":"run",
//   "height":900,
//   "width":1400,
//   "sso":{"use":true,"uid":"a584780","pwd":"*******"},
//   "input":{
//     "items":["cheeky monkey"]
//   },
//   "actions":{
//     "homepage":{
//       "action":"navigate:hard",
//       "name":"homepage",
//       "url":"http://ssasit.fmr.com/SSA",
//       "nav_wait":"load",
//       "waitFor":{
//         "name":"fills_errors_table",
//         "el":"div.ag-body-container",// later will add indexing:10",
//         "timeOut":30
//       },
//     },
//
//
//     "click_mainmenu":{
//       "action":"click:noTiming",
//       "name":"click_mainmenu",
//       "el":"i.fa.fa-bars"
//     },
//     "hover_search_menu":{
//       "action":"hover",
//       "name":"hover_search_menu",
//       "el":"//p[contains(text(),'Search')]"
//     },
//     "click_securities_history":{
//       "action":"click:noTiming",
//       "name":"click_securities_history",
//       "el":"//p[text()='Securities History']"
//     },
//
//
//     "sh_enter_security":{
//       "action":"enterText",
//       "name":"sh_enter_security",
//       "el":"security-search input",
//       "text":"KPTI",
//       "postText":"ArrowDown+Tab"
//     },
//
//
//     "click_SH_date_range":{
//         "action":"click:noTiming",
//         "name":"click_SH_date_range",
//         "el":"date-range-picker input",
//         "pause":"1-3"
//       },
//       "click_SH_today":{
//         "action":"click:noTiming",
//         "name":"click_SH_today",
//         "el":"[data-range-key='Today']",
//         "pause":"1-3"
//       },
//       "click_SH_7Days":{
//         "action":"click:noTiming",
//         "name":"click_SH_today",
//         "el":"[data-range-key='Last 7 Days']",
//         "pause":"1-3"
//       },
//       "click_SHsearch":{
//         "action":"click",
//         "name":"click_SHsearch",
//         "el":"div.search-box button.primary",
//         "waitFor":{
//           "name":"search_results",
//           "el":"div.ag-body-container [col-id='ticker']",
//           "timeOut":30
//         },
//         "pause":"1-3"
//       },
//
//     "view_item":{
//       "name":"view_item",
//       "action":"click:hard",
//       "el":"[id=result_2]",
//       "waitFor":{
//         "name":"item_description",
//         "el":"#bookDesc_iframe",//{visible:true}
//         "timeOut":10
//       }
//     }
//   },
//
//   "steps":["homepage","click_mainmenu","hover_search_menu","click_securities_history","sh_enter_security","click_SH_date_range","click_SH_7Days","click_SHsearch"]
// }
