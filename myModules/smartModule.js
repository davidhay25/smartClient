/*
* The module that acts as a SMART client to the external SMART protected server.
* It is a nodejs module and runs on the local server (as it supports the confidential profile)
* */

const logger = require('./logger');
const request = require('request');
const jwt  = require('jsonwebtoken');   //https://www.npmjs.com/package/jsonwebtoken
const jwkToPem = require("jwk-to-pem"); //https://www.npmjs.com/package/jwk-to-pem


//called by server.js (the local server)
let init = (app) => {

    //The first step in authentication. The browser will navigate to this 'page' and receive a redirect to the login page
    //In a real SMART client, the credentials would be on the server already in a config file of some sort
    app.get('/appAuth', function(req, res)  {

        let config = req.session.config;    //the config set in /setup when this login started...
        logger.log(req.wsConnection,'Redirecting to auth server. Scope='+ req.query.scope);

        //the smart end points were parsed from the capstmt in the /setup handler
        let smartEndpoints = req.session['smartEndpoints']

        //save the requested scope...
        req.session["scope"] = req.query.scope || config.defaultScope;

        //generate the uri to re-direct the browser to. This will often be the login page for the system
        var authorizationUri = smartEndpoints.authorize;

        //Some servers don't have https in the url (an error)
        authorizationUri = authorizationUri.replace('http://','https://')
        authorizationUri += "?redirect_uri=" + encodeURIComponent(config.callback);
        authorizationUri += "&response_type=code";
        authorizationUri += "&scope=" + encodeURIComponent(req.session["scope"]);
        authorizationUri += "&state="+ "test";
        authorizationUri += "&aud="+ config.baseUrl;
        authorizationUri += "&client_id="+config.clientId;

        logger.log(req.wsConnection,'Url: '+ decodeURIComponent(authorizationUri),'app');
        res.redirect(authorizationUri);

    });

    //after authentication the browser will be redirected by the auth server to this endpoint
    app.get('/callback', function(req, res) {
        var code = req.query.code;
        console.log(req.query)
        logger.log(req.wsConnection,'callback invoked. code='+code,'app');



        //If authentication was successful, the Authorization Server will return a code which can be exchanged for an
        //access token. If there is no code, then authorization failed, and a redirect to an error page is made.
        if (! code) {
            logger.log(req.wsConnection,'error reported from server. Details in the iframe')
            req.session.error = req.query;  //any error message will be in the querystring...
            res.redirect('error.html?msg='+JSON.stringify(req.query) )
            return;
        }

        //request an access token from the Auth server.
        let smartEndpoints = req.session['smartEndpoints']; //retrieve the configuration from the session. This was set in /appAuth.
        let config = req.session.config;    //the config set in /setup when this login started...

        let vo = {};    //info to pass into the 'getAccessToken' function...
        vo.code = code;
        vo.url = smartEndpoints.token;
        vo.callback = config.callback;
        vo.public = config.public;
        vo.clientId = config.clientId;
        vo.secret = config.secret;
        vo.type = 'code';       //other option is 'refresh'
        vo.wsConnection = req.wsConnection;
        vo.session = req.session;
        getAccessToken(vo).then(
            function(){
                //logger.log(req.wsConnection,'retrieved Access token','app');
                res.redirect('query.html');
            },
            function(msg) {
                logger.log(req.wsConnection,'error calling Access Token request:'+msg,'app');
                res.redirect('error.html?msg='+msg)
            }
        )
    });

    //make a FHIR call. the remainder of the query beyond '/orionfhir/*' is the actual query to be sent to the server
    app.get('/sendquery/*',function(req,res){

        let fhirQuery = req.originalUrl.substr(11); //strip off /sendquery
        let access_token = req.session['accessToken'];

        if (!access_token) {
            logger.log(req.wsConnection,"The access token is null - can't proceed",'app');
            res.send({error:'Empty access token'},500)
        }

        let config = req.session["config"];     //retrieve the configuration from the session...

        let url;
        if (config.baseUrl[config.baseUrl.length-1] !== '/') {
            url = config.baseUrl + '/' + fhirQuery;
        } else {
            url = config.baseUrl  + fhirQuery;
        }

        let options = {
            method: 'GET',
            uri: url,
            encoding : null,
            agentOptions: {         //allows self signed certificates to be used...
                rejectUnauthorized: false
            },
            headers: {'authorization': 'Bearer ' + access_token,'accept':'application/fhir+json'}
        };
        logger.log(req.wsConnection,'Making request: '+url,'app');

        request(options, function (error, response, body) {
            if (error) {
                var err = error || body;
                res.send(err,500)
            } else if (response && response.statusCode !== 200) {
                //eg if asked for a resource that you don't have access to...
                var err = {err: body.toString()};
                err.statusCode = response.statusCode
                res.status(500).send(err);
            } else {
                res.send(body)
            }
        })
    });



};

