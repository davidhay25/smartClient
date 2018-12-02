const express = require('express')
const bodyParser = require('body-parser');  //https://expressjs.com/en/resources/middleware/body-parser.html - must be before setting app
const handlebars = require('handlebars');
const app = express();
const fs = require('fs');
const session = require('express-session');
const logger = require('./myModules/logger');
const smart = require('./myModules/smartClient');
const request = require('request');
const WebSocket = require('ws');

//app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

//initialize the session...
/*
app.use(session({
    secret: 'mySecret',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: true }   // secure cookins needs ssl...
}));
*/

const sessionParser = session({
    saveUninitialized: false,
    secret: 'mySecret',
    resave: true,
    cookie: { secure: true }
})

app.use(sessionParser);




//enable SSL - https://aghassi.github.io/ssl-using-express-4/
const https = require('https');
const sslOptions = {
    key: fs.readFileSync('./keys/key.pem'),
    cert: fs.readFileSync('./keys/cert.pem'),
    passphrase:'ne11ieh@y'
};

//create the https server...
let server = https.createServer(sslOptions, app).listen(8448);
console.log('server listening via TLS on port 8448');

//serve pages from public folder
app.use(express.static('public'));

//this must be first middleware
app.use(function (req, res, next) {
    let ip = req.connection.remoteAddress;
    //console.log('ip',ip)

    if (hashConnections[ip] ) {
        console.log('setting ws connection from hash')
        req.wsConnection = hashConnections[ip];        //really needs to be specific to user rather than source IP...
    } else {
        req.wsConnection = wsConnection;        //really needs to be specific to user...
    }

    //console.log('setting wsConnection',(wsConnection !== null))
    next();
});

smart.init(app);    //must be after the previous middleware fn assigning req.wsConnection

//----------- web socket stuff...
//https://www.npmjs.com/package/ws
const hashConnections = {};     //hash of connections indexed on source ip...

let wsConnection;       //this will be the most recent connection...
const wss = new WebSocket.Server({
    verifyClient: function(info, done) {
        //console.log('verifyClient() -> ', info.req.headers);
        //supposed to be able to parse the session here - woul dbe good to associate the connection with it...
        done(info.req.headers);
    },
    verifyClientDEP: (info, done) => {

       // done(true)
        console.log('Parsing session from request...')

        sessionParser(info.req, {}, () => {
            console.log('Session is parsed!')

            done(info.req.session.userId)
        })
    },
    server
});


//called when a connection is initiated to the websocket server...
wss.on('connection', function connection(ws,socket) {
    console.log('connection')
    const ip = socket.connection.remoteAddress;
    console.log(ip)
    //let sid = cookieParser.signedCookie(cookie.parse(req.headers.cookie)['connect.sid'], '$eCuRiTy');
    wsConnection = ws;
    hashConnections[ip] = ws;       //the ws connewction object for a client from this ip
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
        ws.send(message);
    });

    ws.send('connected to the client server');
});


//When a smart profile has been selected. Receive the config to use, then
//load the capabilityStatement from the server, and set the SMART end points in config
app.post('/setup',function(req,res){
    config = req.body;      //contains all the secrets...

    logger.log(req.wsConnection,'Retrieving CapabilityStatement from SMART server at '+ config.baseUrl + "metadata");
    req.session.config = req.body;


    console.log(config)
    //req.session.config = config;
    delete req.session['serverData'];      //will return the server granted scope

    var options = {
        method: 'GET',
        uri: config.baseUrl + "metadata",
        agentOptions: {         //allows self signed certificates to be used...
            rejectUnauthorized: false
        },
        headers: {accept:'application/json+fhir'}       //todo - may need to set this according to the fhir version...
    };

    console.log('options',options);

    request(options, function (error, response, body) {
        if (response && response.statusCode == 200) {
            logger.log(wsConnection,'CapStmt received from server');

            var capStmt = JSON.parse(body);
            req.session['serverData'] = {capStmt:capStmt};
            let config={}
            smart.getSMARTEndpoints(config,capStmt)
            console.log('config',config)
            req.session['smartEndpoints'] = config;     //save the smart endpoints. They will be needed when authentication to the smart server
            res.json(config)

        } else {
            console.log('Error calling '+ options.uri)
            logger.log(wsConnection,'Error calling '+ options.uri + ": "+ error.toString());

            console.log(body)
            console.log(error.toString())
            req.session.error = {err: body};
            res.status(500).send({msg:req.session.error});

        }
    })
});

app.get('/serverdata',function(req,res){
    if (req.session.serverData) {
        res.json(req.session.serverData)
    } else {
        res.json({})
    }
});

