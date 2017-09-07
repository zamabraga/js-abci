var abci = require("../");
var util = require("util");

class CounterApp extends abci.ABCIApplication{
  constructor(){
    super();
    this.hashCount = 0;
    this.txCount = 0;
    this.serial = true;
    this.blockStore = {state:[],
      height:0,
      last_commit_hash:"",
      last_block_id:"",
      last_commit_hash:"",
      app_hash:""
    }; 
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

  beginBlock(req, cb) {
    let self = this;

    self.height = req.begin_block.header.height;
    self.last_block_id = req.begin_block.header.last_block_id.hash;
    self.last_commit_hash = req.begin_block.header.last_commit_hash;
    self.data_hash = req.begin_block.header.data_hash;
    self.validators_hash = req.begin_block.header.validators_hash;
    self.app_hash = req.begin_block.header.app_hash;

    self.blockStore.height = self.height;
    self.blockStore.last_block_id = self.last_block_id.toString("hex");
    self.blockStore.last_commit_hash = self.last_commit_hash.toString("hex");
    self.blockStore.app_hash = self.app_hash.toString("hex");
    // console.log("\nblock height: %s", self.height.toString('hex'));
    // console.log("\nblock last_block_id: %s", self.last_block_id.hash.toString('hex'));
    // console.log("\nblock last_commit_hash: %s", self.last_commit_hash.toString('hex'));
    // console.log("\nblock data_hash: %s", self.data_hash.toString('hex'));
    // console.log("\nblock validators_hash: %s", self.validators_hash.toString('hex'));
    // console.log("\nblock app_hash: %s", self.app_hash.toString('hex'));

    return cb({});
  }
  endBlock(req, cb) {
    let self = this;
    self.blockStore.app_hash = self.app_hash.toString('hex');
    this.isEndBlock = true;
    console.log("\nblock end: %j", self.blockStore);

    return cb({});
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
      self.blockStore.state.push(txValue);
    }

    self.txCount += 1;
    
    return cb({code:abci.CodeType_OK});
  }

  commit(req, cb) {
    let self = this;
    // console.log("commit: %j",req.commit);

    self.hashCount += 1;
    if (self.txCount == 0){
      return cb({log:"Zero tx count; hash is empth"});
    }
    let buf = Buffer.alloc(8);
    buf.writeIntBE(self.txCount, 0, 8);

    console.log("\commit: %j", self.blockStore);

    // console.log("\nblock height: %d", self.height);
    // console.log("\nblock last_block_id: %s", self.last_block_id.toString('hex'));
    // console.log("\nblock last_commit_hash: %s", self.last_commit_hash.toString('hex'));
    // console.log("\nblock data_hash: %s", self.data_hash.toString('hex'));
    // console.log("\nblock validators_hash: %s", self.validators_hash.toString('hex'));
    // console.log("\nblock app_hash: %s", self.app_hash.toString('hex'));

    return cb({data:buf});
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
