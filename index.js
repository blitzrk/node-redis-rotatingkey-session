var debug = require('debug')('redis-rotatingkey-session');
var Cookies = require('cookies');
var redis_lib = require('redis');
var uuid = require('node-uuid');

// Options
// `name` - The cookie name. Defaults to `rrksess`.
// `keys` - Name of Redis key which holds the list of rotating keys. Defaults to `keygrip`.
// `port` - Port on which redis resides. Defaults to `6379`.
// `domain` - Domain on which redis resides. Defaults to `127.0.0.1`.
// `pass` - Redis password. Defaults to none (`null`).
// `expiry` - How long before expiring session. Defaults to `604800` or 1 week.
// `expireExtend` - Extend session for `expiry` length if user is active in the last `x` amount of time. Defaults to `3600` or 1 hour.  

var domainRegExp = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

module.exports = function(opts) {

	// Check options
	opts = opts || {};
	var valid_options = ["name", "keys", "port", "domain", "pass", "expiry", "expireExtend"];

	for(var key in opts) {
		if(valid_options.indexOf(key) < 0)
			debug("Warning: " + key + " is not a valid option for redis-rotatingkey-session. Ignoring.");
	}

	// Option defaults
	if(opts.name == null) opts.name = "rrksess";
	if(opts.keys == null) opts.keys = "keygrip";
	if(opts.port == null) opts.port = 6379;
	if(opts.domain == null) opts.domain = "127.0.0.1";
	if(opts.expiry == null) opts.expiry = 604800;
	if(opts.expireExtend == null) opts.expireExtend = 3600;
	opts.pass = { auth_pass: typeof opts.pass == "string" ? opts.pass : null };

	// Validate options
	if(typeof opts.name != "string" || opts.name.length < 1) throw new Error("Name option must be a non-zero length string");
	if(typeof opts.keys != "string" || opts.keys.length < 1) throw new Error("Keys option must be a non-zero length string");
	if(isNaN(parseInt(opts.port)) || opts.port > 65535 || opts.port < 1024) throw new Error("Port option must be a number between 1024 and 65535");
	if(typeof opts.domain != "string" || !(domainRegExp.test(opts.domain) || opts.domain == "localhost")) throw new Error("Domain option must be a valid IP address");
	if(typeof opts.pass.auth_pass == "string" && opts.pass.auth_pass.length < 1) throw new Error("Pass option must be a non-zero length string or null");
	if(isNaN(parseInt(opts.expiry)) || opts.expire < 1) throw new Error("Expire option must be a number greater than 0");
	if(isNaN(parseInt(opts.expireExtend)) || opts.expireExtend < 1) throw new Error("expireExtend option must be a number greater than 0");

	// Setup redis
	function openRedis() {
		var redis = redis_lib.createClient(opts.port, opts.domain, opts.pass);
	 	redis.on("error", function (err) {
	    	debug("Redis: Error " + err);
	  	});
	  	return redis;
	}

    // Return Connect-style middleware
    return function rrkSession(req, res, next) {
    	var keys, redis;
    	
    	// get keys
    	redis = openRedis();
    	redis.lrange(opts.keys, "0", "-1", function(err, reply) {
    		redis.end();
    		if(!err) keys = reply;
    		
    		// read cookies
    		var cookies = req.sessionCookies = new Cookies(req, res, keys);

			// get session ID and sign with newest key if not already
	    	var sess = cookies.get(opts.name, { signed: true });
	    	if(sess) req.sess = sess;
	    	
	    	// for new visitor or user/visitor with expired session
			if(sess === undefined) {
				// if signature is out of date, remove user session from redis
				var oldSess = parseCookiesFor(opts.name, req);
				if(oldSess) {
					redis = openRedis();
					redis.del("session:" + oldSess, function(err, reply) {
						redis.end();
						if(!err) {
							if(Number(reply) === 1){
								debug("Old session session:" + oldSess + " was removed.");
							} else {
								debug("Old session session:" + oldSess + " does not exist to be removed.");	
							}
						}
					})
				}

				// create new session and send to homepage
				sess = uuid.v4();
				cookies.set(opts.name, sess, { signed: true} );
				res.redirect('/');
			}
			
			// EXIST session by expireExtend if TTL is less than expiry time
			function extendTTL(cond, by) {
				redis = openRedis();
				redis.TTL("session:" + req.sess, function(err, reply) {
					if(!isNaN(parseInt(reply)) && parseInt(reply) < opts.expiry) {
						redis.expire("session:" + req.sess, opts.expireExtend, function(err, reply) {
							redis.end();
							debug("session:" + req.sess + " was " + Number(reply)===0 ? "not " : "" +
								"allowed to exist for another " + opts.expireExtend + " seconds.");
						});
					}
				});
			}

			// for unexpired session ID - try to get user
			redis = openRedis();
			redis.get("session:" + req.sess, function(err, reply) {
				redis.end();
				if(reply !== null) {
					var user = reply;
					req.userId = user;
					extendTTL(opts.expiry, opts.expireExtend);
				}
			});

	    	next();
    	});
    };
};

function parseCookiesFor(name, request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = unescape(parts.join('='));
    });

    return list[name];
};