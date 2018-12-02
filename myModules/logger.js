

let log = (wss,msg) => {
/*
    if (typeof  msg == 'object') {
        msg = JSON.stringify(msg)
    }
*/

    console.log(msg)
    wss.send(msg)

}

exports.log = log;