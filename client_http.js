"use strict";

const 
  types = require("./types")
  ,events = require("events")
  ,http = require('http')
  ,utils = require('utils')
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
    this.makeRequest('status');
  }
  
  getDumpConsensusState(){
    this.makeRequest('dump_consensus_state');
  }

  getGenesis(){
    this.makeRequest('genesis');
  }

  getNetInfo(){
    this.makeRequest('net_info');
  }

  getNumUnconfirmedTxs(){
    this.makeRequest('num_unconfirmed_txs');
  }

  getUnconfirmedTxs(){
    this.makeRequest('unconfirmed_txs');
  }

  getValidators(){
    this.makeRequest('validators');
  }

  getAbciQuery(param){
    let url = utils.format('abci_query?path=%s&data=%s&prove=false',
    param.path,param.data,param.prove);
    this.makeRequest(url);
  }
  
  getBlock(param){
    let url = utils.format('block?height=%d',param.height);
    this.makeRequest(url);
  }

  getBlockchain(param){
    let url = utils.format('blockchain?minHeight=%d&maxHeight=%d',
                  args.minHeight,args.maxHeight);
    this.makeRequest(url);
  }

  broadcastTxAsync(param){
    let url = utils.format('broadcast_tx_async?tx=%s',param.data);
    this.makeRequest(url);
  }

  broadcastTxSync(param){
    let url = utils.format('broadcast_tx_sync?tx=%s',param.data);
    this.makeRequest(url);
  }

  broadcastTxCommit(param){
    let url = utils.format('broadcast_tx_commit?tx=%s',param.data);
    this.makeRequest(url);
  }

  getTx(param){
    let url = utils.format('tx?hash=%s',param.hash);
    this.makeRequest(url);
  }

  commit(height){
    let url = utils.format('commit?height=%d',param.height);
    this.makeRequest(url);
  }

  makeRequest(method){
    let self = this;
    let opt = {
      hostname: self._server.host,
      port: self._server.port,
      path: '/' + method,
    };
    Object.assign(opt,options);
    const req = http.get(opt, (res) => {
      // console.log('abci info: request %j: ', req);
      let self = this;
      self.recvBuf = Buffer.alloc(0);
      // console.log('STATUS: %j', res.statusCode);
      // console.log('HEADERS: %j', res.headers);
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        // console.log('BODY Party: %j', chunk);
        self.recvBuf = Buffer.concat([self.recvBuf, Buffer.from(chunk)]);
      });
      res.on('end', () => {
        let self = this;
        // console.log('BODY Full %j:', self.recvBuf);
        self.emit('abci_info', JSON.parse(self.recvBuf));
      });
    });
    
    req.on('error', (e) => {
      console.log('problem with request: ${e.message}');
      self.emit('error', e);
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
  console.log('abci info: %j',res);
});
client.getAbciInfo();

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin
});

console.log('hit <enter> for quit...!');
rl.on('line', (line) => {
  process.exit(0);
});
// process.stdin.setRawMode( true );