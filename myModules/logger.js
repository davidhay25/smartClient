

//sends the message back through the websocket connection (if it exists)
let log = (wss,msg,json) => {

    try {
        let wsMsg = {msg:msg}

        console.log(msg);
        if (wss) {
            wss.send(msg)
        } else {
            console.log('No web socket connection')
        }
    } catch (ex) {
        console.log(ex)
    }

};

exports.log = log;