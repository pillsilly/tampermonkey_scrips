// ==UserScript==
// @name         Gerrit
// @namespace    http://tampermonkey.net/
// @version      0.7
// @author       Frank Wu
// @include  https://gerrit.ext.net.nokia.com/*
// @require  http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('Gerrit loaded');

    let lastTargetLength = 0;
    let tryToAddButtons$;
    let tryToAddCopyPathButtons$;

    waitForKeyElements(
        '.headerTitle > .headerSubject',
        () => {
            console.log('page changed');

            tryToAddButtons$ && clearInterval(tryToAddButtons$);
            tryToAddCopyPathButtons$ && clearInterval(tryToAddCopyPathButtons$);


            tryToAddButtons$ = setInterval(tryToAddButtons, 1000);
            tryToAddCopyPathButtons$ = setInterval(tryToAddCopyPathButtons, 1000);
        }
    );

    function tryToAddButtons() {
        console.log('tryToAddButtons');
        const clickAbleBanners = document.querySelectorAll('div.collapsed.hideAvatar');
        const relatedChanges = document.querySelector('section.relatedChanges');

        lastTargetLength = clickAbleBanners.length;
        function isRenderingBanners() {
            return !relatedChanges || !clickAbleBanners || !clickAbleBanners.length || (clickAbleBanners.length !== lastTargetLength);

        }
        if (isRenderingBanners()) return;


        [...document.querySelectorAll('#downloadCommands .commandContainer input')].map(x => {
            const temp = document.createElement('div');
            temp.innerHTML = x.value;
            document.querySelector('#commitMessage').parentElement.appendChild(temp);
        });

        createPipeLineLinks(clickAbleBanners);
        createRetryButtons();
        clearInterval(tryToAddButtons$);
    }

    function tryToAddCopyPathButtons() {
        console.log('tryToAddCopyPathButtons');
        const copyFilePathBtns = document.querySelectorAll('button[name="copyFilePath"]');
        const fileRow = document.querySelectorAll('.file-row');

        if (!copyFilePathBtns?.length && fileRow && fileRow.length) {
            createCopyPathButtons();
            clearInterval(tryToAddCopyPathButtons$);
        }

    }

    function createCopyPathButtons() {
        document.querySelectorAll('.fullFileName')
            .forEach(createPathButton);

        function createPathButton(item, index) {
            if (index === 0) return;

            const button = document.createElement('button');
            button.innerHTML = "Copy File Path";
            button.setAttribute('name', 'copyFilePath');

            item.parentElement
                .appendChild(button)
                .addEventListener('click',
                    (event) => {
                        console.log('clicked');
                        event.preventDefault();
                        navigator.clipboard.writeText(event.target.previousElementSibling.attributes.title.value);
                    }, {}, true
                );
        }
    }

    function createPipeLineLinks(clickAbleBanners) {
        clickAbleBanners
            .forEach((target) => target.addEventListener("click", createPipeLineLink(target)));

        console.log(`PipeLineLinks created`);
    }

    function createPipeLineLink(session) {
        return () => {
            console.log(`clicked `, session);
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
            const project = link.match(/(jenkins\/(.*)\/detail)/).pop();
            console.log(`project is ${project}`);
            const pipeLineId = link.split('/').pop();
            const pipeLineLinkLog = ` https://oam-cci.japco.scm.nsn-rdnet.net/blue/rest/organizations/jenkins/pipelines/${project}/runs/${pipeLineId}/log/?`;
            console.log(`log line link is ${pipeLineLinkLog}`);
            const replyContainer = session.querySelector('div.replyContainer');
            let aTag = document.createElement("a");
            aTag.setAttribute("href", pipeLineLinkLog);
            aTag.setAttribute("target", '_blank');
            aTag.innerHTML = 'pipeline log';
            replyContainer.appendChild(aTag);
            console.log(`append is done`, replyContainer);
        };
    }

    function createRetryButtons() {
        ['FORCE_REBUILD', 'RECHECK_PIT', 'RECHECK']
            .forEach(createButton);
    }

    function createButton(text) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.style.cssText = 'margin-left: 20px';
        btn.onclick = () => sendRetryMessage(text);
        document.querySelector('gr-messages-list').appendChild(btn);
        console.log(`retry button created ${text}`);
    }

    function sendRetryMessage(msg) {
        const crNumber = window.location.href.split('/').pop();
        const patchSetNumber = document.querySelector('#patchNumDropdown #triggerText').innerText.trim().split(' ').pop();
        const url = `https://gerrit.ext.net.nokia.com/gerrit/changes/MN%2FMANO%2FOAMCU%2FWEBEM%2Fwebem~${crNumber}/revisions/${patchSetNumber}/review`;
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
                return;
            }
            const shouldReload = confirm(`Successfully send ${msg}, reload page now?`);
            if (shouldReload) {
                window.location.reload();
            }
        });
    }

})();
