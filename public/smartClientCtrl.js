angular.module("smartTester")
    .controller('smartClientCtrl',
        function ($scope,$http,$localStorage,$uibModal,$timeout) {


            //note: https://chrome.google.com/webstore/detail/ignore-x-frame-headers/gleekbfjekiniecknbkamfmkohkpodhe/related
            //ensures that login can be in iframe






            //the websocket for feedback from the local server
            let wsUrl = 'wss://'+ window.location.host;
            let ws = new WebSocket(wsUrl);

            //the callback url
            $scope.callBackUrl = window.location.origin + "/callback";



            $scope.input = {};

            $scope.messages = [];

            ws.onmessage = function(event) {
                $scope.messages.push({msg:event.data,src:'server'});
                $scope.$digest();
            };

            $scope.showHelp = function() {
                $scope.iframeUrl = "instructions.html";
            };
           // $scope.showHelp();

            $scope.selectServer = function(svr) {
                delete $scope.invalidCallback;
                delete $scope.useTab;       //if true then uses a tab rather than the iframe
                $scope.input.scope = svr.defaultScope;

                //check that the callback is the correct one
                if (svr.callback !== $scope.callBackUrl) {
                    $scope.invalidCallback = true;
                }



                if (svr.browser == 'tab') {
                    $scope.useTab = true;
                }
            };


            //store the configuration in local storage. Initialize from the pre-defined set...
            if (! $localStorage.smartConfig) {
                $http.get('smartServers.json').then(
                    function(data) {
                        $localStorage.smartConfig = data.data.servers
                        //$scope.smartServers = data.data.servers;

                        $scope.servers = $localStorage.smartConfig;
                        $scope.input.server = $localStorage.smartConfig[0]
                        $scope.selectServer($scope.input.server);       //set the default scope at startup

                    }, function(err) {
                        alert('Unable to load config')
                    }
                );
            } else {
                $scope.servers = $localStorage.smartConfig;
                $scope.input.server = $scope.servers[0]
                $scope.selectServer($scope.input.server);       //set the default scope at startup

            }


            //edit the list of smart servers configured in this browser
            $scope.editList = function() {

                let currentServerName = $scope.input.server.name;
                $uibModal.open({
                    templateUrl: 'editSMARTServerList.html',
                    size : 'lg',
                    backdrop : 'static',
                    controller:
                        function($scope,servers,callBackUrl) {
                            $scope.servers = servers;
                            $scope.callBackUrl = callBackUrl;
                            $scope.dirty = false;

                            //Select a server from the list
                            $scope.selectSvr = function (svr) {
                                $scope.selectedServer = svr
                                $scope.selectedServer.browser = $scope.selectedServer.browser || 'iframe';
                            };

                            //remove the current item
                            $scope.remove = function() {
                                let pos = -1
                                $scope.servers.forEach(function(svr,inx){
                                    if (svr.name == $scope.selectedServer.name ) {
                                        pos = inx
                                    }
                                });
                                if (pos > -1) {
                                    $scope.servers.splice(pos,1)
                                    $scope.dirty = true;
                                }
                            };

                            $scope.change = function(){
                                $scope.dirty = true;
                            };

                            //Add a new server
                            $scope.add = function() {
                                let newServer = {"name":"New Server",callback:callBackUrl,defaultScope:'Patient/*.read',browser:'iframe'}
                                $scope.servers.push(newServer)
                                $scope.selectedServer = newServer;
                                $scope.dirty = true;
                            };

                            $scope.save = function(){
                                $scope.$close($scope.servers)
                            }

                    },
                    resolve: {
                        servers: function () {          //the default config
                            return  angular.copy($scope.servers) ;
                        },
                        callBackUrl: function(){
                            return $scope.callBackUrl
                        }
                    }
                }).result.then(
                    function(lst) {
                        //if the list has been updated

                        $localStorage.smartConfig = lst;    //update the list in the browser cache
                        $scope.servers = lst                //and locally...

                        //find and update the current server
                        $scope.servers.forEach(function (svr) {
                            if (svr.name == currentServerName) {
                                $scope.input.server = svr;
                                $scope.selectServer(svr);



                            }

                        })
                    },function(){
                        //cancel
                    }

                )

            };


            //initiate the login handshake...
            $scope.start = function() {

                $scope.iframeUrl = "about:blank";

                if ($scope.input.server.callback !== $scope.callBackUrl) {
                    alert('The callback url must be '+ $scope.callBackUrl);
                    return
                }

                $scope.messages.length = 0;
                $scope.messages.push({msg:"Initiating login by sending config to the local server...",src:'server'});
                let config = angular.copy($scope.input.server);
                //config.now = new Date().getTime();      //so we can calculate the token expiry relative to local time...
                $http.post('/setup',config).then(
                    function(data) {
                        console.log(data.data)
                        let url = '/appAuth?scope=' + $scope.input.scope;
                        let smartEndpoints = data.data;     //setup will return the smart endpoints parsed from the capStmt
                        //direct the iframe to the auth endpoint in the app server. This will re-direct to the smart server endpoint...
                        //the smart endpoints will have also been saved in the app server session



                        if ($scope.useTab) {
                            //use a separate tab for the browser
                            $scope.externalTabUrl = url//;config.authorize;
                        } else {
                            //use an iframs for the browser
                            $scope.iframeUrl = url
                        }

                        //$scope.iframeUrl = url//;config.authorize;
                    },
                    function(err) {
                        console.log(err)
                    }
                );
            };

            //after opening the separate tab, this will hide the button
            $scope.newTabActivated = function() {
                $timeout(function(){
                    delete $scope.externalTabUrl
                },10000)

            }

        }
        ).filter('trustAsResourceUrl', ['$sce', function($sce) {
             return function(val) {
                return $sce.trustAsResourceUrl(val);
            };
        }]);