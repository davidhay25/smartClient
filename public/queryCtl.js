

angular.module("queryApp")
    .controller('queryCtrl',
        function ($scope,$http,$q) {

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
                    $scope.config = data.data.config;
                    $scope.atDecoded = data.data.decodedAccessToken;
                },function(err) {
                    console.log(err)
                    alert('Unable to retrieve server scope' )
                }
            );


            $scope.selectQueryResultDEP = function(qry) {
                console.log(qry)
                $scope.selectedResults = $scope.sqResults[qry.display]
                $scope.selectedResultsDisplay = qry.display;    //todo shoudl track type in config

            };

            $scope.executeQuery = function(srch) {
                delete $scope.resultsBundle;
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