let getAccessToken = (vo) => {
    return new Promise(function(resolve,reject){
        logger.log(vo.wsConnection,'Requesting access token','app');
        var options = {
            method: 'POST',
            uri: vo.url,
            agentOptions: {
                rejectUnauthorized: false //allows self signed certificates to be used...
            },
            body: 'code=' + vo.code + "&grant_type=authorization_code&redirect_uri=" + encodeURIComponent(vo.callback),
            headers: {'content-type': 'application/x-www-form-urlencoded'}
        };

        if (vo.public) {
            //a public client includes the client id, but no auth header
            options.body += '&client_id='+ vo.clientId;
        } else {
            //a confidential client creates an Authorization header
            var buff = new Buffer(vo.clientId + ':' + vo.secret);
            options.headers.Authorization = 'Basic ' + buff.toString('base64')
        }

        //perform the POST request to get the access token...
        request(options, function (error, response, body) {

            if (error) {
                logger.log(vo.wsConnection,'error calling auth token request: '+ error.toString(),'app');
                reject(error.toString());
                return;
            }

            if (response) {
                if ( response.statusCode == 200) {
                    //save the access token in the session cache. Note that this is NOT sent to the client
                    var token = JSON.parse(body);
                    console.log('-----------');

                    console.log('at',token)
                    console.log('-----------');


                    logger.log(vo.wsConnection,'successful access token request','app');
                   // logger.log(vo.wsConnection,body,'app');
                    vo.session['accessToken'] = token['access_token'];  //used when making server queries...


                    vo.session.serverData['authServerResponse'] = token
                    vo.session.serverData.scope = token.scope;
                    //vo.session.serverData.fullToken = token;
                    //vo.session.serverData.config = vo.session["config"];
                    vo.session.serverData.accessToken = token['access_token']


                    let access_token = token['access_token'];
                    //logger.log(vo.wsConnection,access_token,'app');
                    //see if the auth token is a jwt token.
                    try {
                        //let decodedToken = jwt.verify(access_token, {complete: true})
                        let decodedToken = jwt.decode(access_token, {complete: true})
                        console.log('dat',decodedToken)
                        console.log('-----------');
                        vo.session.serverData.decodedAccessToken = decodedToken;
                        logger.log(vo.wsConnection,'access token is a JWT token','app');


                    } catch (ex) {
                        logger.log(vo.wsConnection,'access token is NOT a JWT token','app');
                        console.log('Access token is not a JWT token')
                    }

                    //console.log('-----------',access_token);

                    //an id token was returned
                    let id_token = token['id_token'];
                    if (id_token) {
                        logger.log(vo.wsConnection,'An id token was returned. Validating... ','app');

                        //validates that the idtoken is correct and returns the decoded token...
                        validateIDToken(id_token).then(
                            function(token){
                                vo.session.serverData.idToken = token;
                                console.log('it',token,vo.session.serverData.idToken)
                                logger.log(vo.wsConnection,'Id token is valid ','app');
                                resolve();
                            },
                            function(err){
                                logger.log(vo.wsConnection,'Token failed validation: '+err,'app');
                                resolve();      //still resolve the promise
                            }
                        );
                    } else {
                        resolve();
                    }
                } else {
                    logger.log(vo.wsConnection,'error making access token request:'+response.statusCode,'app');
                }

            } else {
                console.log(body);
                console.log(error);
                logger.log(vo.wsConnection,'error making access token request','app');
                reject(body)
                vo.session.error = body;
            }
        })
    })
};


let validateIDToken = (rawidtoken) => {


    return new Promise(function(resolve,reject) {
        let idtoken;
        try {
            idtoken = jwt.decode(rawidtoken, {complete: true});     //todo look for errors...
        } catch (ex) {
            reject("Id token was not a valid JWT token")
            return;
        }

        let issuer = idtoken.payload.iss || token.payload.issuer;      //the issuer of the token (the spec says 'issuer' but I think it means 'iss'...
        if (issuer) {
            let configUrl = issuer + '/.well-known/openid-configuration';     //the location of the keys..
            request.get(configUrl, function (err, resp, body) {
                if (!err && body) {
                    var json = JSON.parse(body)
                    if (json['jwks_uri']) {
                        var url = json['jwks_uri'];
                        request.get(url, function (err, resp, body) {
                            if (!err && body) {
                                let webKey = JSON.parse(body);        //should be the decryption keys...

                                //just grab the first key...
                                var key = webKey.keys[0]

                                let alg = idtoken.header.alg;   //signing algorithm used

                                //now verify the token. Returns the decoded token if valid..
                                try {
                                    let outcome = jwt.verify(rawidtoken,jwkToPem(key),{algorithms:[alg]})
                                    console.log('out',outcome)
                                    //throws an exception if fails validation, so must be OK..
                                    resolve(outcome)
                                } catch (ex) {
                                    console.log('error verifying jwt:',ex)
                                    reject("Id token failed validation")
                                }


                            } else {
                                reject("couldn't find " + url + " (from " + configUrl + ")")
                               // req.session.error = {err: "couldn't find " + url + " (from " + config.clientIdConfig + ")"};
                                //res.redirect('smartError.html')
                            }
                        })


                    } else {
                        reject("Able to retrieve keys from "+configUrl +", but there was no 'jwks_uri' property" )
                    }

                } else {
                    reject("Can't get the keys from "+configUrl )
                }
            })
        } else {
            reject('No issuer property in the id token')
        }


        //resolve();
        //return;
        //how get the keys to decrypt the id token. I'm not yet sure this is the right place...
        //in particular, this means that teh server MUST support the whole key lookup thing...

    })

}


//retrieve the server endpoints from the capability statement
let getSMARTEndpoints =(config,capstmt) => {
    var smartUrl = "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris";
    try {
        var extensions = capstmt.rest[0].security.extension;
        extensions.forEach(function(ext) {
            if (ext.url == smartUrl) {
                ext.extension.forEach(function(child){
                    switch (child.url) {
                        case 'authorize' :
                            config.authorize = child.valueUri;
                            break;
                        case 'token' :
                            config.token = child.valueUri;
                            break;
                        case 'register' :
                            config.register = child.valueUri;
                            break;


                    }
                })
            }
        })
    } catch(ex) {
        return ex
    }
}

exports.getSMARTEndpoints = getSMARTEndpoints;
exports.init = init;