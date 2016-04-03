// app.js
// This file contains the server side JavaScript code for your application.
// This sample application uses express as web application framework (http://expressjs.com/),
// and jade as template engine (http://jade-lang.com/).

var express = require('express');
var MonkeyLearn = require('monkeylearn');
var https = require('https');
var url = require('url');
var querystring = require('querystring');
var xmlescape = require('xml-escape');
var watson = require('watson-developer-cloud');


// setup middleware
var app = express();
app.use(express.errorHandler());
app.use(express.urlencoded()); // to support URL-encoded bodies
app.use(app.router);

app.use(express.static(__dirname + '/public')); //setup static public directory
app.set('view engine', 'jade');
app.set('views', __dirname + '/views'); //optional since express defaults to CWD/views



//----------start----------------------------------------------------------
var relationship_extraction = watson.relationship_extraction({
  username: '260764c8-81ae-4b42-8fdd-ff417233a4d4',
  password: 'HdE56JeTkth7',
  version: 'v1-beta'
});

// relationship_extraction.extract({
//   text: 'My son was being followed by an unknown man in the morning. He looks like a 40 year old wearing black clothes and white most probably. This happened at around 8am at 323 Wolf Street, Los Angeles. Please help.',
//   dataset: 'ie-en-news' },
//   function (err, response) {

//     if (err)
//       console.log('error:', err);
//     else{
//       var temp = response.doc.entities.entity;
//     for(var i = 0; i < temp.length; i++)
//       {
//       console.log(temp[i].type,JSON.stringify(temp[i].mentref[0].text, null, 2));
//       }
//     }
// });
//----------end----------------------------------------------------------



// There are many useful environment variables available in process.env.
// VCAP_APPLICATION contains useful information about a deployed application.
var appInfo = JSON.parse(process.env.VCAP_APPLICATION || "{}");
// TODO: Get application information and use it in your app.

// defaults for dev outside bluemix
var service_url = 'https://gateway.watsonplatform.net/relationship-extraction-beta/api';
var service_username = '260764c8-81ae-4b42-8fdd-ff417233a4d4';
var service_password = 'HdE56JeTkth7';

// VCAP_SERVICES contains all the credentials of services bound to
// this application. For details of its content, please refer to
// the document or sample of each service.
if (process.env.VCAP_SERVICES) {
  console.log('Parsing VCAP_SERVICES');
  var services = JSON.parse(process.env.VCAP_SERVICES);
  //service name, check the VCAP_SERVICES in bluemix to get the name of the services you have
  var service_name = 'relationship_extraction';
  
  if (services[service_name]) {
    var svc = services[service_name][0].credentials;
    service_url = svc.url;
    service_username = svc.username;
    service_password = svc.password;
  } else {
    console.log('The service '+service_name+' is not in the VCAP_SERVICES, did you forget to bind it?');
  }

} else {
  console.log('No VCAP_SERVICES found in ENV, using defaults for local development');
}

console.log('service_url = ' + service_url);
console.log('service_username = ' + service_username);
console.log('service_password = ' + new Array(service_password.length).join("X"));

var auth = 'Basic ' + new Buffer(service_username + ':' + service_password).toString('base64');

// render index page
app.get('/', function(req, res){
    res.render('index');
});

// Handle the form POST containing the text to identify with Watson and reply with the language
app.post('/', function(req, res){

  var parts = url.parse(service_url);

  // create the request options from our form to POST to Watson
  var options = { 
    host: parts.hostname,
    port: parts.port,
    path: parts.pathname,
    method: 'POST',
    headers: {
      'Content-Type'  :'application/x-www-form-urlencoded',
      'X-synctimeout' : '30',
      'Authorization' :  auth }
  };

var finalOutput='';

//-------start
relationship_extraction.extract({
  text: req.body.txt,
  dataset: 'ie-en-news' },
  function (err, response) {
    //fetching entities and building a string
    if (err)
      console.log('error:', err);
    else{
      var temp = response.doc.entities.entity;
    for(var i = 0; i < temp.length; i++)
      {
        finalOutput= finalOutput + '\n' + temp[i].type + JSON.stringify(temp[i].mentref[0].text);
      console.log(temp[i].type,JSON.stringify(temp[i].mentref[0].text, null, 2));
      }
    }

    //call monkeylearn and find the crime category
    var ml = new MonkeyLearn('1e98c9c6fea2aacefcdaa85139610725f42366fe');
    var ml_prediction='';
var module_id = 'cl_N8BmpbrK';
var text_list = [req.body.txt];
var p = ml.classifiers.classify(module_id, text_list, true);
p.then(function (res2) {
  var temp = res2.result;
  temp = temp[0];
  if (temp.length>1)
  {
    ml_prediction = '\nCrime Prediction:' + temp[0].label + ' --> ' +temp[1].label +'\n';
  console.log('\nCrime Prediction:',temp[0].label + ' --> ' +temp[1].label +'\n');
}
else
{
  ml_prediction = '\nCrime Prediction:' + temp[0].label + '\n';
  console.log('\nCrime Prediction:',temp[0].label + '\n');
}
});


    // Create a request to POST to Watson
  var watson_req = https.request(options, function(result) {
    result.setEncoding('utf-8');
    var resp_string = '';

    result.on("data", function(chunk) {
      resp_string += chunk;
    });

    result.on('end', function() {
      console.log('######################'+req.body.txt);
      //return res.render('index',{'xml':xmlescape(resp_string), 'text':req.body.txt})
      //return res.render('index',{locals:{title: 'edit your blog', posts: "Can I render anything I want?"}});
    res.render('index', { watson_response: finalOutput, ml_response: ml_prediction });
    //res.render('index', { watson_response2: 'sample response' });
    return res.render('index');
    })

  });


  watson_req.on('error', function(e) {
    return res.render('index', {'error':e.message})
  });

  // Whire the form data to the service
  watson_req.write(querystring.stringify(req.body));
  //console.log(querystring.stringify(req.body));
  watson_req.end();


});
//-------end

});


// The IP address of the Cloud Foundry DEA (Droplet Execution Agent) that hosts this application:
var host = (process.env.VCAP_APP_HOST || 'localhost');
// The port on the DEA for communication with the application:
var port = (process.env.VCAP_APP_PORT || 3000);
// Start server
app.listen(port, host);