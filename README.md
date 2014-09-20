# node-redis-rotatingkey-session

  description

## Install

```bash
$ npm install node-redis-rotatingkey-session --no-optional
```

## API

  Setup your redis server.

```bash
$ redis-server start
$ redis-cli
redis> LPUSH keygrip "110E8400-E29B-11D4-A716-446655440000"
```

  Then create a simple express app.

```js
var express = require('express');
var rrkSession = require('redis-rotatingkey-session');

var app = express();

app.use(rrksess({
  // TODO - options
}));

app.listen(3000);
```

### Options

  - `name` - The cookie name. Defaults to `rrksess`.
  - `keys` - Name of Redis key which holds the list of rotating keys. Defaults to `keygrip`.
  - `port` - Port on which redis resides. Defaults to `6379`.
  - `domain` - Domain on which redis resides. Defaults to `localhost`.
  - `pass` - Redis password. Defaults to none (`null`).
  - `expiry` - How long before expiring session. Defaults to `604800` or 1 week.
  - `expireExtend` - Extend session for `expiry` length if user is active in the last `x` amount of time. Defaults to `3600` or 1 hour.

### Optional Dependencies

  To install optional `hiredis` for speedier transactions (not really that 
helpful in this case) you can run `npm install redis-rotatingkey-session`. 
However, this may require that you point npm to >=python2.6 for compilation. To do this, run `npm config set python 
/path/to/python2`.
