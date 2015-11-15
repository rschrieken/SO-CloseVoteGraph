/*global require:true, console:true, process:true */
// install
// npm install htmlparser2
// npm install mysql

(function () {
    "use strict";
    var http = require('http'),
        htmlparser = require('htmlparser2');

    function DataAccess() {

        var mysql = require('mysql'),
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
            } else {
                console.log('no enviroment var found');
            }
            pool = mysql.createPool(parsed);
        }

        init();

        return {
            insert: insert
        };
    }

    // Parse the close stats value
    function SoParser(db) {
        var retries = 0,
            missed = [];

        // statemachine with html parser
        function CloseStatsParser() {
            var rsc_state = false,
                parsedValue,
                parser = new htmlparser.Parser({
                    onopentag: function (name, attribs) {
                        if ((name === "a") && !rsc_state && attribs["class"] === "review-stats-count") {
                            rsc_state = true;
                        }
                    },
                    ontext: function (text) {
                        if (rsc_state) {
                            parsedValue = text;
                        }
                    },
                    onclosetag: function (tagname) {
                        if ((tagname === "a") && rsc_state) {
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
                    var intValue,
                        values;
                    parser.end();
                    intValue = parser.getValue();
                    console.log('Value to store ' + intValue + ' at ' + Date.now());

                    if (!isNaN(intValue)) {
                        values = [ getUTC(), intValue];
                        db.insert(
                            'INSERT INTO `closequeue` (`Time`, `NumInQueue`) VALUES ( ?, ?)',
                            values,
                            function (err) {
                                if (err) { 
                                    console.log('error storing value');
                                    process.exitCode = 1; 
                                }
                                
                                process.exit();
                            }
                        );
                    } else {
                        console.log('no number found');
                    }
                    // re schedule
                    console.log('complete');
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
                    console.log('giving up');
                    process.exit(2);
                }
            });
        }

        console.log('parser started');
        parseStats();
    }


    function init() {
        var db = new DataAccess(),
            parse = new SoParser(db);

        console.log('running');
    }

    init();
}());
