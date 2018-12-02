const logger = require('./logger');
const request = require('request');
const jwt  = require('jsonwebtoken');

let init = (app) => {



//The first step in authentication. The browser will load this 'page' and receive a redirect to the login page
    app.get('/appAuth', function(req, res)  {

        logger.log(req.wsConnection,'Auth called by local server. Scope='+ req.query.scope);
        //the smart end points were parsed from the capstmt in the /setup handler
        let smartEndpoints = req.session['smartEndpoints']

        //save the requested scope...
        req.session["scope"] = req.query.scope || 'launch/patient';

        //req.session["page"] = "smartQuery.html";

        //generate the uri to re-direct the browser to. This will often be the login page for the system
        var authorizationUri = smartEndpoints.authorize;
        //Some servers don't have https in the extension (an error)
        authorizationUri = authorizationUri.replace('http://','https://')

        authorizationUri += "?redirect_uri=" + encodeURIComponent(config.callback);
        authorizationUri += "&response_type=code";
        authorizationUri += "&scope=" + encodeURIComponent(req.session["scope"]);
        authorizationUri += "&state="+ "test";
        authorizationUri += "&aud="+ config.baseUrl;
        authorizationUri += "&client_id="+config.clientId;

        logger.log(req.wsConnection,'Redirecting to '+ decodeURIComponent(authorizationUri),'app');
        res.redirect(authorizationUri);

    });


//after authentication the browser will be redirected by the auth server to this endpoint
    app.get('/callback', function(req, res) {
        var code = req.query.code;
        logger.log(req.wsConnection,'callback invoked. code='+code,'app');

        //If authentication was successful, the Authorization Server will return a code which can be exchanged for an
        //access token. If there is no code, then authorization failed, and a redirect to an error page is returned.

        if (! code) {
            //no code, redirect to error
            req.session.error = req.query;  //any error message will be in the querystring...
            res.redirect('error.html?msg='+JSON.stringify(req.query) )
            return;
        }

        //request an access token from the Auth server.
        let smartEndpoints = req.session['smartEndpoints']; //retrieve the configuration from the session. This was set in /auth.

        var vo = {}
        vo.code = code;
        vo.url = smartEndpoints.token;
        vo.callback = config.callback;
        vo.public = config.public;
        vo.clientId = config.clientId;
        vo.secret = config.secret;
        vo.type = 'code';       //other option is 'refresh'
        vo.wsConnection = req.wsConnection;
        vo.session = req.session;
        getAuthToken(vo).then(
            function(){
                logger.log(req.wsConnection,'retrieved Auth token','app');
                res.redirect('query.html');
            },
            function(msg) {
                logger.log(req.wsConnection,'error calling auth token request:'+msg,'app');
                res.redirect('error.html?msg='+msg)
            }
        )
    });
};



let getAuthToken = (vo) => {
    return new Promise(function(resolve,reject){

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

        //perform the POST request to get the auth token...
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
                    logger.log(vo.wsConnection,'successful auth token request','app');

                    vo.session['accessToken'] = token['access_token']
                    vo.session.serverData.scope = token.scope;
                    vo.session.serverData.fullToken = token;
                    vo.session.serverData.config = vo.session["config"];

                    //assume the auth token is a jwt token.
                    try {
                        var at = jwt.decode(token['access_token'], {complete: true})
                        console.log(at)
                        vo.session.serverData.decodedAccessToken = at
                        logger.log(vo.wsConnection,'Auth token a JWT token','app');

                    } catch (ex) {
                        console.log('Access token is not a JWT token')
                    }
                    console.log('-----------')
                    //an id token was returned
                    if (token['id_token']) {
                        var id_token = jwt.decode(token['id_token'], {complete: true});
                        vo.session.serverData['idToken'] = id_token;
                        console.log('id_token')
                        console.log(id_token)
                        console.log('-----------')
                    }
                    resolve();
                } else {
                    logger.log(vo.wsConnection,'error calling auth token request:'+response.statusCode,'app');
                }

            } else {
                console.log(body);
                console.log(error);
                logger.log(vo.wsConnection,'error calling auth token request','app');
                reject(body)
                vo.session.error = body;

            }
        })



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