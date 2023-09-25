// ==UserScript==
// @name         Gerrit
// @namespace    http://tampermonkey.net/
// @version      0.82
// @author       Frank Wu
// @include  https://gerrit.ext.net.nokia.com/*
// @require  http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant GM_addStyle

// ==/UserScript==

(function () {
    'use strict';
    console.log('Gerrit loaded');

    let lastTargetLength = 0;
    let tryToAddButtons$;
    let tryToAddCopyPathButtons$;
    let tryToAddDashboardDirectLinks$;
    let addedLinks = [];
    let addedRetryButton=[];
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

    waitForKeyElements(
        '#changeList',
        () => {
            tryToAddDashboardDirectLinks$ && clearInterval(tryToAddDashboardDirectLinks$);

            setTimeout(tryToAddDashboardDirectLinks, 4000);
            tryToAddDashboardDirectLinks$ = setInterval(tryToAddDashboardDirectLinks, 600000);
        }
    );

    function tryToAddDashboardDirectLinks () {
        const toBeResolveNumber = 6;
        console.log('tryToAddDashboardDirectLinks in');
        execute();
        async function execute() {

            const list = findList ();
            if(!list?.length) {
                console.log("no cr list found yet")
                return;
            }

            console.log("cr list rendered");
            addedLinks.forEach(e => {e.remove()});
            addedLinks = [];
            addedRetryButton.forEach(e => {e.remove()});
            addedRetryButton = [];
            const d = new Date();
            const updateStr = `${d.getHours()}: ${d.getMinutes()} : ${d.getSeconds()}`
            for await (const item of list ){
                const {linkA, statusTd} = item;
                const href = linkA.getAttribute('href');
                const crlink = window.location.origin + href;

                const {verLink, verStatus, _number, _revision_number} = await getCrLinkDetail(crlink);

                if(!verLink){ continue;}

                const linkOfVerPipeline = document.createElement("a");
                const mariginRight = ['style', 'margin-right:10px'];
                let icon = 'Ongoing';
                linkOfVerPipeline.setAttribute(...mariginRight);
                if(verStatus === 0) {
                    linkOfVerPipeline.setAttribute("class", 'spinner');
                }

                if(verStatus === 1) {
                    icon = '✔'
                    linkOfVerPipeline.setAttribute("class", 'u-green');
                }

                if(verStatus <= -1) {
                    icon = '❌'
                    linkOfVerPipeline.setAttribute("class", 'u-red');
                }

                linkOfVerPipeline.innerHTML = `${icon}(${updateStr})`;


                linkOfVerPipeline.setAttribute("href", verLink);
                linkOfVerPipeline.setAttribute("target", '_blank');
                statusTd.prepend(linkOfVerPipeline);
                const retryButton = createRecheckButtonDashboard('RECHECK', () => {
                    sendRecheckMessage({_number, _revision_number, msg:'RECHECK'});
                });
                retryButton.setAttribute(...mariginRight);
                statusTd.prepend(retryButton);
                addedRetryButton.push(retryButton);
                addedLinks.push(linkOfVerPipeline)
            }

            console.log(list.length + "item proceeded");

        }

        function findList () {
            const visibleLists = [...document.querySelectorAll('gr-change-list-item')].map(function (tr) {
                const linkA = tr.querySelector('td.subject  a.gr-change-list-item');
                const statusTd = tr.querySelector('td.status');
                return { linkA, statusTd}
            });

            const list =  visibleLists.slice(0,visibleLists.length > toBeResolveNumber? toBeResolveNumber :visibleLists.length);
            console.log(`list length: ${list.length}`);
            return list;
        }

        async function getCrLinkDetail (crlink) {

            const text = await fetch(getDetailUrl(crlink)).then(body => body.text());
            const normalizedStr = normalizeToJsonStr(text);
            if(!normalizedStr) {
                return {verLink:'', verStatus: ''}
            }
            const detailData = JSON.parse(normalizedStr);

            const startingMsges = detailData.messages.filter(m => isStartingVerMessage(m.message));

            const _revision_number = detailData.messages.sort((a,b) => {return b._revision_number-a._revision_number})[0]._revision_number;

            const latestStartingMsg = startingMsges.pop();

            const latest_VER_URL = latestStartingMsg.message.split('Starting VERIFICATION:').pop().trim()

            console.log(latest_VER_URL);

            const pplVerifiedDetails = detailData.labels.Verified.all.find(item => item.username === 'ca_psscm');
            if(detailData.labels.Verified.approved) pplVerifiedDetails.value = 1;
            if(detailData.labels.Verified.rejected) pplVerifiedDetails.value = -1;


            return {verLink:latest_VER_URL, verStatus: pplVerifiedDetails.value, _number: detailData._number, _revision_number};
        }

        function normalizeToJsonStr(str) {
            let tmpArray = str.split('\n');
            tmpArray.shift();

            const jsonArray = tmpArray.join('');
            return jsonArray;
        }

        function isStartingVerMessage(msgText) {
            return msgText.indexOf('Starting VERIFICATION') > 0;
        }

        function getDetailUrl (crlink) {
            const origin = window.location.origin;
            const changeId = crlink.split('/').pop();

            return `${origin}/gerrit/changes/MN%2FMANO%2FOAMCU%2FWEBEM%2Fwebem~${changeId}/detail`
        }



    }

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
        // add copy fetch command button
        document.querySelector('#commitMessage')
            .parentElement
            .appendChild(createButtonToFetchLatestPatchCommit());

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
            const pipeLineLinkLog = ` https://oam-cci.oam.scm.nsn-rdnet.net/blue/rest/organizations/jenkins/pipelines/${project}/runs/${pipeLineId}/log/?`;
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
        ['RECHECK_ALL', 'RECHECK_PIT', 'RECHECK']
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

    function createRecheckButtonDashboard(text, onclick) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.style.cssText = 'margin-left: 20px';
        btn.onclick = onclick;
        console.log(`retry button created ${text}`);
        return btn
    }

    function sendRetryMessage(msg) {
        const _number = window.location.href.split('/').pop();
        const _revision_number = document.querySelector('#patchNumDropdown #triggerText').innerText.trim().split(' ').pop();

        return sendRecheckMessage({_number, _revision_number, msg});
    }

    function sendRecheckMessage({_number, _revision_number, msg}) {
        const url = `https://gerrit.ext.net.nokia.com/gerrit/changes/MN%2FMANO%2FOAMCU%2FWEBEM%2Fwebem~${_number}/revisions/${_revision_number}/review`;
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

    function createButtonToFetchLatestPatchCommit() {
        const ele = document.querySelector('#downloadCommands .commandContainer input')
        const eleValue = ele.value ; //git fetch "ssh://frawu@gerrit.ext.net.nokia.com:29418/MN/MANO/OAMCU/WEBEM/webem" refs/changes/41/5016741/3
        const gitCmd = eleValue.split('&&')[0];
        const button = document.createElement('button');
        button.innerHTML = "Copy Command Fetch newest commit";
        button.addEventListener('click',
                                (event) => {
            console.log('clicked');
            event.preventDefault();
            navigator.clipboard.writeText(gitCmd + ' && git log FETCH_HEAD -1');
        }, {}, true
                               )

        return button;
    }

    const css = `@keyframes spinner {
  to {transform: rotate(360deg);}
}

.spinner:before {
    vertical-align: text-bottom;
    content: '';
    display: inline-block;
    box-sizing: border-box;
    width: 20px;
    height: 20px;
    margin-top: -10px;
    margin-left: -10px;
    border-radius: 50%;
    border: 2px solid #ccc;
    border-top-color: #000;
    animation: spinner 1s linear infinite;
}`

    GM_addStyle(css)


})();

