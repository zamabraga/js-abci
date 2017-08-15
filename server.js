"use strict";

const 
  net = require("net")
  ,types = require("./types")
  ,Connection = require("./connection").Connection;

// Takes an application and handles ABCI connection
// which invoke methods on the app
class Server{
  constructor(app) {
    // set the app for the socket handler
    this.app = app;

    // create a server by providing callback for 
    // accepting new connection and callbacks for 
    // connection events ('data', 'end', etc.)
    this.createServer();
  }

  createServer() {
    let self = this;

    // Define the socket handler
    this.server = net.createServer(function(socket) {
      socket.name = socket.remoteAddress + ":" + socket.remotePort;
      console.log("new connection from", socket.name);

      let conn = new Connection(socket, self.app);
    });
  }
}

module.exports = {
  Server: Server,
};
