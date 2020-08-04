# SO-CloseVoteGraph

Code is jslint-ed 

### Server

- NodeJS
- MySql

### Client

- HTML
- JavaScript
- Highcharts

### Layout of the source

- server.js contains the sever-side node-js stuff basically running an HttpServer with a couple of dedicated end-points and a small DataAccess layer to handle MySql queries  
-  run.js in app_data/jobs/triggered/parseSOstats  is triggered every 5 minutes and scrapes the http://stackoverflow.com/review/close/stats page with a simple htmlparser and stores the result in MySql

### Server.js

server js serves the following http end-points 

#### GET

- / serves the only html content the app has, from a single in memory string, its html links to 3 static resources
- /highcharts-custom.js serves the js file for the chart component
- /socvr.js serves the client-side script to make the ajax call to populate the high-charts with data
- /socvr.css the css to make things look less ugly
- /favicon.ico because every site needs one (and I didn't want to have 404's)

#### POST

- /data this endpoint is invoked from the socvr.js from the browser with an ajax call. In the post bosdy it expects and JSON payload with the any of folowing attributes filled, if selection is true, low and high are mandatory:
 ```
 {
    stats: true,
    initial: true,
    selection: true,
    low: 42,
    high: 4242
 }
 ```
stats  will return the earliest timestamp, latest timstamp and total number of observations.  
initial will return an array with objects with a timestamp and number in the queue (it only takes every 100 records)  
selection will return the same array but now only between the given low and high timestamp  

#### DataAccess

The DataAccess function is a small abstraction layer over MySql access. 

### run.js

This file is nothing more then a htmlParser and database logic to insert the parsed number of reviews and timestamp into the mysql table closequeue, with fields Time and NumInQueue

There is a retry in case fetching of the page fails, it retries 3 times, with 5 second interval and then gives up.

Notice that this file needs to end as soon as possible as it runs on a Azure web Job. So it doesn't handle its own scheduling.

### MySql

```
DROP TABLE IF EXISTS `socvr_cvq`.`closequeue`;
CREATE TABLE  `socvr_cvq`.`closequeue` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `NumInQueue` int(11) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_time` (`Time`)
) ENGINE=InnoDB AUTO_INCREMENT=188552 DEFAULT CHARSET=latin1;
```







