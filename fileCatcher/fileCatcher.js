const restify = require('restify'); // restify ^6.3.2
const plugins = require('restify').plugins;
const corsMiddleware = require('restify-cors-middleware');
const fs = require('fs');

const numUsers = require('./testRunner').createTestRunnerScript;

const cors = corsMiddleware({
  preflightMaxAge:5,
  origins: ['http://*.fmr.com','*'],
  allowHeaders: ['API-Token','Content-Type'],
  exposeHeaders: ['API-Token-Expiry']
})

let base='fileCatcher::';

var app = restify.createServer();
//app.use(restify.CORS());
app.use(plugins.queryParser());// all query parameters will be available in req.query & req.params

app.use(plugins.bodyParser()); // Handling POST body data

// Add timer before routing
let preS=0;

app.pre(cors.preflight)
app.use(cors.actual)

// =========================================================
// ---------------------------------------------------------
//    Core Restify pre/post request handling
app.pre(function(req,res,next){
  // console.log(req.headers)
  res.setHeader('Access-Control-Allow-Origin', '*');
  preS=process.hrtime()
  return next();
})

app.on('after',function(req,res,route,error){
  end=process.hrtime(req.time())
  console.log(base,req.method,req.path())
  console.log("\tExecution time (hr): %ds %dms", end[0], end[1]/1000000);
})
// ---------------------------------------------------------
//    End core restify pre/post
// ---------------------------------------------------------
// =========================================================


//------------------------------------------------------------------------
// Function to write supplied file contents to local file
async function addTestFile(req,res,next){
  let funNm=base+'addTestFile '
  contents=req.body

  console.log(funNm,contents)

  fileOb=contents
  if(typeof(fileOb)==='object'){
    fileContents=JSON.stringify(fileOb)
  } else {
    fileContents=fileOb
  }

  try{
    const writeState = await writeToFile(fileContents)
    console.log(funNm,writeState)
    res.send('success')
    next()
  } catch(err){
    console.log(funNm,'error',err)
    res.send('failure')
    next()
  }

}

function writeToFile(fileContents){
  return new Promise((fulfill, reject)=>{
    console.log('calling writeTextToFile')
    fs.writeFile('/FeTest/tests/test.json',fileContents,(err)=>{
      if(err) {
        console.log(funNm,'error writing ',contents,err)
        reject('write error')
      }
      console.log(base+'fileWrite - success')
      fulfill('success')
    })

  })
}
//------------------------------------------------------------------------
// Call function to add testRunner.sh file with requested number of users
async function usersPerHost(req, res, next) {
  let funNm=base+'usersPerHost'
  console.log(funNm)

  const setUsers=await numUsers(req.params.userCount)
  console.log(funNm,setUsers)
  res.send(setUsers)
  next()

}

// Stop running test
function stopTest(req,res,next){
  let funNm=base+'stopTest'
  console.log(funNm)
  const testOB=req.body
  console.log(funNm,testOB)

  // remove test.json
  fs.unlink('/FeTest/tests/test.json',(err)=>{
    if (err) {
      console.log(err)
    } else {
      console.log(funNm,'unlink test success')
      // remove testRunner.sh
      fs.unlink('/FeTest/tests/testRunner.sh',(err)=>{
        if (err) {console.log(err)
        } else {
          console.log(funNm,'unlink testRunner success')
          res.send('success')
        }
      })
    }
  })
  next()
}

function readyResponse(req,res,next){
  let funNm=base+'readyResponse'
  console.log(funNm)

  try{
    fs.open('/FeTest/tests/test.json','r',(error,fd)=>{
      if(error) res.send('ready')
      if(fd){
        fs.readFile(fd,'utf8',(err,contents)=>{
          if(err) res.send('ready')
          if(contents){
            try{
              data=JSON.parse(contents)
            } catch(e) { data=contents }

            t=data
            console.log(t)
            res.send({'product':t.productName,'environment':t.environment,'test':t.testName})
          }
        })
      }
    })
  } catch(e) {
    console.log(e)
    res.send('ready')
  }

  next()
}

function favIcon(req,res,next){
  let funNm=base+'favIcon'
  console.log(funNm)
  res.status(204)

  next()
}

// path to function mapping
app.get('/stopTest', stopTest)
app.post('/addTestFile', addTestFile)
app.get('/usersPerHost/:userCount',usersPerHost)

app.get('/favIcon.ico',favIcon)
app.get('/', readyResponse)

app.listen(8090, function(){
  console.log('%s listening at %s', app.name, app.url)
})
