angular.module("smartTester")
    .controller('mainCtrl',
        function ($scope,$http) {

            var ws = new WebSocket("wss://localhost:8448");
            console.log(ws)

            $scope.messages = []

            ws.onmessage = function(event) {
                console.log(event)
                $scope.messages.push({msg:event.data,src:'server'})
                $scope.$digest();
            };

            /*
            setTimeout(function(){
                console.log('sending ping...')
                ws.send('ping!')
            },2000)

            */



            $scope.setup = function() {


                let configY = {
                    "name" : "SmartHealthIT - successful",
                    "description":"Calls the SMART sandbox provider standalone,",
                    "fhirVersion" : "3",
                    "baseUrl" : "https://launch.smarthealthit.org/v/r3/sim/eyJoIjoiMSIsImkiOiIxIiwiZSI6InNtYXJ0LVByYWN0aXRpb25lci03MTAzMjcwMiJ9/fhir/",
                    "callback" : "https://localhost:8448/callback",
                    "clientId" : "d90584cc-3b0e-40db-8543-536df45a84f4",
                    "secret": "a07NAYD7lnhfBh1b9614dPp_lZxyK5Hf7ImS8GJ2XnbD8SE-ZzAqJhyKykL7359ip0AG5bLC172_M5mhWxuRig",
                    "clientIdConfig": "https://launch.smarthealthit.org/.well-known/openid-configuration",
                    "defaultScope" :"openid profile patient/*.*"

                }

                let config = {
                    "name" : "myServer",
                    "description":"My very own SMART server",
                    "fhirVersion" : "3",
                    "baseUrl" : "https://localhost:8444/fhir/",
                    "callback" : "https://localhost:8448/callback",
                    "clientId" : "clinfhir-test",
                    "secret": "mySecret",
                    "defaultScope" :"openid profile patient/*.read",
                    "clientIdConfig": "https://localhost:8444/fhir/openid-configuration"
                };

                $http.post('/setup',config).then(
                    function(data) {
                        console.log(data.data)
                        let url = '/appAuth?scope=' + config.defaultScope
                        let smartEndpoints = data.data;     //setup will return the smart endpoints parsed from the capStmt
                        //direct the iframe to the auth endpoint in the app server. This will re-direct to the smart server endpoint...
                        //the smart endpoints will have also been saved in the app server session
                        $scope.messages.push({msg:'Redirecting to auth server'})
                        $scope.authEndpoint = url//;config.authorize;
                    },
                    function(err) {
                        console.log(err)
                    }
                );
            }
        }
        ).filter('trustAsResourceUrl', ['$sce', function($sce) {
             return function(val) {
                 console.log(val)
                return $sce.trustAsResourceUrl(val);
            };
        }])