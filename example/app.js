"use strict";

const 
  abci = require("../"),
  util = require("util");

class CounterApp extends abci.ABCIApplication{
  constructor(){
    super();
    this.hashCount = 0;
    this.txCount = 0;
    this.serial = true;
    this.blockStore = {state:[],
      last_commit_hash:""
    }; 
  }

  info(req, cb) {
    let self = this;
    console.log("info %j", req.info);
    console.log("hashes:%d, txs:%d", self.hashCount, self.txCount);
    return cb({
      data: util.format("hashes:%s, txs:%d", self.hashCount, self.txCount)
    });
  }

  checkTx(req, cb) {
    let self = this;

    let txBytes = req.check_tx.tx.toBuffer();
    if (self.serial) {
      if (txBytes.length >= 2 && txBytes.slice(0, 2) == "0x") {
        let hexString = txBytes.toString("ascii", 2);
        let hexBytes = Buffer.from(hexString, "hex");
        txBytes = hexBytes;
      }	
      let txValue = txBytes.readUIntBE(0, txBytes.length);
      if (txValue < self.txCount){
        return cb({code:abci.CodeType.BadNonce, log:"Nonce is too low. Got "+txValue+", expected >= "+self.txCount});
      }

      console.log("\ncheck update: %d %d\n", self.hashCount, self.txCount);      
    }

    return cb({code:abci.CodeType_OK});
  }

  beginBlock(req, cb) {
    let self = this;

    self.last_block_id = req.begin_block.header.last_block_id.hash;
    self.last_commit_hash = req.begin_block.header.last_commit_hash;
    self.app_hash = req.begin_block.header.app_hash;
    // self.validators_hash = req.begin_block.header.validators_hash;
    self.app_hash = req.begin_block.header.app_hash;
    self.blockStore.last_block_id = self.last_block_id.toString("hex");
    self.blockStore.last_commit_hash = self.last_commit_hash.toString("hex");
    self.blockStore.app_hash = self.app_hash.toString("hex");

    console.log("\nblock begin: %j", self.blockStore);
    // console.log("\nblock height: %s", self.height.toString('hex'));
    // console.log("\nblock last_block_id: %s", self.last_block_id.toString('hex'));
    // console.log("\nblock last_commit_hash: %s", self.last_commit_hash.toString('hex'));
    // console.log("\nblock data_hash: %s", self.data_hash.toString('hex'));
    // console.log("\nblock validators_hash: %s", self.validators_hash.toString('hex'));
    // console.log("\nblock app_hash: %s", self.app_hash.toString('hex'));

    return cb({});
  }
  endBlock(req, cb) {
    let self = this;
    // self.blockStore.app_hash = self.app_hash.toString('hex');
    // this.isEndBlock = true;
    // console.log("\nblock end: %j", req.end_block);

    return cb({});
  }

  deliverTx(req, cb) {
    // console.log("\ndeliver: %j",req.deliver_tx);
    
    let self = this;
    let txBytes = req.deliver_tx.tx.toBuffer();
    if (self.serial) {
      if (txBytes.length >= 2 && txBytes.slice(0, 2) == "0x") {
        let hexString = txBytes.toString("ascii", 2);
        let hexBytes = Buffer.from(hexString, "hex");
        txBytes = hexBytes;
      }	
      var txValue = txBytes.readUIntBE(0, txBytes.length);
      if (txValue != self.txCount){
        return cb({code:abci.CodeType.BadNonce, log:"Nonce is invalid. Got "+txValue+", expected "+self.txCount});
      }
      self.blockStore.state.push(txValue);
    }
 
    self.txCount += 1;

    console.log("\ndeliver update: %d %d\n",self.hashCount, self.txCount);

    return cb({code:abci.CodeType_OK});
  }

  commit(req, cb) {
    let self = this;

    self.hashCount += 1;

    if (self.txCount == 0){
      return cb({log:"Zero tx count; hash is empth", code:abci.CodeType_OK});
    }

    let buf = Buffer.alloc(8);
    buf.writeIntBE(self.txCount, 0, 8);

    console.log("\ncommit update: %d\n",self.txCount);

    return cb({data:buf});
  }

  setOption(req, cb) {
    // console.log("\ndeliver: %j",req.set_option);
    let self = this;
    if (req.set_option.key == "serial") {
      if (req.set_option.value == "on") {
        self.serial = true;
        return cb({log:"ok"});
      } else if (req.set_option.value == "off") {
        self.serial = false;
        return cb({log:"ok"});
      } else {
        return cb({log:"Unexpected value "+req.set_option.value});
      }
    }
    return cb({log: "Unexpected key "+req.set_option.key,code:abci.CodeType_OK});
  }

  query(req, cb) {

    // CodeType          code        = 1;
    // int64             index       = 2;
    // bytes             key         = 3;
    // bytes             value       = 4;
    // bytes             proof       = 5;
    // uint64            height      = 6;
    // string            log         = 7;

    let self = this;
    let reqQuery = req.query;
    switch(reqQuery.path){
      case 'hash':
        let buf = Buffer.alloc(8);
        buf.writeIntBE(self.hashCount, 0, 8);
        return cb({value:buf});
      case 'tx':
        return cb({value:self.txCount});
      default:
        return cb({log: "Invalid query path. Expected hash or tx, got " + reqQuery.path})
    }

    console.log("\nquery tx count update: %d %d\n",self.hashCount, self.txCount);

    return cb({log:"Query not yet supported"});
  }
}

console.log("Counter app in Javascript");

var app = new CounterApp();
var appServer = new abci.Server(app);
appServer.server.listen(46658);
