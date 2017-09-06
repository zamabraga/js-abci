var abci = require("../");
var util = require("util");

class CounterApp extends abci.ABCIApplication{
  constructor(){
    super();
    this.hashCount = 0;
    this.txCount = 0;
    this.serial = true; 
  }

  info(req, cb) {
    let self = this;
    console.log("info %j", req.info);
    console.log("hashes:%d, txs:%d", self.hashCount, self.txCount);
    return cb({
      data: util.format("hashes:%d, txs:%d", self.hashCount, self.txCount),
      last_block_height: self.height,
      last_block_app_hash: self.app_hash
    });
  }
  beginBlock(req, cb) {
    let self = this;

    self.height = req.begin_block.header.height;
    self.last_block_id = req.begin_block.header.last_block_id.hash;
    self.last_commit_hash = req.begin_block.header.last_commit_hash;
    self.data_hash = req.begin_block.header.data_hash;
    self.validators_hash = req.begin_block.header.validators_hash;
    self.app_hash = req.begin_block.header.app_hash;

    console.log("\nblock height: %j", self.height);
    console.log("\nblock last_block_id: %j", self.last_block_id);
    console.log("\nblock last_commit_hash: %j", self.last_commit_hash);
    console.log("\nblock data_hash: %j", self.data_hash);
    console.log("\nblock validators_hash: %j", self.validators_hash);
    console.log("\nblock app_hash: %j", self.app_hash);

    return cb({});
  }
  endBlock(req, cb) {
    // console.log("\nblock end: %j", req);
    return cb({});
  }
  setOption(req, cb) {
    console.log("\ndeliver: %j",req.set_option);
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
    return cb({log: "Unexpected key "+req.set_option.key});
  }

  deliverTx(req, cb) {
    console.log("\ndeliver: %j",req.deliver_tx);
    
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
        return cb({code:abci.CodeType.BadNonce, log:"Nonce is invalid. Got "+txValue+", expected "+this.txCount});
      }
    }
    self.txCount += 1;
    return cb({code:abci.CodeType_OK});
  }

  checkTx(req, cb) {
    let self = this;
    console.log("\check tx: %j",req.check_tx);

    let txBytes = req.check_tx.tx.toBuffer();
    if (self.serial) {
      if (txBytes.length >= 2 && txBytes.slice(0, 2) == "0x") {
        let hexString = txBytes.toString("ascii", 2);
        let hexBytes = Buffer.from(hexString, "hex");
        txBytes = hexBytes;
      }	
      let txValue = txBytes.readUIntBE(0, txBytes.length);
      if (txValue < self.txCount){
        return cb({code:abci.CodeType.BadNonce, log:"Nonce is too low. Got "+txValue+", expected >= "+this.txCount});
      }
    }

    return cb({code:abci.CodeType_OK});
  }

  commit(req, cb) {
    let self = this;
    console.log("commit: %j",req.commit);

    self.hashCount += 1;
    if (self.txCount == 0){
      return cb({log:"Zero tx count; hash is empth"});
    }
    let buf = Buffer.alloc(8);
    buf.writeIntBE(self.txCount, 0, 8);
    return cb({data:buf});
  }

  query(req, cb) {
    let self = this;
    let reqQuery = req.query;
    switch(reqQuery.path){
      case 'hash':
        return cb({value:self.hashCount});
      case 'tx':
        return cb({value:self.txCount});
      default:
        return cb({log: "Invalid query path. Expected hash or tx, got " + reqQuery.path})
    }

    return cb({code:abci.CodeType_OK, log:"Query not yet supported"});
  }
}

console.log("Counter app in Javascript");

var app = new CounterApp();
var appServer = new abci.Server(app);
appServer.server.listen(46658);
