"use strict";

const 
  wire = require("js-wire")
  , events = require('events')
  ,maxWriteBufferLength = 4096 //Any more and flush
  
  ; 

class Connection extends events.EventEmitter{
  constructor(socket, msgCb){
    super()
  
    this.socket = socket;
    this.recvBuf = Buffer.alloc(0);
    this.sendBuf = Buffer.alloc(0);
    this.msgCb = msgCb;
    this.waitingResult = false;
    this.alreadyNamed = false;
    
    // Handle ABCI requests.
    this.socket.on('data', function(data) {
      this.appendData(data);
    });
    
    this.socket.on('error', function(err) {
      console.log("connection error: %s",err);
    });

    this.socket.on('end', function() {
      console.log("connection ended");
    });
  }

  updateName(type){
    var conn = this;
    switch(this.socket.name){
      case 'check_tx':
        this.socket.name = 'mempool';
        breack;
      case 'info':
        this.socket.name = 'query';
        breack;
      default:
        this.socket.name = 'consensus';
    }
    this.alreadyNamed = true;
  }

  appendData = function(bytes) {
    let conn = this;
    if (bytes.length > 0) {
      this.recvBuf = Buffer.concat([this.recvBuf, Buffer.alloc(bytes)]);
    }
    if (this.waitingResult) {
      return;
    }
    let r = new wire.Reader(this.recvBuf);
    let msgBytes;

    try {
      msgBytes = r.readByteArray();
    } 
    catch(e) {
      console.log("Message wire decode error: %s", e);
      return;
    }
    
    this.recvBuf = r.buf.slice(r.offset);
    this.waitingResult = true;
    this.socket.pause();

    try {
      
      this.handleMessage(msgBytes);

      this.msgCb(msgBytes, function() {
        
        // This gets called after msg handler is finished with response.
        this.waitingResult = false;
        this.socket.resume();
        
        if (conn.recvBuf.length > 0) {
          this.appendData("");
        }
      });
    } 
    catch(e) {
    
      if (e.stack) {
        console.log("FATAL ERROR STACK: ", e.stack);
      }

      console.log("FATAL ERROR: ", e);
    }
  }

  handleMessage(msgBytes){
    let req = types.Request.decode(msgBytes);
    let msgType = req.value;

    if(!this.alreadyNamed)
      this.updateName(msgType);

    //notify app that echo request was answered
      this.app.emit(msgType,req.echo);
  }
  
  messageBuild(resObj){
    // Response type is always the same as req type
    resMessageType = types.resMessageLookup[msgType];
    var res = new types.Response();
    var resValue = new resMessageType(resObj);
    res.set(msgType, resValue);

    return res;
  }

  writeMessage(msg) {
    let msgBytes = msg.encode().toBuffer();
    let msgLength = wire.uvarintSize(msgBytes.length);
    let buf = Buffer.alloc(1+msgLength+msgBytes.length);
    
    let w = new wire.Writer(buf);
    w.writeByteArray(msgBytes); // TODO technically should be writeVarint
    this.sendBuf = Buffer.concat([this.sendBuf, w.getBuffer()]);
    
    if (this.sendBuf.length >= maxWriteBufferLength) {
      this.flush();
    }

    this.resumeReading();
  }

  resumeReading(){
    // This gets called after msg handler is finished with response.
    this.waitingResult = false;
    this.socket.resume();
    if (this.recvBuf.length > 0) {
      this.appendData("");
    }
  }

  flush() {
    var n = this.socket.write(this.sendBuf);
    this.sendBuf = new Buffer(0);
  }

  close() {
    this.socket.destroy();
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
