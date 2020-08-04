/*global require:true, console:true, process:true */
// install
// npm install htmlparser2
// npm install mysql
// npm install config

(function () {
    "use strict";
    var http = require('http'),
        config = require('config');

    function DataAccess(connLimit) {

        var mysql = require('mysql'),
            dbc = config.get('mysql'),
            pool;

        function execute(query, params, result, end) {
            pool.getConnection(function (err, conn) {
                if (err) {
                    console.log('connection error');
                    if (typeof end === 'function') {end(true); }
                    return;
                }

                conn.query(query, params)
                    .on('result', result)
                    .on('end', function () {
                        conn.release();
                        if (typeof end === 'function') {end(false); }
                    });
            });
        }

        function insert(query, params, end) {
            execute(query, params, function (row) {console.log(row.insertId); }, end);
        }

        function select(query, params, result, end) {
            execute(query, params, result, end);
        }

        function buildNameValue(dict, part) {
            var namevalue = part.split('=');
            dict[namevalue[0]] = namevalue[1];
        }
        function buildDatabaseConfig(cstr) {
            var parts = cstr.split(';'),
                dict = [],
                i;
            for (i = 0; i < parts.length; i = i + 1) {
                buildNameValue(dict, parts[i]);
            }
            return dict;
        }

        function init() {
            var parsed = { connectionLimit : connLimit},
                keys;

            if (process.env.MYSQLCONNSTR_DefaultConnection) {
                console.log('parsed');
                keys = buildDatabaseConfig(process.env.MYSQLCONNSTR_DefaultConnection);
                parsed.host = keys['Data Source'];
                parsed.database = keys['Database'];
                parsed.user = keys['User Id'];
                parsed.password = keys['Password'];

            } else {
                console.log('no enviroment var found');
            }
            pool = mysql.createPool(parsed);
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
                function (error) {
                    if (error) {
                        response.write('{"error": true}');
                    }
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
                function (error) {
                    if (error) {
                        response.write('{"error": true}');
                    }
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
                    if (action && action.initial) {
                        sql = 'SELECT `Time`, `NumInQueue` from `closequeue` where mod(`id`,100) = 1 order by `Time`';
                        render = renderArray;
                    } else if (action && action.selection) {
                        sql = 'SELECT `Time`,`NumInQueue` from `closequeue` where `Time` between ? and ? order by `Time`';
                        params = [ new Date(action.low), new Date(action.high)];
                        render = renderArray;
                    } else if (action && action.stats) {
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

    function init() {
        var port = process.env.PORT  || 4242,
            iface = process.env.SERVER_IFACE || null,
            db = new DataAccess(3),
            http = new HttpServer({ port: port, iface: iface}, db);

        console.log('running');
    }

    init();
}());
