const request = require('request');
const config = require('./vue/dist/UIconfig');
const crypto = require('crypto');

const apiKey = '1fea70d6-76ef-44e4-88f3-9c2c5bc81aed';
const apiSecret = 'MmM3MWVmZWYtOTcxNS00OWNmLTgxZWYtZjBhOGRjZmZmNjNi';
const baseUrl = 'https://api.latoken.com';
const endpoint = '/api/v1/account/balances';
const params = { timestamp: Date.now() };
const query =
  '?' +
  Object.entries(params)
    .map(([key, val]) => key + '=' + val)
    .join('&');

const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(endpoint + query)
  .digest('hex');
console.log('signature', signature);

const options = {
  url: baseUrl + endpoint + query,
  headers: {
    'X-LA-KEY': apiKey,
    'X-LA-SIGNATURE': signature,
  },
};

request.get(options, function (error, response, body) {
  console.log('response:', JSON.stringify(body));
});

const koa = require('koa');
const serve = require('koa-static');
const cors = require('koa-cors');
const _ = require('lodash');
const bodyParser = require('koa-bodyparser');

const opn = require('opn');
const server = require('http').createServer();
const router = require('koa-router')();
const ws = require('ws');
const app = koa();

const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ server: server });

const cache = require('./state/cache');

const nodeCommand = _.last(process.argv[1].split('/'));
const isDevServer = nodeCommand === 'server' || nodeCommand === 'server.js';

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.ping(_.noop);
  ws.on('error', (e) => {
    console.error(new Date(), '[WS] connection error:', e);
  });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log(new Date(), '[WS] stale websocket client, terminiating..');
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping(_.noop);
  });
}, 10 * 1000);

// broadcast function
const broadcast = (data) => {
  if (_.isEmpty(data)) {
    return;
  }

  const payload = JSON.stringify(data);

  wss.clients.forEach((ws) => {
    ws.send(payload, (err) => {
      if (err) {
        console.log(new Date(), '[WS] unable to send data to client:', err);
      }
    });
  });
};
cache.set('broadcast', broadcast);

const ListManager = require('./state/listManager');
const GekkoManager = require('./state/gekkoManager');

// initialize lists and dump into cache
cache.set('imports', new ListManager());
cache.set('gekkos', new GekkoManager());
cache.set('apiKeyManager', require('./apiKeyManager'));

// setup API routes

const WEBROOT = __dirname + '/';
const ROUTE = (n) => WEBROOT + 'routes/' + n;

// attach routes
const apiKeys = require(ROUTE('apiKeys'));
router.get('/api/info', require(ROUTE('info')));
router.get('/api/strategies', require(ROUTE('strategies')));
router.get('/api/configPart/:part', require(ROUTE('configPart')));
router.get('/api/apiKeys', apiKeys.get);

const listWraper = require(ROUTE('list'));
router.get('/api/imports', listWraper('imports'));
router.get('/api/gekkos', listWraper('gekkos'));
router.get('/api/exchanges', require(ROUTE('exchanges')));

router.post('/api/addApiKey', apiKeys.add);
router.post('/api/removeApiKey', apiKeys.remove);
router.post('/api/scan', require(ROUTE('scanDateRange')));
router.post('/api/scansets', require(ROUTE('scanDatasets')));
router.post('/api/backtest', require(ROUTE('backtest')));
router.post('/api/import', require(ROUTE('import')));
router.post('/api/startGekko', require(ROUTE('startGekko')));
router.post('/api/stopGekko', require(ROUTE('stopGekko')));
router.post('/api/deleteGekko', require(ROUTE('deleteGekko')));
router.post('/api/getCandles', require(ROUTE('getCandles')));

// incoming WS:
// wss.on('connection', ws => {
//   ws.on('message', _.noop);
// });

app
  .use(cors())
  .use(serve(WEBROOT + 'vue/dist'))
  .use(bodyParser())
  .use(require('koa-logger')())
  .use(router.routes())
  .use(router.allowedMethods());

server.timeout = config.api.timeout || 120000;
server.on('request', app.callback());
server.listen(config.api.port, config.api.host, '::', () => {
  const host = `${config.ui.host}:${config.ui.port}${config.ui.path}`;

  if (config.ui.ssl) {
    var location = `https://${host}`;
  } else {
    var location = `http://${host}`;
  }

  console.log('Serving Gekko UI on ' + location + '\n');

  // only open a browser when running `node gekko`
  // this prevents opening the browser during development
  if (!isDevServer && !config.headless) {
    opn(location).catch((err) => {
      console.log(
        'Something went wrong when trying to open your web browser. UI is running on ' +
          location +
          '.'
      );
    });
  }
});
