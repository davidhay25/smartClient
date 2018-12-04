angular.module("smartTester")
    .controller('mainCtrl',
        function ($scope,$http) {


            //note: https://chrome.google.com/webstore/detail/ignore-x-frame-headers/gleekbfjekiniecknbkamfmkohkpodhe/related
            //ensures that login can be in iframe

            let wsUrl = 'wss://'+ window.location.host
            let ws = new WebSocket(wsUrl);



            $scope.input = {};

            $scope.messages = [];

            ws.onmessage = function(event) {
                $scope.messages.push({msg:event.data,src:'server'});
                $scope.$digest();
            };

            $http.get('/smartConfig').then(
                function(data) {
                    $scope.smartServers = data.data.servers;
                    $scope.input.server = $scope.smartServers[0]
                }, function(err) {
                    alert('Unable to load config')
                }
            );

            $scope.start = function() {
                $scope.messages.length = 0;
                $scope.messages.push({msg:"Initiating login...",src:'server'});
                $http.post('/setup',$scope.input.server).then(
                    function(data) {
                        console.log(data.data)
                        let url = '/appAuth?scope=' + $scope.input.server.defaultScope;
                        let smartEndpoints = data.data;     //setup will return the smart endpoints parsed from the capStmt
                        //direct the iframe to the auth endpoint in the app server. This will re-direct to the smart server endpoint...
                        //the smart endpoints will have also been saved in the app server session
                        $scope.messages.push({msg:'Redirecting to auth server'});
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