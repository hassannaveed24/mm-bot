// This is a basic example strategy for Gekko.
// For more information on everything please refer
// to this document:
//
// https://gekko.wizb.it/docs/strategies/creating_a_strategy.html
//
// The example below is pretty bad investment advice: on every new candle there is
// a 10% chance it will recommend to change your position (to either
// long or short).

var log = require('../core/log');
var watchPrice = 0.0;
var lowestPrice = 0.0;
var sellPrice = 0.0;
var advised = false;

// Let's create our own strat
var strat = {};

// Prepare everything our method needs
strat.init = function () {
  this.input = 'candle';
  this.currentTrend = 'long';
  this.requiredHistory = this.tradingAdvisor.historySize;
};

// What happens on every new candle?
strat.update = function (candle) {
  log.debug('candle time', candle.start);
  log.debug('candle close price', candle.close);
};

// For debugging purposes.
strat.log = function () {};

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function (candle) {
  if (watchPrice == 0) {
    watchPrice = candle.close * 0.98;
  }
  if (candle.close <= watchPrice) {
    lowestPrice = candle.close;
  }
  if (candle.close > lowestPrice && !advised) {
    this.advice('long');
    log.debug('Buying at', candle.close);
    sellPrice = candle.close * 1.03;
    advised = true;
  }
  if (candle.close > sellPrice && watchPrice != 0 && lowestPrice != 0) {
    this.advice('short');
    log.debug('Selling at', candle.close);
    watchPrice = 0;
    lowestPrice = 0;
    buyPrice = 0;
    sellPrice = 0;
    advised = false;
  }
};

module.exports = strat;
