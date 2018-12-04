var connections = 0; // count active connections

self.addEventListener("connect", function (e) {
    var port = e.ports[0];
    connections++;

    //a simple echo
    port.addEventListener("message", function (e) {
        port.postMessage(e.data);
    }, false);

    port.start();

}, false);