const puppeteer = require('puppeteer');

async function testAmazon(){
  const browser = await puppeteer.launch({
    headless:false
  })
  const page = await browser.newPage()
  await page.setViewport({width:1400,height:900})
  await page.goto('http://amazon.com')

  await page.type('#twotabsearchtextbox', 'cheeky monkey', {delay:100})

  const [response] = await Promise.all([
    page.waitForNavigation({waitUntil:"networkidle2"}),
    page.click(".nav-search-submit"),
  ]);

  await page.waitForSelector("[id~=result_2]",{visible:true})
  await page.click("[id~=result_2]")
  await page.waitForSelector("#ad",{visible:true})


  await browser.close()
}

testAmazon()
