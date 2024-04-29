// ==UserScript==
// @name         flowgraph-reveal-duration
// @namespace    http://tampermonkey.net/
// @version      2024-03-14
// @description  try to take over the world!
// @author       You
// @match        https://oam-cci.oam.scm.nsn-rdnet.net/job/ZUUL_CHECK__MN.MANO.OAMCU.WEBEM.webem__VERIFICATION/*/flowGraphTable/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nsn-rdnet.net
// @require  http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant GM_addStyle
// ==/UserScript==

(function () {
  ("use strict");
const mainPath = "a.jenkins-table__link";
  waitForKeyElements(mainPath, () => {
    revealDuration();
  });

  function getTDElementsContainingText1(text) {
    var xpathResult = document.evaluate(
      '//td[contains(text(), "JOB_TYPE=ut_online")]',
      document,
      null,
      XPathResult.ANY_TYPE,
      null
    );
    var tdElements = [];
    var node = xpathResult.iterateNext();
    while (node) {
      tdElements.push(node);
      node = xpathResult.iterateNext();
    }
    return tdElements;
  }

  function revealDuration() {
    var tdArray = getTDElementsContainingText1();
    console.log(tdArray);
    const textArray = tdArray.map((a) => {
      const name = a.innerHTML.match(/UT_[\d.]+(?:\.NOT)?NESTJS/)[0];
      const duration = a.previousElementSibling
        .querySelector("a")
        .innerHTML.split("-")[2];
      return { name, duration };
    });
    console.table(textArray);
  }
})();