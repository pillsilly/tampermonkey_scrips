// ==UserScript==
// @name         Gerrit
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://gerrit.ext.net.nokia.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var lastTargetLength = 0;
    var scheduled = setInterval(attach, 1000);

    function attach(){
        console.log('scanning for attaching')
        const clickTargets = document.querySelectorAll('div.collapsed.hideAvatar');

        lastTargetLength = clickTargets.length;

        if (!clickTargets || !clickTargets.length || (clickTargets.length !== lastTargetLength)) return;


        console.log('clearing scheduled')
        clearInterval(scheduled);

        console.log('processing attach')

        console.log(`found ${clickTargets && clickTargets.length} clickTargets`);
        clickTargets.forEach(session => {
            session.addEventListener("click", addButtons(session));
            console.log(`added click to target session`, session)

            function addButtons(session){
                return () => {
                    console.log(`clicked `, session)
                    const infoArea = session.querySelector('#container > p:nth-child(2)');
                    const buttonArea = session.querySelector('div.replyContainer');
                    const existA = session.querySelector('div.replyContainer>a');
                    if (existA) return;
                    if (!infoArea) return;
                    var text = infoArea.innerText;
                    var start = text.indexOf('https://')
                    text = text.slice(start, text.length - 1);
                    console.log(`text is ${text}`);
                    text = text.replace(/\r?\n?\s/g, '[break]');
                    console.log(`text is ${text}`);
                    var end = text.indexOf('[break]');

                    var link;
                    if (start >= 0 && end > 10) {
                        console.log(`slice is ${start} , ${end}`);
                        link = text.slice(start, end);
                        console.log(`pipe line link is ${link}`);
                        const project = link.match(/(jenkins\/(.*)\/detail)/).pop()
                        console.log(`project is ${project}`)
                        const pplNumber = link.split('/').pop();
                        const logLink2 = ` https://oam-cci.japco.scm.nsn-rdnet.net/blue/rest/organizations/jenkins/pipelines/${project}/runs/${pplNumber}/log/?start=0`
                        console.log(`log line link is ${logLink2}`);

                        const buttonArea = session.querySelector('div.replyContainer');
                        var a = document.createElement("a");
                        a.setAttribute("href", logLink2);
                        a.setAttribute("target", '_blank');
                        a.innerHTML = 'pipeline log'
                        buttonArea.appendChild(a)
                        console.log(`append is done`, buttonArea);

                    }
                }
            }
        })
    }




})();
