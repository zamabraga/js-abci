"use strict";

const 
  wire = require("js-wire")
  ,types = require("./types")
  , events = require('events')
  ,maxWriteBufferLength = 4096 //Any more and flush
  
  ; 

class Connection extends events.EventEmitter{
  constructor(socket, app){
    super()
    let self = this;
    self.app = app;
    self.socket = socket;
    self.recvBuf = Buffer.alloc(0);
    self.sendBuf = Buffer.alloc(0);
    self.waitingResult = false;
    self.alreadyNamed = false;
    
    // Handle ABCI requests.
    self.socket.on('data', (data)=> {
      self.appendData(data);
    });
    
    self.socket.on('error', (err)=>{
      console.log("%s: connection error: %s",self.socket.name, err);
    });

    self.socket.on('end', ()=>{
      console.log("%s: connection ended". this.socket.name);
    });
  }

  updateName(type){
    let self = this;
      switch(type){
        case 'info':
        case 'query':
          if(self.socket.name !== 'query'){
            self.socket.name = 'query';
          }
        break;
        case 'check_tx':
        case 'deliver_tx':
        case 'begin_block':
        case 'end_block':
        case 'commit':
          if(self.socket.name !== 'consensus'){
            self.socket.name = 'consensus';
          }
        break;
        default:
          if(self.socket.name !== 'mempool'){
            self.socket.name = 'mempool';
          }        
        break;
      }
    self.alreadyNamed = true;
  }

  appendData(bytes) {
    let self = this;
    if (bytes.length > 0) {
      self.recvBuf = Buffer.concat([self.recvBuf, Buffer.from(bytes)]);
    }

    if (self.waitingResult) {
      return;
    }

    let r = new wire.Reader(self.recvBuf);
    let msgBytes;
    try {
      msgBytes = r.readByteArray();
    } 
    catch(e) {
      return;
    }
    self.recvBuf = r.buf.slice(r.offset);
    self.waitingResult = true;
    self.socket.pause();
    try {

      let req = types.Request.decode(msgBytes);
      let msgType = req.value;

      if(!self.alreadyNamed){
        self.updateName(msgType);
      }

      // Special messages.
      // NOTE: msgs are length prefixed
      if (msgType == "flush") {
        let res = new types.Response({
          flush: new types.ResponseFlush(),
        });
        self.writeMessage(res);
        self.flush();
        return self.resumeDataReading();
      } 
      else if (msgType == "echo") {
        let res = new types.Response({
          echo: new types.ResponseEcho({message: req.echo.message})
        });
        self.writeMessage(res);
        return self.resumeDataReading();
      }
      else{
        // Call app functio
        var reqMethod = types.reqMethodLookup[msgType];
        if (!reqMethod) {
          throw "Unexpected request type "+msgType;
        }
        if (!self.app[reqMethod]) {
          console.log("%s: Method not implemented: %s",self.socket.name,reqMethod);
          self.buildMessage({});
        } 
        else {
          var reqValue = req[msgType];
          var res = self.app.emit(self.app, req, self.buildMessage);
          if (res != undefined) {
            console.log("%s: Message handler shouldn't return anything!",self.socket.name);
          }
        }
      }
    } 
    catch(e) {
      if (e.stack) {
        console.log("%s: FATAL ERROR STACK: ",self.socket.name, e.stack);
      }
      console.log("%s: FATAL ERROR: ",self.socket.name, e);
    }
  }
 
  buildMessage(resObj){
    let resMessageType = types.resMessageLookup[msgType];
    let res = new types.Response();
    let resValue = new resMessageType(resObj);
    res.set(msgType, resValue);

    this.writeMessage(res);
    this.resumeDataReading();
  }
  writeMessage(msg) {
    let self = this;
    let msgBytes = msg.encode().toBuffer();
    let msgLength = wire.uvarintSize(msgBytes.length);
    let buf = Buffer.alloc(1+msgLength+msgBytes.length);
    
    let w = new wire.Writer(buf);
    w.writeByteArray(msgBytes); // TODO technically should be writeVarint
    self.sendBuf = Buffer.concat([self.sendBuf, w.getBuffer()]);
    
    if (self.sendBuf.length >= maxWriteBufferLength) {
      self.flush();
    }
  }

  resumeDataReading(){
    // This gets called after msg handler is finished with response.
    this.waitingResult = false;
    this.socket.resume();
    if (this.recvBuf.length > 0) {
      this.appendData("");
    }
  }

  flush() {
    let self = this;
    let n = self.socket.write(self.sendBuf);
    self.sendBuf = Buffer.alloc(0);
  }

  close() {
    let self = this;
    self.socket.destroy();
  }
}

// function Connection(socket, msgCb) {
//   this.socket = socket;
//   this.recvBuf = new Buffer(0);
//   this.sendBuf = new Buffer(0);
//   this.msgCb = msgCb;
//   this.waitingResult = false;
  
//   let conn = this;

//   // Handle ABCI requests.
//   socket.on('data', function(data) {
//     conn.appendData(data);
//   });
//   socket.on('end', function() {
//     console.log("connection ended");
//   });

//     socket.on('error', function(e) {
//     console.log("connection error: %s \n trace: %s", e, e.stack);
//   });
// }



// Connection.prototype.appendData = function(bytes) {
//   var conn = this;
//   if (bytes.length > 0) {
//     this.recvBuf = Buffer.concat([this.recvBuf, new Buffer(bytes)]);
//   }
//   if (this.waitingResult) {
//     return;
//   }
//   var r = new wire.Reader(this.recvBuf);
//   var msgBytes;
//   try {
//     msgBytes = r.readByteArray();
//   } catch(e) {
//     return;
//   }
//   this.recvBuf = r.buf.slice(r.offset);
//   this.waitingResult = true;
//   this.socket.pause();
//   try {
//     this.msgCb(msgBytes, function() {
//       // This gets called after msg handler is finished with response.
//       conn.waitingResult = false;
//       conn.socket.resume();
//       if (conn.recvBuf.length > 0) {
//         conn.appendData("");
//       }
//     });
//   } catch(e) {
//     if (e.stack) {
//       console.log("FATAL ERROR STACK: ", e.stack);
//     }
//     console.log("FATAL ERROR: ", e);
//   }
// };

// Connection.prototype.writeMessage = function(msg) {
//   var msgBytes = msg.encode().toBuffer();
//   var msgLength = wire.uvarintSize(msgBytes.length);
//   var buf = new Buffer(1+msgLength+msgBytes.length);
//   var w = new wire.Writer(buf);
//   w.writeByteArray(msgBytes); // TODO technically should be writeVarint
//   this.sendBuf = Buffer.concat([this.sendBuf, w.getBuffer()]);
//   if (this.sendBuf.length >= maxWriteBufferLength) {
//     this.flush();
//   }
// };

// Connection.prototype.flush = function() {
//   var n = this.socket.write(this.sendBuf);
//   this.sendBuf = new Buffer(0);
// }

// Connection.prototype.close = function() {
//   this.socket.destroy();
// }

module.exports = {
  Connection: Connection
};
