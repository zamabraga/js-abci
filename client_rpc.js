"use strict";

const 
  types = require("./types")
  ,events = require("events")
  ,WebSocket = require('rpc-websockets').Client;


  
// instantiate Client and connect to an RPC server 
var ws = new WebSocket('ws://localhost:46657/websocket',{'autoconnect':true})
ws.on('error', function(err) {
   // unsubscribe from an event 
   ws.unsubscribe('NewBlock');
   // close a websocket connection 
   ws.close();
   console.log('error: %j %s', err,err);
});

ws.on('open', function() {
   
  // subscribe to receive an event 

  console.log('subscribing');
  
  ws.subscribe('NewBlock');
    
  ws.on('NewBlock', function(result) {
    console.log('result: %j', result)
  });
});

console.log('started ....')

setTimeout(()=>{
   // unsubscribe from an event 
  ws.unsubscribe('NewBlock');
  
  // close a websocket connection 
  ws.close();

  console.log('quiting....')

},30000);

