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
    console.log("hashes:%d, txs:%d", this.hashCount, this.txCount);
    return cb({
      data: util.format("hashes:%d, txs:%d", self.hashCount, self.txCount),
    });
  }
  beginBlock(req, cb) {
    return cb({});
  }
  endBlock(req, cb) {
    return cb({});
  }
  setOption(req, cb) {
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
    console.log("commit: %j",req);

    self.hashCount += 1;
    if (self.txCount == 0){
      return cb({log:"Zero tx count; hash is empth"});
    }
    let buf = Buffer.alloc(8);
    buf.writeIntBE(self.txCount, 0, 8);
    return cb({data:buf});
  }

  query(req, cb) {
    return cb({code:abci.CodeType_OK, log:"Query not yet supported"});
  }
}

console.log("Counter app in Javascript");

var app = new CounterApp();
var appServer = new abci.Server(app);
appServer.server.listen(46658);
