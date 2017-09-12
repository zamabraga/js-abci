"use strict";

const 
  types = require("./types")
  ,events = require("events")
  ,http = require('http')
  ;

  const options = {
    // hostname: 'localhost',
    // port: 46657,
    // path: '',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
class Client extends events.EventEmitter{
  constructor(server){
    super();
    this._server = this.parseAddr(server);
  }

  getAbciInfo(){
    this.makeRequest('abci_info');
  }

  getStatus(){

  }

  getAbciQuery(){

  }

  getBlockchain(param){

  }

  broadcastTxAsync(param){

  }

  broadcastTxSync(param){
    
  }

  broadcastTxCommit(param){
    
  }

  getTx(tx){

  }

  commit(height){

  }

  makeRequest(method){
    let self = this;
    let opt = {
      hostname: self._server.host,
      port: self._server.port,
      path: method,
    };
    Object.assign(opt,options);
    const req = http.request(opt, (res) => {
      let self = this;
      let buffer = [];
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        console.log('BODY Party: ${chunk}');
        recvBuf = Buffer.concat([recvBuf, Buffer.from(chunk)]);
      });
      res.on('end', () => {
        console.log('BODY Full: ${recvBuf}');
        self.emit('abci_info', recvBuf);
      });
    });
    
    req.on('error', (e) => {
      console.log(`problem with request: ${e.message}`);
      self.emit('error',e);
    });
  }

  // "tcp://127.0.0.1:46658" -> {host,port}
  // "unix://path" -> {path}
  parseAddr(addr) {
    if (addr.startsWith("tcp://")) {
      var hostPort = addr.substr(6).split(":");
      return {host: hostPort[0], port: +hostPort[1]};
    }
    if (addr.startsWith("unix://")) {
      return {path: addr.substr(7)};
    }
  }
}

let client = new Client('tcp://localhost:46657');
client.on('abci_info', (res)=>{
  console.log('abci info: ${res}');
});
client.getAbciInfo();

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin
});

rl.on('line', (line) => {
  console.log('Have a great day!');
  process.exit(0);
});
// process.stdin.setRawMode( true );