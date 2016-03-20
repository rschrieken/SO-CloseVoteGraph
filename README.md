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
-  run.js in app_data/jobs/triggered/parseSOstats  is triggered every 5 minutes and scrapes the /review/stats page with a simple htmlparser and stores the result in MySql

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







