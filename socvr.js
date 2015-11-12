/*global Highcharts: true, console:true */
(function () {
    "use strict";
    var hc;

    function loadAsync(event) {
        var oReq = new XMLHttpRequest();

        function reqListener() {
            var points = JSON.parse(oReq.responseText);
            hc.series[0].setData(points);
            hc.hideLoading();
          /*hc.series[0].addPoint([20000000,9]);
          hc.series[0].addPoint([30000000,2]);*/
        }

        event.target.showLoading();

        oReq.addEventListener("load", reqListener);
        oReq.open("POST", "/data");
        oReq.send(JSON.stringify({ initial: true}));
    }

    function loadSelection(event) {
        var oReq = new XMLHttpRequest();

        function reqListener() {
            var points = JSON.parse(oReq.responseText);
            // we keep adding points
            // also if we might have already fetched them
            // FIX ME
            for(var i in points) {
                hc.series[0].addPoint(points[i], false);
            }
            hc.hideLoading();
            hc.redraw();
        }
        
        if (event.xAxis && event.xAxis.length > 0) {
            var xaxis = event.xAxis[0];
            oReq.addEventListener("load", reqListener);
            oReq.open("POST", "/data");
            event.target.showLoading();
            oReq.send(JSON.stringify({ selection: true, low:xaxis.min , high:xaxis.max }));
        }
    }
    
    function init() {
        hc = new Highcharts.Chart({
            chart : {
                events : {
                    load : loadAsync,
                    selection: loadSelection
                },
                type : 'line',
                renderTo : 'container',
                zoomType : 'x'
            },
            title : {
                text : 'CVQ'
            },
            xAxis : {
                type : 'datetime'
            },
            yAxis : {
                title : {
                    text : 'Size'
                }
            },
            series : [{
                type: 'line',
                name: 'Queue'
            }]
        });
    }

    document.addEventListener("DOMContentLoaded", function (event) {
        console.log("DOM fully loaded and parsed");
        init();
    });
}());