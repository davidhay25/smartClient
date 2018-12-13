

angular.module("queryApp")
    .controller('queryCtrl',
        function ($scope,$http,moment,$interval) {

            $scope.input = {}





            //retrieve the tokens and other info collected during the login so we can show it..
            $http.get('/serverdata').then(
                function (data) {
                    console.log(data.data);
                    $scope.scope = data.data.scope;
                    $scope.capStmt = data.data.capStmt

                    $scope.idToken = data.data.idToken;
                    $scope.fullToken = data.data.authServerResponse;
                    $scope.accessToken = data.data.accessToken;
                    $scope.refreshToken = data.data.refreshToken;
                    $scope.config = data.data.config;
                    $scope.atDecoded = data.data.decodedAccessToken;

                    if (data.data.authServerResponse['expires_in']) {
                        let d = new Date();
                        $scope.expires = moment(d).add(data.data.authServerResponse['expires_in'],'seconds').toDate();
                       // console.log(m.format());

                        //activate the countdown timer
                        $scope.cnt = 0
                        $interval(function(){

                            let remaining = moment($scope.expires).diff(moment(),'s')
                            let m = parseInt(remaining/60);
                            let s = remaining - m*60 + 1;
                            $scope.remaining = m + ":" + s;
                            if (remaining < 0) {
                                $scope.remaining = "Access token expired"
                            }

                            //console.log(remaining,m,s)
                        },5000)
                    }

                },function(err) {
                    console.log(err)
                    alert('Unable to retrieve server scope' )
                }
            );

            $scope.getRefreshToken = function(){
                if ($scope.waitingForRefresh) {
                    alert("Refresh call in progress, please wait...")
                    return;
                }


                $scope.waitingForRefresh = true;
                $http.get('/refresh').then(
                    function(data) {
                        console.log(data)
                        //these are the new tokens. They were also updated on the server for use in calls...
                        $scope.accessToken = data.data.accessToken;
                        $scope.refreshToken = data.data.refreshToken;

                        //reset the count down...
                        let d = new Date();
                        $scope.expires = moment(d).add(data.data.expiresIn,'seconds').toDate();
                        delete $scope.remaining;

                    }, function(err) {
                        console.log(err)
                    }
                ).finally(function(){delete $scope.waitingForRefresh})

            };


            $scope.executeQuery = function(srch) {
                delete $scope.resultsBundle;
                delete $scope.selectedEntry;
                delete $scope.error;

                $scope.waiting = true;
                $http.get('/sendquery/'+srch).then(
                    function (data) {
                        $scope.resultsBundle = data.data;

                    },function(err) {
                        console.log(err)
                        try {
                            $scope.error = angular.fromJson(err.data.err);
                        } catch (ex) {
                            $scope.error = err.data
                        }
                    }
                ).finally(
                    function(){
                        $scope.waiting = false;
                    }
                );
            };

            $scope.selectEntry = function(entry){
                $scope.selectedEntry = entry
            }

    });
