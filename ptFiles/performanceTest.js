
/*============================================================================
  execute test:
    node performanceTest.js <testDefinition>.json duration(optional) run_type(default = 'dev', options='run','smoke')

    duration options:
      - default = 30 seconds
      - 57  -> 57 seconds
      - 43m -> 43 minutes
      - 6h  -> 6 hours

    For precise debugging, prepend the following before `node performanceTest.js...`
     env DEBUG="*" env DEBUG_COLORS=true

  To do:
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  4.  capture metrics to return
      f.  domTreeDepth
      g.  userTiming API metrics
  5.  waitFor more than just a single element/configurability - leverage waitFor functionality or <element>:<count> type structures.  maybe page.$x(...) & length
  8.  iframe navigation
  13. update documentation for test definition!!
  15. handle clicking random value from list of elements returned.
  20. Abstract "findElement" to functions
  33. Capture JS errors & log - https://github.com/GoogleChrome/puppeteer/issues/1030#issuecomment-336495331
  34. Handle specific (chosen/variable index) input from an array
  35. Coverage (JS/CSS) evaluation and return - https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-coverage




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
      h.  resources summary :: 2018-Feb-22

  6.  Solve SSO functionality :: 2018-Feb-09
  7.  read dynamic test definition (probably commandline) :: 2018-Feb-14
  9.  dynamic logging - based on run/dev level :: 2018-Feb-23
  10. package for distribution to docker  :: 2018-Feb-26
  12. define duration/looping structure :: 2018-Feb-20
  14. handle random text input  :: 2018-Feb-27
  16. handle navigation actions :: 2018-Feb-13
  17. handle click actions :: 2018-Feb-13
  18. handle enterText actions :: 2018-Feb-14
  21. handle hover actions :: 2018-Feb-13
  22. Adjust capturePageMetrics to accept requests seeking only partial metrics ** only w3c page/paint are optional **  ::  2018-Feb-26
  23. Ensure test stops with browser closing after final step :: 2018-Feb-14
  24. Loop through test definition until requested duration has elapsed :: 2018-Feb-20
  25. Screenshot on "dev" to validate test creation :: 2018-Feb-21
  26. run = headless:false || dev = headless:true :: 2018-Feb-21
  27. decide on default slowMo setting || completely configurable :: 2018-Feb-23
  28. Appropriate logging/output for run vs. dev views  :: 2018-Feb-23 ** DUPE of 9
  29. In dev mode, style elements of interaction to validate correct selector definition :: 2018-Mar-02 figured it out!
  30. Handle/catch timeout errors :: 2018-Feb-22
  31. Choose path for Chrome/Chromium executable by OS  :: 2018-Feb-26
  32. Log timeout errors :: 2018-Feb-23

+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

_________________________________________________________________
  Deferred:
  11. package for distribution to windows :: 2018-Feb-27 >>>
        Current technical/connection limitations preclude fetching the resources needed to bundle
        // Look at: https://github.com/zeit/pkg, https://github.com/nexe/nexe
  19. handle chains of actions :: 2018-Feb-13 >>>
        ActionChains were a requirement for correct Selenium operation.  Doesn't appear necessary for puppeteer!!
  29. In dev mode, style elements of interaction to validate correct selector definition :: 2018-Feb-27 >>>
        Looks like this isn't really an option.  It's possible to execute arbitrary javascript to style an element,
        but I prefer to not do that unless absolutely necessary.
        2018-Mar-02 *** Figured it out while troubleshooting a test***

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
const os = require('os')
const util=require('util')
const uuidv1=require('uuid/v1')

const stat = util.promisify(fs.stat);
const mkdir = util.promisify(fs.mkdir);

// const influxSend = require('./influxSend').influxSend
const metrics = require('./test_metrics')


// const metricsReceiver = 'http://localhost:8080'

//------------------------------------------------------------
//---------------- useful defaults -----------------------
let w=1400
let h=900
systemType=os.platform()
//------------------------------------------------------------
//---------------- commandline options -----------------------
cmd_args=process.argv
// console.log(process.argv)

//------------------------------------
//  Input File
infile_name=process.argv[2]
file_name = infile_name.indexOf('/') > -1 ? infile_name : './'+infile_name
let testDef = JSON.parse(require('fs').readFileSync(file_name, 'utf8'));

// let waitOptions={timeout:20000,waitUntil:['load']} //Possibly add to array --> ,'networkidle2' <--
let global_timeout = testDef.global_timeout !== undefined ? +testDef.global_timeout : 30000
console.log('global_timeout',global_timeout)
// global_timeout = 2000

// console.log(testDef)
// console.log(Object.keys(testDef))
// console.log(testDef.sso)
// console.log(testDef.sso.use)
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

//-----------------------------------
//  Run type
run_type = process.argv[4] !== undefined ? process.argv[4] : 'dev'

let endTime=Date.now()+10000
if(run_type === 'run'){
  endTime=Date.now()+duration
}
console.log('Test will end after,',new Date(endTime))



dimensions=testDef.dimensions.split(':')
let width = dimensions[0] > 200 ? +dimensions[0] : w
let height = dimensions[1] !== undefined ? +dimensions[1] : h

let testMetadata = {
  name:testDef.testName,
  product:testDef.productName,
  env:testDef.environment,
  loglevel:run_type,
  logging:testDef.logging
}
let base_results_dir=systemType === 'linux' ? '/FeTest/results/'+testDef.productName : './results/'+testDef.productName

//==========================================================================================================
//==========================================================================================================
//
//  The test fuction
//
//==========================================================================================================
//==========================================================================================================
async function runTheTest(testDef,testMetadata){
  console.log('Now:',new Date(Date.now()),'Test will end after:',new Date(endTime))
  // console.log('\tin runTheTest')
  const page_metrics_all=[]
  //==========================================================================================================
  //*****************************************************
  //---------------- Common Setup -----------------------

  // If not "run" - create directory for smoke/dev results & screenshots
  let results_dir='./results'
  ts=Date.now()
  // testMetadata.sessID = new Date(ts).toISOString()
  testMetadata.sessID = uuidv1().substr(0,16)
  if(testMetadata.logging !== 'run'){

    results_dir=base_results_dir+'-'+ts
    if(run_type === 'dev'){
      console.log('\tresults directory - ',results_dir)}

    // Create Directory
    if (!fs.existsSync(results_dir)){
      fs.mkdirSync(results_dir);
    }
  }




   browser_launch_options={
     // headless: run_type === 'dev' ? false : true,
     headless: false,
     slowMo: testDef.slowMo !== undefined ? testDef.slowMo : run_type === 'dev' ? 250 : 10,
     executablePath: systemType!=='darwin' ? systemType !== 'linux' ? 'chrome' : 'google-chrome' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
     args:[
       `--window-size=${width},${height}`
       ,'--enable-precise-memory-info'
       ,'--no-sandbox'
     ]
   }

   const browserStart=process.hrtime()
   const browser=await puppeteer.launch(
     browser_launch_options
    );
   const browser_loaded=process.hrtime(browserStart)
   // await page.setViewport({width:width,height:height})

   //-------- Open new page/tab --------
   let page=await browser.newPage();
   await page.waitFor(250)
   let next={}

   //----------------------------------------
   // Handle Promise Rejections
   process.on("unhandledRejection", async (reason, p) => {
    console.log("Unhandled Rejection\n\treason:", reason);
    let msg=reason.message
    if(next !== undefined){
      errorLine='_pt_'+testMetadata.product+"'"+testMetadata.env+"'"+next.action.split(':')[0]+"'"+next.name+"'"+testMetadata.sessID+"'"+Date.now()+"!"
    } else {
      errorLine='_pt_'+testMetadata.product+"'"+testMetadata.env+"'null'null'"+testMetadata.sessID+"'"+Date.now()+"!"
    }
    if(msg.indexOf('Timeout Exceeded') > -1){
      let exprTime=msg.slice(msg.indexOf('Exceeded')+10,msg.indexOf('ms '))
      errorLine+="timeout_nav'"+exprTime
    } else if (msg.indexOf('waiting failed') > -1) {
      let exprTime=msg.slice(msg.indexOf(' timeout')+9,msg.indexOf('ms '))
      errorLine+="timeout_wait'"+exprTime
    } else if (msg.indexOf('kill EPERM') > -1) {
      let exprTime=msg.slice(msg.indexOf(' timeout')+9,msg.indexOf('ms '))
      errorLine+="close_error"
    } else {
      errorLine+=+msg.slice(7,25).replace(/\s/g,'_')
    }

    metrics.sendMetrics(page, '/errors' ,errorLine)

    if(testMetadata.logging !== 'run'){
      screenshot_file=results_dir+'/'+s[0]+'-'+next.name+'.jpg'
      // console.log('screenshot_file',screenshot_file)
      await page.screenshot({
       path: screenshot_file,
       type: 'jpeg',
       quality: 50
     });
     if(run_type === 'dev'){
       console.log('\tscreenshot complete')}
    }

    browser.close();
  });

   // log browser console messages to nodeJS console -----------------------
   //page.on('console', msg => console.log('PAGE LOG:', msg.text()));
   await page.setViewport({width,height})
   page.setDefaultNavigationTimeout(20000) // Default = 30000
   const page_ready=process.hrtime(browserStart)

   //---------------- SSO Setup -------------------------
   if(testDef.sso !== undefined && testDef.sso.use === true){

     if(run_type === 'dev'){
       console.log('generate creds for SSO')}
     creds = new Buffer(testDef.sso.uid+':'+testDef.sso.pwd).toString('base64')
     // console.log('creds',creds)
     // page.setExtraHTTPHeaders({'Authorization': 'Basic YTU4NDc4MDpXaWxsb3cwOA=='})
     page.setExtraHTTPHeaders({'Authorization': 'Basic '+creds})
     // this is superceded by page.emulate('devicename')
     page.setUserAgent('Automation - helios_ux_pt')
     // page.setUserAgent('Automation')


   }
   //*****************************************************
   //==========================================================================================================


   // for(s of testDef.steps){
   testArray=[]
   const oe=Object.entries(testDef.steps);
   if(run_type === 'dev'){
     console.log('Test Steps:',oe)
   }
   const totalStart=process.hrtime()

   for(let s of oe){
       // if(run_type === 'dev'){
       //   console.log(s[1])}
       next=testDef.actions[s[1]]
       // console.log('\tNext Action:\n',next)
       testMetadata['pgNm']= next.name !== undefined ? next.name : s[0]

       //-----------------------------------------------------------
       // Pass Random value in for choosing from variable input data
       next.rand=Math.round(Math.random()*100)


       logStep = next.name !== undefined ? next.name : next.action
       console.log('|=====================================\n\|  step:',s[0],'\tname:',logStep,'\n|-------------------------------------')
       console.log(next)

       // ----------------------------------------------------------------------
       //   Click Action
       if(next.action.indexOf('click') > -1){
         if(run_type === 'dev'){
           console.log('\tclick action',next.action)}
         let clickResults = await click(page,next,testMetadata)
         page_metrics_all.push(clickResults)
         // console.log(clickResults,'clickResults')
       }

       // ----------------------------------------------------------------------
       //   EnterText Action
       if(next.action.indexOf('enterText') > -1){
         if(run_type === 'dev'){
           console.log('\tenterText action',next.action)}
         let enterResults = await enterText(page,next,testMetadata,testDef.input)
         // let enterResults = await enterText(page,next,testMetadata)
         page_metrics_all.push(enterResults)

       }

       // ----------------------------------------------------------------------
       //   Navigate Action
       if(next.action.indexOf('navigate') > -1){
         if(run_type === 'dev'){
           console.log('\tclick navigate',next.action)}
         let navResults = await navigate(page,next,testMetadata)
         page_metrics_all.push(navResults)
         // console.log(navResults,'navResults')

       }

       // ----------------------------------------------------------------------
       //   Hover Action
       if(next.action.indexOf('hover') > -1){
         if(run_type === 'dev'){
           console.log('\tclick action',next.action)}
         let hoverResults = await hover(page,next,testMetadata)
         page_metrics_all.push(hoverResults)
         // console.log(clickResults,'clickResults')
       }

       // //----------------------------------------------------------------------
       // //   Wait if requested
       if(next.pause!==undefined){
         ps=next.pause
         if(typeof(ps) === 'number'){
           pause=ps
         } else {
           ps=next.pause.split('-')
           if(ps.split.length > 0){
             pause = Math.round(Math.random()* ((ps[1]-ps[0])) ) + ps[0]
           }
         }

         await page.waitFor(pause)

       }

       // if(next.action.indexOf('chain') > -1){
       //   console.log('click action',next.action)
       //   let chainResults = await chain(page,next)
       // }

       // ----------------------------------------------------------------------
       //   Capture Screenshot after action
       if(testMetadata.logging !== 'run'){
         screenshot_file=results_dir+'/'+s[0]+'-'+next.name+'.jpg'
         await captureScreenshot(page,screenshot_file)
        //  // console.log('screenshot_file',screenshot_file)
        //  await page.screenshot({
        //   path: screenshot_file,
        //   type: 'jpeg',
        //   quality: 50
        // });
        // if(run_type === 'dev'){
        //   console.log('\tscreenshot complete')}
       }

       console.log('|-------------------------------------\n\|  step:',s[0],'\t complete','\n|=====================================\n')

       // On last step -------------------------
       // console.log("oe.length-1 == s[0]",oe.length-1 == s[0])
       if(oe.length-1 == s[0]){
         final_execution=process.hrtime(totalStart)
         if(run_type === 'dev'){
           console.log('\n\n==================================================\n\tpage_metrics_all\n',page_metrics_all)
           console.log(new Date(Date.now()),'closing browser')
         }
         await page.waitFor(500)
         await page.close()
         await browser.close().catch((err)=>{console.log('!!!- ERROR -!!!\n',err,'\n!!!- ERROR -!!!')})
         return {
           'testing_duration':final_execution[0]+Math.round(final_execution[1]/1000000)/1000,
           'browser_initialization':browser_loaded[0]+Math.round(browser_loaded[1]/1000000)/1000,
           'initial_page_ready':page_ready[0]+Math.round(page_ready[1]/1000000)/1000
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
    console.log('\n\nresult is:\n',result)
    if(Date.now() > endTime){
      // console.log('now is:',new Date(Date.now()),'end was planned:',new Date(endTime),' -> time has past')
      // console.log('--!! End of requested iterations !!--')
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
  if(run_type==='dev'){
    console.log('\tin navigate function')}
  a=actionDef
  actName=a.name.replace(/-/g,'_')

  if(a.action.indexOf(':hard') > -1){
    w3c=true
  } else {
    w3c=false
  }

  let perf_results={"name":actName,"metrics":{}}

  nav_wait = a.nav_wait !== 'undefined' ? a.nav_wait : 'load' //networkidle2??
  local_timeout = a.time_out !== undefined || +a.time_out > 3000 ? +a.timeout : +global_timeout
  if(run_type==='dev'){
    console.log('navigate - local_timeout',local_timeout,typeof(local_timeout))}

  // Need to expand on this later for more complex wait conditions
  wait_component = a.waitFor.el.split(':')
  wait_def = wait_component[0]

  // Primary Navigation
  let startTime=Date.now()
  let s=process.hrtime()
  // await page.goto(a.url,{timeout: 20000, waitUntil: nav_wait})
  await page.goto(a.url,{waitUntil: nav_wait})

  duration=process.hrtime(s)

  //==============================================================>>>>>>>>>>>>>>
  //  Candidate for abstraction of waitFor
  //----------------------------------------------------------------------------

  if(a.waitFor !== undefined){
    // console.log('a.waitFor',a.waitFor)
    console.log("Element wait results:")
    // Wait for Page element
    waitName=a.waitFor.name.replace(/-/g,'_')
    // console.log('\tnavigate :: awaiting element:',wait_def)
    let element=await page.waitFor(wait_def,{timeout:a.waitFor.timeOut, visible:true})
    waitReturn = process.hrtime(s)
    console.log('- navigate',waitName,waitReturn[0]+Math.round(waitReturn[1]/1000000)/1000)
    perf_results.metrics[waitName]=waitReturn[0]+Math.round(waitReturn[1]/1000000)/1000
  }

  //----------------------------------------------------------------------------
  //==============================================================<<<<<<<<<<<<<<

  console.log('- navigate',actName,'duration:',duration[0]+Math.round(duration[1]/1000000)/1000)

  perf_results['start']=startTime
  perf_results.metrics[actName]=duration[0]+Math.round(duration[1]/1000000)/1000



  let total_metrics = await metrics.collectMetrics(page,testMetadata,startTime,w3c)
  // console.log(total_metrics,'total_metrics')
  //fid_com'prod'search_symbol'1519058232147
  // userSend=testMetadata.product+"'"+testMetadata.env+"'"+actName+"'"+startTime+"'"+testMetadata.sessID+"!"

  userSend=total_metrics.userString
  // console.log('user oriented metrics:\n',perf_results.metrics)

  ut=Object.entries(perf_results.metrics)
  for(m in ut){
    // console.log(ut[m])
    userSend+="'"+ut[m][0]+"-"+Math.round(ut[m][1]*1000)
    // if(m < ut.length-1){
    //   userSend+="'"
    // }
  }
  console.log('userSend',userSend)
  // console.log('total_metrics',total_metrics)
  // console.log('total_metrics.page',total_metrics.page)

  if(w3c===true){
    await metrics.sendMetrics(page,'/page','_pt_'+total_metrics.page.send)
  }
  await metrics.sendMetrics(page,'/resource',total_metrics.resourceLine)
  await metrics.sendMetrics(page,'/browser','_pt_'+total_metrics.browser.send)
  await metrics.sendMetrics(page,'/user','_pt_'+userSend)

  // console.log('-- navigate --',perf_results)
  return perf_results

}


//-----------------------------------------------------
//-------- enterText ------------------------------
async function enterText(page,actionDef,testMetadata,input){
  if(run_type==='dev'){
    console.log('\tin enterText function')}
  a=actionDef
  let perf_results={"name":a.name}
  let textElement={}

  // choose appropriately randomized input data here
  // Figure out parameterized data to enter here
  let enteredText=''

  if(a.text.indexOf('<') > -1){
    txtArray=input[a.text.replace(/<|>/g,'')]
    enteredText = txtArray[a.rand%txtArray.length]
  } else {
    enteredText = a.text
  }
  if(run_type==='dev'){
    console.log('\tenteredText',enteredText)}




  // await page.click(a.el)

  let startTime=Date.now()
  let s=process.hrtime()

  if(a.preText !== undefined){
    // -----------------------------------------------
    // Enter keys if preText
    if(run_type==='dev'){
      console.log('\tentering pre keys')}

    await click(page,{action:'click:noTiming',name:'clickBeforeEnterText',el:a.el},{})
    keys=a.preText.split('+')
    for(let pk of keys){
      await page.keyboard.press(pk)
    }
  }


  // -----------------------------------------------
  // Enter main text for element
  if(run_type==='dev'){
    console.log('\tentering primary text')}

  await page.type(a.el, enteredText, {delay: 1})

  if(run_type!=='run'){
    console.log('\tentering primary text - succeeded')}

  // -----------------------------------------------
  // If additional keys needed, send them
  if(a.postText !== undefined){
    if(run_type==='dev'){
      console.log('\tthere is postText: ',a.postText)}
    keys=a.postText.split('+')
    for(let ek of keys){
      await page.keyboard.press(ek)
    }

    // if(a.postText.indexOf('+')){
    //   keys=a.postText.split('+')
    //
    //
    //   for(ek of keys){
    //     await page.keyboard.press(ek)
    //   }
    // } else {
    //   startTime=Date.now()
    //   s=process.hrtime()
    //   await page.keyboard.press(a.postText)
    // }
  }
  duration=process.hrtime(s)

  perf_results["start"]=startTime
  perf_results["duration"]=duration[0]+Math.round(duration[1]/1000000)/1000


  await page.waitFor(10000)

  // console.log(perf_results)
  return perf_results


}


//-----------------------------------------------------
//-------- click ------------------------------
async function click(page,actionDef,testMetadata){
  if(run_type==='dev'){
    console.log('\in click function')}

  a=actionDef
  actName=a.name.replace(/-/g,'_')
  // console.log('\na',a)
  let perf_results={"name":actName,"metrics":{}}
  let clickElement={}

  nav_wait = a.nav_wait !== undefined ? a.nav_wait : 'load' //networkidle2??
  local_timeout = a.time_out !== undefined || a.time_out > 3000 ? a.timeout : +global_timeout

  if(a.waitFor !== undefined){
    // Need to expand on this later for more complex wait conditions
    wait_component = a.waitFor.el.split(':')
    wait_def = wait_component[0]
  } else {
    wait_def=false
  }

  //====================================================>>>>>>>>>>>>>>>>>>>>>>
  // Candidate to Abstract to FIND function
  //--------------------------------------------------------------------------

  // Find if element is xpath or not
  if(a.el.indexOf('//') > -1){
    if(run_type==='dev'){
      console.log('\tclick - looking for xpath')}
    clickEl = await page.$x(a.el)
    clickElement=clickEl[0]
    if(run_type==='dev'){
      console.log('\tclickElement found - xpath')}
  } else {
    if(run_type==='dev'){
      console.log('\tclick - looking for selector')}
    clickElement = await page.$(a.el)
    // console.log(clickElement,'clickElement found')
    if(run_type==='dev'){
      console.log('\tclickElement found - selector')}
  }

  // Highlight and capture screenshot if requested
  if(run_type==='dev' && a.highlight !== undefined){
    if(testMetadata.logging !== 'run'){
      fileName=results_dir+'/'+s[0]+'-'+next.name+'-hightlight.jpg'
    } else {
      fileName=false
    }
    await highlight(page,a.el,fileName)
  }

  //--------------------------------------------------------------------------
  //====================================================<<<<<<<<<<<<<<<<<<<<<<

  clickOptions={clickCount:2}

  startTime=Date.now()
  if(a.action.indexOf(':noTiming') > -1){
    if(run_type==='dev'){
      console.log('\tnoTiming requested, prepare to click')}
    await clickElement.click(clickOptions)
    await page.waitFor(500)
    return true

  } else { // ---- Timing Requested/required
    if(a.action.indexOf(':hard') > -1){
      if(run_type==='dev'){
        console.log('\thard navigation expected, prepare to click')}
      s=process.hrtime()
      const [response] = await Promise.all([
        page.waitForNavigation({timeout:20000,waitUntil:['load']}),
        clickElement.click(clickOptions),
      ]);
    } else {
      if(run_type==='dev'){
        console.log('\soft navigation expected, prepare to click')}
      s=process.hrtime()
      await clickElement.click(clickOptions)
      if(run_type==='dev'){
        console.log('\soft navigation, click executed')}
    }

    duration=process.hrtime(s)

    //==============================================================>>>>>>>>>>>>>>
    //  Candidate for abstraction of waitFor
    //----------------------------------------------------------------------------
    // console.log(a.waitFor)
    // console.log(wait_def)
    //
    // console.log('check if waitFor')
    // console.log('a.waitFor !== undefined',a.waitFor !== undefined)
    // console.log('wait_def !== false',wait_def !== false)
    if(a.waitFor !== undefined && wait_def !== false){
      // console.log('a.waitFor !== undefined && wait_def !== false')
      console.log('Element wait results:')
      waitName=a.waitFor.name.replace(/-/g,'_')

      // Wait for Page element
      // console.log('\click :: awaiting element:',wait_def)
      if(run_type==='dev'){
        console.log('\twaitFor:',wait_def)}
      // let element=await page.waitFor(wait_def,{timeout: +a.waitFor.timeOut, visible:true})
      await page.waitFor(wait_def,{timeout: +a.waitFor.timeOut, visible:true})
      waitReturn = process.hrtime(s)
      console.log('- click',waitName,'duration',waitReturn[0]+Math.round(waitReturn[1]/1000000)/1000)
      perf_results.metrics[waitName]=waitReturn[0]+Math.round(waitReturn[1]/1000000)/1000
    }
    perf_results['start']=startTime
    perf_results.metrics[actName]=duration[0]+Math.round(duration[1]/1000000)/1000

    console.log('- click',actName,'duration:',duration[0]+Math.round(duration[1]/1000000)/1000)
    //----------------------------------------------------------------------------
    //==============================================================<<<<<<<<<<<<<<


    // // console.log(perf_results)
    // return perf_results
    if(a.action.indexOf(':hard') > -1){
      w3c=true
    } else {
      w3c=false
    }

    let total_metrics = await metrics.collectMetrics(page,testMetadata,startTime,w3c)
    // console.log(total_metrics,'total_metrics')

    // console.log(perf_results)
    // console.log(total_metrics['paint'])
    userSend=testMetadata.product+"'"+testMetadata.env+"'"+actName+"'"+startTime+"'"+testMetadata.sessID+"!"
    ut=Object.entries(perf_results.metrics)
    for(m in ut){
      userSend+=ut[m][0]+"-"+Math.round(ut[m][1]*1000)
      if(m < ut.length-1){
        userSend+="'"
      }
    }

    if(w3c===true){
      await metrics.sendMetrics(page,'/page','_pt_'+total_metrics.page.send)
    }
    await metrics.sendMetrics(page,'/resource',total_metrics.resourceLine)
    await metrics.sendMetrics(page,'/browser','_pt_'+total_metrics.browser.send)
    await metrics.sendMetrics(page,'/user','_pt_'+userSend)

    // console.log('-- click --',perf_results)

    return perf_results
  } // End of timing requested

}

//-----------------------------------------------------
//-------- hover ------------------------------
async function hover(page,actionDef,testMetadata){
  if(run_type==='dev'){
    console.log('\tin hover function')}
  a=actionDef
  let perf_results={"name":a.name}
  let hoverElement={}
  //====================================================>>>>>>>>>>>>>>>>>>>>>>
  // Candidate to Abstract to FIND function
  //--------------------------------------------------------------------------

  // Find if element is xpath or not
  if(a.el.indexOf('//') > -1){
    if(run_type==='dev'){
      console.log('\thover - looking for xpath')}
    hoverEl = await page.$x(a.el)
    hoverElement=hoverEl[0]
    if(run_type==='dev'){
      console.log('\thoverElement found - by xpath')}
  } else {
    if(run_type==='dev'){
      console.log('\thover - looking for selector')}
    hoverElement = await page.$(a.el)
    if(run_type==='dev'){
      console.log('\thoverElement found - by selector')}
  }

  //--------------------------------------------------------------------------
  //====================================================<<<<<<<<<<<<<<<<<<<<<<

  if(run_type==='dev'){
    console.log('\tprepare to hover')}
  startTime=Date.now()
  s=process.hrtime()
  await hoverElement.hover()
  duration=process.hrtime(s)

  perf_results['start']=startTime
  perf_results[a.name]=duration[0]+Math.round(duration[1]/1000000)/1000
  // console.log(perf_results)
  return perf_results

}

//------------------------------------------------------------------------------
//   hightlight element
async function highlight(page,el,fileName){
  await page.$eval(el, e => e.setAttribute("style", "border: 3px solid red;"))
  if(fileName !== false){
    await captureScreenshot(page,fileName)
  }

}

//------------------------------------------------------------------------------
//   capture screenshot
async function captureScreenshot(page,screenshot_file){
  // console.log('screenshot_file',screenshot_file)
  await page.screenshot({
   path: screenshot_file,
   type: 'jpeg',
   quality: 50
  });
  console.log('\tscreenshot complete',screenshot_file)
}
//------------------------------------------------------------------
/*---------------------- Further exploration -----------------------

  !!! - page.emulate(options) - to emulate mobile devices
  https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageemulateoptions
*/
