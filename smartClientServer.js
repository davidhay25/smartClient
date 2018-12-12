#!/usr/bin/env node

/* The server for the smartClient app*/

const express = require('express')
const bodyParser = require('body-parser');  //https://expressjs.com/en/resources/middleware/body-parser.html - must be before setting app
const handlebars = require('handlebars');
const app = express();
const fs = require('fs');
const session = require('express-session');
const logger = require('./myModules/logger');
const smartModule = require('./myModules/smartModule');
const request = require('request');
const WebSocket = require('ws');


app.use(bodyParser.json());

const sessionParser = session({
    saveUninitialized: false,
    secret: 'mySecret',
    resave: true,
    cookie: { secure: true }
});

app.use(sessionParser);

//enable SSL - https://aghassi.github.io/ssl-using-express-4/
const https = require('https');

//try to load the SSL keys from the 'production' location
let privKey,cert,passphrase;
try {
    privKey = fs.readFileSync('/etc/letsencrypt/live/clinfhir.com/privkey.pem');
    cert = fs.readFileSync('/etc/letsencrypt/live/clinfhir.com/cert.pem');
    console.log('Able to read production SSL keys')
} catch (ex) {
    privKey = fs.readFileSync('./keys/key.pem');
    cert = fs.readFileSync('./keys/cert.pem');
    passphrase = 'password';
    console.log('using self signed SSL keys')
}


const sslOptions = {
    key: privKey,
    cert: cert,
    passphrase:passphrase
};

//create the https server onthe standard SSL port...
let server = https.createServer(sslOptions, app).listen(443);
console.log('server listening via TLS on port 443');

//serve pages from public folder
app.use(express.static('public',{index:'smartClient.html'}));

//sets the websocket connection to use for this session. Keyed to the source IP. There is a better way, but having
//issues making it work. this must be first middleware
app.use(function (req, res, next) {
    let ip = req.connection.remoteAddress;

    if (hashConnections[ip] ) {
        req.wsConnection = hashConnections[ip];        //really needs to be specific to user rather than source IP...
        next();
    }
    else {
        //if no websocket connection can be made then abort. Not sure if this is the right thing to do, but otherwise can't send messages back...
        res.redirect('error.html?msg=Unable to connect to the webSocket server...')
    }


});

smartModule.init(app);    //must be after the previous middleware fn assigning req.wsConnection

//----------- web socket stuff...
//https://www.npmjs.com/package/ws
const hashConnections = {};     //hash of connections indexed on source ip...

let wsConnection;       //this will be the most recent connection...
const wss = new WebSocket.Server({
    verifyClient: function(info, done) {
        //console.log('verifyClient() -> ', info.req.headers);
        //supposed to be able to parse the session here - would be good to associate the connection with it...
        done(info.req.headers);
    },
    server
});


//called when a connection is initiated to the websocket server...
wss.on('connection', function connection(ws,socket) {

    const ip = socket.connection.remoteAddress;
    wsConnection = ws;
    hashConnections[ip] = ws;       //the ws connewction object for a client from this ip
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
        ws.send(message);
    });

    ws.send('connected to the client server');
});


//When a smart profile has been selected in the browser, and login initiated. Receive the config to use,
// save the config against the session then
//load the capabilityStatement from the server, and set the SMART end points in the session also
app.post('/setup',function(req,res){
    let config = req.body;      //contains clientid, secret, baseUrl etc. - everything from the client config. Should really be on the server of course...

    let baseUrl = config.baseUrl;
    //make sure there is a trailing /
    if (baseUrl[baseUrl.length -1] !== '/')  {
        baseUrl += '/'
    }


    req.session.config = config;    //save the config for subsequent use...

    if (config.authEP || config.tokenEP) {
        let smFixedConfig={}
        smFixedConfig.authorize = config.authEP;
        smFixedConfig.token = config.tokenEP;
        req.session['smartEndpoints'] = smFixedConfig;
        req.session['serverData'] = {};

            logger.log(req.wsConnection,'OAuth end points were set in the client config');
        res.json(smFixedConfig)
        return
    }

    logger.log(req.wsConnection,'Retrieving CapabilityStatement from SMART server at '+ baseUrl + "metadata");

    let options = {
        method: 'GET',
        uri: baseUrl + "metadata",
        agentOptions: {
            rejectUnauthorized: false //allows self signed certificates to be used...
        },
        headers: {accept:'application/fhir+json'}       //the mime type for R3 onwards..
    };

    //retrieve the capability statement
    request(options, function (error, response, body) {
        if (response && response.statusCode == 200) {
            logger.log(wsConnection,'CapabilityStatement received from server');
            var capStmt = JSON.parse(body);
            req.session['serverData'] = {capStmt:capStmt}; //this will hold tokens & such so they can be displayed in the UI for debugging
            let smConfig={}
            smartModule.getSMARTEndpoints(smConfig,capStmt)
            req.session['smartEndpoints'] = smConfig;     //save the smart endpoints. They will be needed when authentication to the smart server
            res.json(smConfig)

        } else {
            let msg = error || body || {msg:'unknown error'}
            logger.log(wsConnection,'Error calling '+ options.uri + ": "+ msg.toString());
            req.session.error = {err: body};
            res.status(500).send({msg:req.session.error});

        }
    })
});

//return the serverData object - holds all the tokens and other config data for display in the UI
app.get('/serverdata',function(req,res){
    if (req.session.serverData) {
        res.json(req.session.serverData)
    } else {
        res.json({})
    }
});

//returns the initial configurations that are 'hard coded' into the app. Will be saved in the browser cache...
app.get('/smartConfig',function(req,res){
   res.sendFile(__dirname + "/config/smartServers.json")
});
