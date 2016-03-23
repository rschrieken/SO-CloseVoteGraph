/*global Highcharts: true, console:true */
(function () {
    "use strict";
    var hc;
    var default_data;

    function ajaxPost(data, callback) {
        var oReq = new XMLHttpRequest();
        oReq.addEventListener("load", callback);
        oReq.open("POST", "/data");
        oReq.send(JSON.stringify(data));
    }

    function loadAsync(event) {

        function reqListener(event) {
            var points = JSON.parse(this.responseText);
            hc.series[0].setData(points);
            default_data = points;
            hc.hideLoading();
        }

        event.target.showLoading();
        ajaxPost({ initial: true}, reqListener);
    }

    function loadSelection(event) {

        function reqListener() {
            var points = JSON.parse(this.responseText);
            // we keep adding points
            // also if we might have already fetched them
            // FIX ME
            hc.series[0].setData(points);
            hc.hideLoading();
        }

        if ("resetSelection" in event) {
            hc.series[0].setData([]);
            hc.series[0].setData(default_data);
            hc.hideLoading();
        } else if (event.xAxis && event.xAxis.length > 0) {
            var xaxis = event.xAxis[0];
            event.target.showLoading();
            ajaxPost({ selection: true, low:xaxis.min , high:xaxis.max }, reqListener);
        }
    }

    function loadstat () {

        function setSpan(id, text) {
            var element = document.getElementById(id);
            if (element !== null) {
                element.textContent = text;
            }
        }
        function reqListener() {
            var objects = JSON.parse(this.responseText);
            for(var i in objects) {
                setSpan('min',objects[i].start);
                setSpan('max',objects[i].latest);
                setSpan('cnt',objects[i].observations);
            }
        }

        ajaxPost({ stats: true }, reqListener);
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
        setTimeout(loadstat, 5000);
    }

    document.addEventListener("DOMContentLoaded", function (event) {
        console.log("DOM fully loaded and parsed");
        init();
    });
}());
