

angular.module("queryApp").service('clientServicesSvc',
    function() {


        return {
            //create the jsTree data
            buildResourceTree: function (resource) {
                //pass in a resource instance...
                if (!resource) {
                    return;
                }
                var tree = [];
                var idRoot = 0;

                function processNode(tree, parentId, element, key, level, pathRoot) {

                    if (angular.isArray(element)) {
                        var aNodeId1 = getId()
                        var newLevel = level++;
                        var data = {key: key, element: element, level: newLevel, path: pathRoot + '.' + key}
                        var newNode1 = {
                            id: aNodeId1,
                            parent: parentId,
                            data: data,
                            text: key,
                            state: {opened: true, selected: false}
                        };
                        tree.push(newNode1);

                        newLevel++;
                        element.forEach(function (child, inx) {
                            processNode(tree, aNodeId1, child, '[' + inx + ']', newLevel, pathRoot + '.' + key);
                        })

                    } else if (angular.isObject(element)) {
                        var newLevel = level++;
                        var oNodeId = getId();
                        var data = {key: key, element: element, level: newLevel, path: pathRoot + '.' + key}
                        var newNode2 = {
                            id: oNodeId,
                            parent: parentId,
                            data: data,
                            text: key,
                            state: {opened: true, selected: false}
                        };


                        tree.push(newNode2);

                        //var newLevel = level++;
                        newLevel++
                        angular.forEach(element, function (child, key1) {
                            processNode(tree, oNodeId, child, key1, newLevel, pathRoot + '.' + key);

                        })
                    } else {
                        //a simple element
                        if (key == 'div') {

                        } else {

                            //console.log(key,element)
                            //http://itsolutionstuff.com/post/angularjs-how-to-remove-html-tags-using-filterexample.html
                            //strip out the html tags... - elemenyt is not always a string - bit don't care...
                            try {
                                if (element.indexOf('xmlns=') > -1) {
                                    element = element.replace(/<[^>]+>/gm, ' ')
                                }
                            } catch (ex) {

                            }


                            var display = key + " " + '<strong>' + element + '</strong>';
                            var data = {key: key, element: element, level: level, path: pathRoot + '.' + key}
                            //data.element = element;
                            var newNode = {
                                id: getId(),
                                parent: parentId,
                                data: data,
                                text: display,
                                state: {opened: true, selected: false}
                            };
                            tree.push(newNode);
                        }
                    }
                }


                var rootId = getId();
                var rootItem = {
                    id: rootId,
                    parent: '#',
                    text: resource.resourceType,
                    state: {opened: true, selected: true}
                };
                tree.push(rootItem);

                angular.forEach(resource, function (element, key) {
                    processNode(tree, rootId, element, key, 1, resource.resourceType);
                });

                return tree;

                //generate a new ID for an element in the tree...
                function getId() {
                    idRoot++;
                    return idRoot;

                }
            }
        }
    })