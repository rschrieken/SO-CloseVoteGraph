/*global require:true, console:true, process:true */
// install
// npm install htmlparser2
// npm install mysql
// npm install config

(function () {
    "use strict";
    var http = require('http'),
        config = require('config'),
        htmlparser = require('htmlparser2');

    function DataAccess() {

        var mysql = require('mysql'),
            dbc = config.get('mysql'),
            pool;

        function execute(query, params, result, end) {
            pool.getConnection(function (err, conn) {
                if (err) {throw err; }

                conn.query(query, params)
                    .on('result', result)
                    .on('end', function () {
                        if (typeof end === 'function') {end(); }
                        conn.release();
                    });
            });
        }

        function insert(query, params) {
            execute(query, params, function (row) {console.log(row.insertId); });
        }

        function select(query, params, result, end) {
            execute(query, params, result, end);
        }

        function init() {
            var parsed = { connectionLimit : 3},
                i,
                parts,
                namevalue;

            if (process.env.MYSQLCONNSTR_DefaultConnection) {
                console.log('parsed');
                parts = process.env.MYSQLCONNSTR_DefaultConnection.split(';');
                for (i = 0; i < parts.length; i = i + 1) {
                    namevalue = parts[i].split('=');
                    if (namevalue[0] === 'Data Source') {
                        parsed.host = namevalue[1];
                    }
                    if (namevalue[0] === 'Database') {
                        parsed.database = namevalue[1];
                    }
                    if (namevalue[0] === 'User Id') {
                        parsed.user = namevalue[1];
                    }
                    if (namevalue[0] === 'Password') {
                        parsed.password = namevalue[1];
                    }
                }
                dbc = parsed;
            } else {
                dbc.connectionLimit = 3;
            }
            pool = mysql.createPool(dbc);
        }

        init();

        return {
            select: select,
            insert: insert
        };
    }

    function HttpServer(opt, db) {
        var fs = require('fs'),
            ct = [];

        ct['.js'] = 'text/javascript';
        ct['.css'] = 'text/css';

        function sendUTF8(response, file) {
            var ext = file.substr(file.lastIndexOf('.'));
            fs.readFile(file, 'utf-8', function (error, content) {
                if (error) {throw error; }
                response.writeHead(200,
                    { 'Content-Type': ct[ext] });
                response.end(content, 'utf-8');
            });
        }

        function sendIco(response, file) {
            fs.readFile(file, function (error, content) {
                if (error) {throw error; }
                response.writeHead(200, { 'Content-Type': 'image/x-icon' });
                response.end(content);
            });
        }

        function sendJavascript(response, file) {
            sendUTF8(response, file);
        }

        function sendCss(response, file) {
            sendUTF8(response, file);
        }

        function sendHtml(response) {
            response.setTimeout(20000);
            response.writeHead(200, { 'Content-Type': 'text/html'});
            response.write('<html><head><link href="/socvr.css" rel="stylesheet" /><script src="/highcharts-custom.js"></script><script src="/socvr.js"></script></head><body>');
            response.write('<h1>Close Vote Queue Graph</h1><div id="container" style="width:100%; height:400px;"></div><div id="stats">Start:&nbsp;<span id="min"></span><br />End:&nbsp;<span id="max"></span><br />Count:&nbsp;<span id="cnt"></span></div>');
            response.write('</body></html>');
            response.end();
        }

        function renderArray(response, sql, params) {
            var first = true;
            response.write("[");
            db.select(sql, params,
                function (row) {
                    if (!first) {response.write(','); }
                    response.write('[');
                    response.write(row.Time.getTime().toString());
                    response.write(',');
                    response.write(row.NumInQueue.toString());
                    response.write(']');
                    first = false;
                },
                function () {
                    response.write("]");
                    response.end();
                });
        }

        function renderObject(response, sql, params) {
            var first = true;
            response.write("[");
            db.select(sql, params,
                function (row) {
                    if (!first) {response.write(','); }
                    response.write(JSON.stringify(row));
                    first = false;
                },
                function () {
                    response.write("]");
                    response.end();
                });
        }

        function renderEmpty(response) {
            response.end();
        }

        http.createServer(function (req, response) {
            if (req.url === '/' && req.method === 'GET') {
                sendHtml(response);
            } else if (req.url === '/highcharts-custom.js' && req.method === 'GET') {
                sendJavascript(response, 'highcharts-custom.js');
            } else if (req.url === '/socvr.js' && req.method === 'GET') {
                sendJavascript(response, 'socvr.js');
            } else if (req.url === '/socvr.css' && req.method === 'GET') {
                sendCss(response, 'socvr.css');
            } else if (req.url === '/favicon.ico' && req.method === 'GET') {
                sendIco(response, 'favicon.ico');
            } else if (req.url === '/data' && req.method === 'POST') {
                var render,
                    action,
                    sql,
                    params;
                req.on('data', function (chunk) {
                    try {
                        action = JSON.parse(chunk.toString('utf-8'));
                    } catch (err) {
                        action = {
                            message: err
                        };
                    }
                });
                req.on('end', function () {
                    if (action.initial) {
                        sql = 'SELECT `Time`, `NumInQueue` from `closequeue` where mod(`id`,100) = 1 order by `Time`';
                        render = renderArray;
                    } else if (action.selection) {
                        sql = 'SELECT `Time`,`NumInQueue` from `closequeue` where `Time` between ? and ? order by `Time`';
                        params = [ new Date(action.low), new Date(action.high)];
                        render = renderArray;
                    } else if (action.stats) {
                        sql = 'SELECT min(`Time`) as start,max(`Time`) as latest, count(1) as observations from `closequeue`';
                        render = renderObject;
                    } else {
                        console.log(action);
                        response.writeHead(503, { 'Content-Type': 'text/html'});
                        render = renderEmpty;
                        return;
                    }
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    render(response, sql, params);
                });
            } else {
                console.log('404: ' + req.method + ' ' + req.url);
                response.writeHead(404, { 'Content-Type': 'text/html'});
                response.end();
            }
        }).listen(opt.port, opt.iface);
    }

    // Parse the close stats value
    function SoParser(db) {
        var retries = 0;

        // statemachine with html parser
        function CloseStatsParser() {
            var rsc_state = false,
                parsedValue,
                parser = new htmlparser.Parser({
                    onopentag: function (name, attribs) {
                        if ((name === "a") && !rsc_state && attribs["class"] === "review-stats-count") {
                            console.log("found stat");
                            rsc_state = true;
                        }
                    },
                    ontext: function (text) {
                        if (rsc_state) {
                            console.log("-->", text);
                            parsedValue = text;
                        }
                    },
                    onclosetag: function (tagname) {
                        if ((tagname === "a") && rsc_state) {
                            console.log("That's it?!");
                            rsc_state = false;
                        }
                    }
                }, {decodeEntities: true});

            function getValue() {
                return parseInt(parsedValue.replace(',', ''), 10);
            }

            return {
                write: function (x) { parser.write(x); },
                end: function () { parser.end(); },
                getValue: getValue
            };
        }

        function getUTC() {
            // http://stackoverflow.com/a/9525297/578411
            var now = new Date();

            return new Date(Date.UTC(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                now.getHours(),
                now.getMinutes()
            ));
        }

        function fiveMinutes() {
            var current = new Date(),
                min = (Math.floor(current.getMinutes() / 5) + 1) * 5,
                next = new Date();
            next.setMinutes(min);
            next.setSeconds(0);
            return next - current;
        }

        // events every 5 minutes
        function parseStats() {
            console.log('parse at ' + new Date().toTimeString());
            // fetch the page and start parsing
            var req = http.get('http://stackoverflow.com/review/close/stats', function (res) {
                var parser = new CloseStatsParser();
                retries = 0;
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    parser.write(chunk);
                });
                res.on('end', function () {
                    var intValue;
                    parser.end();
                    intValue = parser.getValue();
                    console.log('No more data in response. value to store ' + intValue + ' at ' + Date.now());

                    if (!isNaN(intValue)) {
                        db.insert('INSERT INTO `closequeue` (`Time`, `NumInQueue`) VALUES ( ?, ?)', [ getUTC(), intValue]);
                    }
                    // re schedule
                    setTimeout(parseStats, fiveMinutes());
                });
            });

            req.on('error', function (e) {
                console.log('problem with request: ' + e.message);
                if (retries < 3) {
                    console.log('retry ' + retries);
                    setTimeout(parseStats, 5000);
                    retries = retries + 1;
                } else {
                    retries = 0;
                    console.log('give up');
                    setTimeout(parseStats, fiveMinutes());
                }
            });
        }

        console.log('parser started');
        setTimeout(parseStats, fiveMinutes());
    }


    function init() {
        var port = process.env.PORT  || 4242,
            iface = process.env.SERVER_IFACE || null,
            db = new DataAccess(),
            http = new HttpServer({ port: port, iface: iface}, db),
            parse = new SoParser(db);

        console.log('running');
    }

    init();
}());
