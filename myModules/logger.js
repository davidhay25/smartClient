

//sends the message back through the websocket connection (if it exists)
let log = (wss,msg) => {

    console.log(msg)
    if (wss) {
        wss.send(msg)
    } else {
        console.log('No web socket connection')
    }
};

exports.log = log;