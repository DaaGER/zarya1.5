let uWS = require("uWebSockets.js")


let user;
uWS.App({}).ws('/*', {
    idleTimeout: 8,
    sendPingsAutomatically:true,
    open: (ws) => {
        console.log('Fake WebSocket connected!');
        console.log('передал',JSON.stringify([{T: 'success', msg: 'connected'}]))
        ws.send(JSON.stringify([{T: 'success', msg: 'connected'}]));
        console.log('передал',JSON.stringify([{T: "success", msg: "authenticated"}]))
        ws.send(JSON.stringify([{T: "success", msg: "authenticated"}]));
        user=ws;
    },
    close: (ws) => {
        console.log('Fake WebSocket disconnected!');
    },

    message: (ws, message, isBinary) => {

        let message_data = Buffer.from(message).toString()
        let message_object = JSON.parse(message_data);

        console.log('принял',message_data)
    }

}).post('/data',(res, req)=>{
   readData(res,(data)=>{
       console.log(data);
       if(user) {
           console.log('отправили')
           user.send(data);
       }
   })
    res
        .writeStatus('200 OK')
        .writeHeader('Content-Type', 'text/plain;charset=UTF-8')
        .end('');
}).listen(7777, (listenSocket) => {
    if (listenSocket) {
        console.log(`Listening to port 7777`);
    }
});


function readData(res, cb){
    let buffer;
    /* Register data cb */
    res.onData((ab, isLast) => {
        let chunk = Buffer.from(ab);
        if (isLast) {
            let result;
            if (buffer) {
                   result=Buffer.concat([buffer, chunk]);
            } else {
                 result=chunk;
            }
            cb(Buffer.from(result).toString())
        } else {
            if (buffer) {
                buffer = Buffer.concat([buffer, chunk]);
            } else {
                buffer = Buffer.concat([chunk]);
            }
        }
    });

}



/*

[{"T": "success", "msg": "authenticated"}]




[{"T":"t","i":0,"S":"LYLT","x":"P","p":154.09,"s":2,"t":"2022-09-13T21:56:46.299Z","c":["@","TI"],"z":"-"}]

[{"T":"q","S":"LYLT","ax":"P","ap":154.1,"as":11,"bx":"P","bp":154.02,"bs":2,"s":0,"t":"2022-09-13T21:56:53.579Z","c":[],"z":"-"}]

 */