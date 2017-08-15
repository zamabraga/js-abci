"use strict";

const 
  types = require("./types")
  ,events = require("events");

class ABCIApplication extends events.EventEmitter{
  constructor(){
    super();
  }
}

module.exports = {
  ABCIApplication: ABCIApplication,
};
