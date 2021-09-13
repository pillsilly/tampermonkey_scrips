// ==UserScript==
// @name         Gerrit
// @namespace    http://tampermonkey.net/
// @version      0.4
// @author       You
// @match        https://gerrit.ext.net.nokia.com/gerrit/c/MN/MANO/OAMCU/WEBEM/webem/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let lastTargetLength = 0;
    let scheduled = setInterval(attach, 1000);

    function attach() {
        console.log('scanning for attaching')
        const clickAbleBanners = document.querySelectorAll('div.collapsed.hideAvatar');
        lastTargetLength = clickAbleBanners.length;
        function clickableBannersRendered() {
            return !clickAbleBanners || !clickAbleBanners.length || (clickAbleBanners.length !== lastTargetLength);
        }
        if (clickableBannersRendered()) return;

        console.log('clearing scheduled')
        clearInterval(scheduled);

        console.log('processing attach')

        console.log(`found ${clickAbleBanners && clickAbleBanners.length} clickTargets`);

        createPipeLineLinks(clickAbleBanners);
        createRetryButtons();
        createCopyPathButtons();
    }

    function createCopyPathButtons () {
            $$('.fullFileName').forEach(z => {z.parentElement.appendChild((()=> {var b = document.createElement('button');b.innerHTML="button";return b})()).addEventListener('click', (event) => {console.log('clicked');event.stopPropagation();event.preventDefault(); navigator.clipboard.writeText(event.target.previousElementSibling.attributes.title.value)}, {} , true)})
    }
    
    function createPipeLineLinks(clickAbleBanners) {
        clickAbleBanners
            .forEach((target) => target.addEventListener("click", createPipeLineLink(target)))
    }

    function createPipeLineLink(session) {
        return () => {
            console.log(`clicked `, session)
            const infoArea = session.querySelector('#container > p:nth-child(2)');
            const replyContainerExist = !!session.querySelector('div.replyContainer>a');
            if (replyContainerExist) return;
            if (!infoArea) return;

            let infoAreaText = infoArea.innerText;
            let start = infoAreaText.indexOf('https://');
            infoAreaText = infoAreaText.slice(start, infoAreaText.length - 1);
            console.log(`text is ${infoAreaText}`);
            infoAreaText = infoAreaText.replace(/\r?\n?\s/g, '[break]');
            console.log(`text is ${infoAreaText}`);
            let end = infoAreaText.indexOf('[break]');


            if (!(start >= 0 && end > 10)) {
                console.log('not a place to add pipe line link');
                return;
            }

            let link;
            link = infoAreaText.slice(start, end);
            const project = link.match(/(jenkins\/(.*)\/detail)/).pop()
            console.log(`project is ${project}`)
            const pipeLineId = link.split('/').pop();
            const pipeLineLinkLog = ` https://oam-cci.japco.scm.nsn-rdnet.net/blue/rest/organizations/jenkins/pipelines/${project}/runs/${pipeLineId}/log/?`
            console.log(`log line link is ${pipeLineLinkLog}`);
            const replyContainer = session.querySelector('div.replyContainer');
            let aTag = document.createElement("a");
            aTag.setAttribute("href", pipeLineLinkLog);
            aTag.setAttribute("target", '_blank');
            aTag.innerHTML = 'pipeline log'
            replyContainer.appendChild(aTag)
            console.log(`append is done`, replyContainer);
        }
    }

    function createRetryButtons() {
        ['FORCE_REBUILD', 'RECHECK_PIT', 'RECHECK']
            .forEach(createButton)
    }

    function createButton(text) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.style.cssText = 'margin-left: 20px';
        btn.onclick = () => sendRetryMessage(text);
        document.querySelector('gr-messages-list').appendChild(btn);
    }

    function sendRetryMessage(msg) {
        const crNumber = window.location.href.split('/').pop();
        const patchSetNumber = document.querySelector('#patchNumDropdown #triggerText').innerText.trim().split(' ').pop();
        const url = `https://gerrit.ext.net.nokia.com/gerrit/changes/MN%2FMANO%2FOAMCU%2FWEBEM%2Fwebem~${crNumber}/revisions/${patchSetNumber}/review`
        const XSRF_TOKEN = document.cookie.split(';').find(p => p.trim().startsWith('XSRF_TOKEN')).split('=')[1];
        fetch(url, {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
                "content-type": "application/json",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-gerrit-auth": XSRF_TOKEN
            },
            "body": `{\"drafts\":\"PUBLISH_ALL_REVISIONS\",\"labels\":{},\"message\":\"${msg}\",\"reviewers\":[]}`,
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        }).then((resp) => {
            if (!resp.ok) {
                console.log(`Failed send ${msg}`, resp);
                return ;
            }
            const shouldReload = confirm(`Successfully send ${msg}, reload page now?`);
            if (shouldReload) {
                window.location.reload()
            }
        });
    }
})();
