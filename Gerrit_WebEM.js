// ==UserScript==
// @name         Gerrit
// @namespace    http://tampermonkey.net/
// @version      0.84
// @author       Frank Wu
// @include  https://gerrit.ext.net.nokia.com/*
// @require  http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant GM_addStyle

// ==/UserScript==

(function () {
  "use strict";
  console.log("Gerrit loaded");

  let lastTargetLength = 0;
  let tryToAddButtons$;
  let tryToAddCopyPathButtons$;
  let tryToAddDashboardDirectLinks$;
  let addedLinks = [];
  let addedRetryButton = [];
  const toBeResolveNumber = 6;

  waitForKeyElements(".headerTitle > .headerSubject", () => {
    console.log("page changed");
    clearInterval(tryToAddButtons$);
    clearInterval(tryToAddCopyPathButtons$);
    tryToAddButtons$ = setInterval(tryToAddButtons, 1000);
    tryToAddCopyPathButtons$ = setInterval(tryToAddCopyPathButtons, 1000);
  });

  waitForKeyElements("#changeList", () => {
    clearInterval(tryToAddDashboardDirectLinks$);
    setTimeout(tryToAddDashboardDirectLinks, 4000);
    tryToAddDashboardDirectLinks$ = setInterval(tryToAddDashboardDirectLinks, 600000);
  });

  async function tryToAddDashboardDirectLinks() {
    console.log("tryToAddDashboardDirectLinks in");
    const list = findList();
    if (!list?.length) {
      console.log("no cr list found yet");
      return;
    }

    console.log("cr list rendered");
    addedLinks.forEach((e) => e.remove());
    addedLinks = [];
    addedRetryButton.forEach((e) => e.remove());
    addedRetryButton = [];
    const d = new Date();
    const updateStr = `${d.getHours()}: ${d.getMinutes()} : ${d.getSeconds()}`;

    for await (const item of list) {
      const { linkA, statusTd, project } = item;
      const href = linkA.getAttribute("href");
      const crlink = window.location.origin + href;
      const { verLink, verStatus, _number, _revision_number } = await getCrLinkDetail(crlink, project);

      if (!verLink) continue;

      const linkOfVerPipeline = document.createElement("a");
      linkOfVerPipeline.style.marginRight = "10px";

      let icon = "Ongoing";
      if (verStatus === 0) linkOfVerPipeline.setAttribute("class", "spinner");
      if (verStatus === 1) { icon = "✔"; linkOfVerPipeline.setAttribute("class", "u-green"); }
      if (verStatus <= -1) { icon = "❌"; linkOfVerPipeline.setAttribute("class", "u-red"); }

      linkOfVerPipeline.innerHTML = `${icon}(${updateStr})`;
      linkOfVerPipeline.setAttribute("href", verLink);
      linkOfVerPipeline.setAttribute("target", "_blank");

      const retryButton = createButton("RECHECK", (a, b, c) => {
        const project = a.target.parentNode.parentNode.querySelector("td.repo a.truncatedRepo").title;
        sendRecheckMessage({ _number, _revision_number, msg: "RECHECK", project });
      });
      retryButton.style.marginRight = "10px";
      statusTd.prepend(linkOfVerPipeline, retryButton);
      addedRetryButton.push(retryButton);
      addedLinks.push(linkOfVerPipeline);
    }
    console.log(list.length + "item proceeded");
  }

  function findList() {
    const visibleLists = [...document.querySelectorAll("gr-change-list-item")].map((tr) => ({
      linkA: tr.querySelector("td.subject  a.gr-change-list-item"),
      statusTd: tr.querySelector("td.status"),
      project: tr.querySelector("td.repo a.truncatedRepo").title,
    }));
    return visibleLists.slice(0, visibleLists.length > toBeResolveNumber ? toBeResolveNumber : visibleLists.length);
  }

  async function getCrLinkDetail(crlink, project) {
    const text = await fetch(getDetailUrl(crlink, project)).then((body) => body.text());
    const normalizedStr = normalizeToJsonStr(text);
    if (!normalizedStr) return { verLink: "", verStatus: "" };

    const detailData = JSON.parse(normalizedStr);
    const startingMsges = detailData.messages.filter((m) => isStartingVerMessage(m.message));
    const _revision_number = detailData.messages.sort((a, b) => b._revision_number - a._revision_number)[0]._revision_number;
    const latestStartingMsg = startingMsges.pop();
    const latest_VER_URL = latestStartingMsg.message.split("Starting VERIFICATION:").pop().trim();

    console.log(latest_VER_URL);
    const pplVerifiedDetails = detailData.labels.Verified.all.find((item) => item.username === "ca_psscm") || {};
    if (detailData.labels.Verified.approved) pplVerifiedDetails.value = 1;
    if (detailData.labels.Verified.rejected) pplVerifiedDetails.value = -1;

    return { verLink: latest_VER_URL, verStatus: pplVerifiedDetails?.value, _number: detailData._number, _revision_number };
  }

  function normalizeToJsonStr(str) {
    let tmpArray = str.split("\n");
    tmpArray.shift();
    return tmpArray.join("");
  }

  function isStartingVerMessage(msgText) {
    return msgText.indexOf("Starting VERIFICATION") > 0;
  }

  function getDetailUrl(crlink, project) {
    const origin = window.location.origin;
    const changeId = crlink.split("/").pop();
    return `${origin}/gerrit/changes/${encodeURIComponent(project)}~${changeId}/detail`;
  }

  function tryToAddButtons() {
    console.log("tryToAddButtons");
    const clickAbleBanners = document.querySelectorAll("div.collapsed.hideAvatar");
    const relatedChanges = document.querySelector("section.relatedChanges");
    lastTargetLength = clickAbleBanners.length;

    if (!relatedChanges || !clickAbleBanners || !clickAbleBanners.length || clickAbleBanners.length !== lastTargetLength) return;

    [...document.querySelectorAll("#downloadCommands .commandContainer input")].forEach((x) => {
      const temp = document.createElement("div");
      temp.innerHTML = x.value;
      document.querySelector("#commitMessage").parentElement.appendChild(temp);
    });

    createButtonToFetchLatestPatchCommit().forEach((createdEle) => document.querySelector("#commitMessage").parentElement.appendChild(createdEle));
    createPipeLineLinks(clickAbleBanners);
    createRetryButtons();
    clearInterval(tryToAddButtons$);
  }

  function tryToAddCopyPathButtons() {
    console.log("tryToAddCopyPathButtons");
    const copyFilePathBtns = document.querySelectorAll('button[name="copyFilePath"]');
    const fileRow = document.querySelectorAll(".file-row");
    if (!copyFilePathBtns?.length && fileRow && fileRow.length) {
      createCopyPathButtons();
      clearInterval(tryToAddCopyPathButtons$);
    }
  }

  function createCopyPathButtons() {
    document.querySelectorAll(".fullFileName").forEach((item, index) => {
      if (index === 0) return;
      const button = createButton("Copy File Path", (event) => {
        console.log("clicked");
        event.preventDefault();
        navigator.clipboard.writeText(event.target.previousElementSibling.attributes.title.value);
      });
      item.parentElement.appendChild(button);
    });
  }

  function createPipeLineLinks(clickAbleBanners) {
    clickAbleBanners.forEach((target) => target.addEventListener("click", () => {
      console.log(`clicked `, target);
      const infoArea = target.querySelector("#container > p:nth-child(2)");
      const replyContainerExist = !!target.querySelector("div.replyContainer>a");
      if (replyContainerExist || !infoArea) return;

      let infoAreaText = infoArea.innerText;
      let start = infoAreaText.indexOf("https://");
      infoAreaText = infoAreaText.slice(start, infoAreaText.length - 1);
      console.log(`text is ${infoAreaText}`);
      infoAreaText = infoAreaText.replace(/\r?\n?\s/g, "[break]");
      console.log(`text is ${infoAreaText}`);
      let end = infoAreaText.indexOf("[break]");
      if (!(start >= 0 && end > 10)) {
        console.log("not a place to add pipe line link");
        return;
      }
      let link = infoAreaText.slice(start, end);
      const project = link.match(/(jenkins\/(.*)\/detail)/).pop();
      console.log(`project is ${project}`);
      const pipeLineId = link.split("/").pop();
      const pipeLineLinkLog = ` https://oam-cci.oam.scm.nsn-rdnet.net/blue/rest/organizations/jenkins/pipelines/${project}/runs/${pipeLineId}/log/?`;
      console.log(`log line link is ${pipeLineLinkLog}`);
      const replyContainer = target.querySelector("div.replyContainer");
      let aTag = document.createElement("a");
      aTag.setAttribute("href", pipeLineLinkLog);
      aTag.setAttribute("target", "_blank");
      aTag.innerHTML = "pipeline log";
      replyContainer.appendChild(aTag);
      console.log(`append is done`, replyContainer);
    }));
    console.log(`PipeLineLinks created`);
  }

  function createRetryButtons() {
    ["RECHECK_ALL", "RECHECK_PIT", "RECHECK"].forEach((text) => {
      const btn = createButton(text, (ele) => {
        sendRetryMessage(text, project);
      });
      document.querySelector("gr-messages-list").appendChild(btn);
      console.log(`retry button created ${text}`);
    });
  }

  function createButton(text, onclick) {
    const btn = document.createElement("button");
    btn.innerHTML = text;
    btn.style.cssText = "margin-left: 20px";
    btn.onclick = onclick;
    console.log(`button created ${text}`);
    return btn;
  }

  function sendRetryMessage(msg, project) {
    const _number = window.location.href.split("/").pop();
    const _revision_number = document.querySelector("#patchNumDropdown #triggerText").innerText.trim().split(" ").pop();
    return sendRecheckMessage({ _number, _revision_number, msg, project });
  }

  function sendRecheckMessage({ _number, _revision_number, msg, project }) {
    const url = `https://gerrit.ext.net.nokia.com/gerrit/changes/${encodeURIComponent(project)}~${_number}/revisions/${_revision_number}/review`;
    const XSRF_TOKEN = document.cookie.split(";").find((p) => p.trim().startsWith("XSRF_TOKEN")).split("=")[1];
    fetch(url, {
      headers: { accept: "*/*", "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7", "content-type": "application/json", "sec-fetch-dest": "empty", "sec-fetch-mode": "cors", "sec-fetch-site": "same-origin", "x-gerrit-auth": XSRF_TOKEN },
      body: `{\"drafts\":\"PUBLISH_ALL_REVISIONS\",\"labels\":{},\"message\":\"${msg}\",\"reviewers\":[]}`,
      method: "POST", mode: "cors", credentials: "include",
    }).then((resp) => {
      if (!resp.ok) { console.log(`Failed send ${msg}`, resp); return; }
      if (confirm(`Successfully send ${msg}, reload page now?`)) window.location.reload();
    });
  }

  function createButtonToFetchLatestPatchCommit() {
    const ele = document.querySelector("#downloadCommands .commandContainer input");
    const eleValue = ele.value;
    const gitCmd = eleValue.split("&&")[0];
    const button = createButton("Copy Command Fetch newest commit", () => {
      console.log("clicked");
      navigator.clipboard.writeText(gitCmd + " && git log FETCH_HEAD -1");
    });
    const [, change, patch] = eleValue.split("refs/changes/")[1].split("&&")[0].split("/").map((z) => z?.trim());
    return [button, ...createButtonsToFetchPackage({ change, patch })];
  }

  function createButtonsToFetchPackage({ change, patch }) {
    const downloadPaths = ["VDU", "CU"].map((productType) => {
      const url = `https://artifactory-espoo1.int.net.nokia.com/artifactory/list/japco-local/sc-build-artifacts/oam-cci/MN_MANO_OAMCU_WEBEM_webem/master/VERIFICATION/${change}_${patch}/BUILD_${productType}/WEBEM/${productType === "CU" ? "rcp" : "rcp_oam"}/webem-${productType}.staging.txz`;
      console.log(`download path is `, url);
      return { url, filename: `${change}_${patch}_${productType}_webem.staging.txz` };
    });

    return downloadPaths.map(({ url, filename }) => {
      return Object.assign(document.createElement("a"), { download: filename, href: url, innerText: filename });
    });
  }

  GM_addStyle(`@keyframes spinner { to {transform: rotate(360deg);} }
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
}`);
})();
