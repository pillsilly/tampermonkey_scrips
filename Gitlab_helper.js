// ==UserScript==
// @name         AutoRetry
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  try to take over the world!
// @author       You
// @match        https://baltig.nsn-net.net/admin-ftw15/admin/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function isPipeLineFailed(){
        return $('.ci-widget.media>a>span').hasClass('js-ci-status-icon-failed')
    }

    function getPipeLineId(){
        return $('.ci-widget.media>a:first').attr('href').split('/').reverse()[0];
    }

    function triggerRetry(pipeLineId){
        console.log(`Retry ${pipeLineId}`);
        $.post(`https://baltig.nsn-net.net/admin-ftw15/admin/pipelines/${pipeLineId}/retry.json`);
        console.log(`Stop myTimer`);
        clearInterval(myTimer)
        setTimeout(autoRetry, 30000);
    }

    function checkAndRetry() {
        if(isPipeLineFailed())
            triggerRetry(getPipeLineId());
        else
            console.log('Pipeline has not failed');
    }

    var myTimer ;

    window.autoRetry = autoRetry;

    function autoRetry () {
        console.log(`Start myTimer`);
        $('#retrybutton0').text('retrying').prop('disabled',true);
        myTimer = setInterval(checkAndRetry,5000)
    }

    $('.mr-widget-pipeline-graph:first').append('<button id="retrybutton0" style="margin-left: 15px;" class="btn btn-sm btn-info" onclick="autoRetry()">Start auto retry</button>')

})();
