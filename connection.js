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
      console.log("%s: connection ended", self.socket.name);
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
      self.msgType = req.value;
      // console.log("packet: %j",req)
      if(!self.alreadyNamed){
        self.updateName(self.msgType);
      }

      // Special messages.
      // NOTE: msgs are length prefixed
      if (self.msgType == "flush") {
        let res = new types.Response({
          flush: new types.ResponseFlush(),
        });
        self.writeMessage(res);
        self.flush();
        return self.resumeDataReading();
      } 
      else if (self.msgType == "echo") {
        let res = new types.Response({
          echo: new types.ResponseEcho({message: req.echo.message})
        });
        self.writeMessage(res);
        return self.resumeDataReading();
      }
      
      let resCb = function(resObj){
        let resMessageType = types.resMessageLookup[self.msgType];
        let res = new types.Response();
        let resValue = new resMessageType(resObj);
        res.set(self.msgType, resValue);
    
        self.writeMessage(res);
        self.resumeDataReading();
        return;
      }

      // Call app functio
      let reqMethod = types.reqMethodLookup[self.msgType];
      // console.log("%s: Method: %s",self.socket.name,reqMethod);
      if (!reqMethod) {
        throw "Unexpected request type "+self.msgType;
      }
      if (!self.app[reqMethod]) {
        console.log("%s: Method not implemented: %s",self.socket.name,reqMethod);
        resCb({});
      } 
      else {
        let reqValue = req[self.msgType];
        let res = self.app[reqMethod].call(self.app, req, resCb);
        if (res != undefined) {
          console.log("%s: Message handler shouldn't return anything: %j",self.socket.name, res);
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

module.exports = {
  Connection: Connection
};
