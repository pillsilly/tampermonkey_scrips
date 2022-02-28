// ==UserScript==
// @name         pipeline log helper
// @namespace    http://tampermonkey.net/
// @version      0.1.7
// @description  pipeline log helper
// @author       Frank
// @match        https://oam-cci.japco.scm.nsn-rdnet.net/**/log/*
// @grant        none
// ==/UserScript==

const STEP_PREFIX = [
  'When ',
  'And ',
  'Given '
];
const FAILED_STEP_MARK = '✖ failed';
const FAILED_STEP_JEST_MARK = '] FAIL';

// comment out for nodejs test
if ('object' === typeof (process)) {
  const testOutput = execute(require('fs').readFileSync('test/utfailed.txt', { encoding: 'utf-8' }));
  console.log(testOutput)
  return;
}


(async function () {
  'use strict';
  console.log('pipe line log helper executing');

  const htmlparts = window.location.href.split('?');

  const head = (htmlparts && htmlparts.length > 0 ) ? window.location.href.split('?')[0]: window.location.href;

  const logLink2 = `${head}?start=0&download=true`

  const fileContent = await fetch(logLink2).then(body => body.text());
  //const fileContent = document.querySelector('body>pre').textContent;
  //console.log('file content', fileContent);
  //document.querySelector('body>pre').innerText = fileContent;
  execute(fileContent, writeToHtml, logLink2);

  console.log('pipe line log helper done');
})();


function execute(fileContent, writeToHtml, downloadLink) {
  const lines = fileContent.split('\n');

  let sctTRs = '';
  let sctFaileCount = 0;
  lines.forEach((line, index) => {

    if (line.indexOf(FAILED_STEP_MARK) >= 0) {
      const sctInfo = recallStepAndScenario(index);
      const { FAILED_STEP_MARK_LINE_NUMBER, scenarioLine, stepLine, errorLine } = sctInfo;
      const tr = `<tr><td>${FAILED_STEP_MARK_LINE_NUMBER}</td><td>${scenarioLine}</td><td>${stepLine}</td><td>${errorLine}</td></tr>`
      console.info(tr)
      sctTRs = sctTRs + tr;
      sctFaileCount = sctFaileCount + 1;
    }

  });

  const sctSummary = `<tr><td colspan="4"> <b> ${sctFaileCount} SCT cases were failed </b>  <a href='${downloadLink}'> click to download full log </a></td></tr>`;
  if (writeToHtml) writeToHtml(sctTRs, sctSummary);

  return {
    sctTRs,
    sctFaileCount
  }


  function recallStepAndScenario(currentIndex) {
    const toCheckLineIndex = currentIndex - 1;
    const errorLine = lines[currentIndex + 1];
    const stepLine = findStep(toCheckLineIndex);
    const scenarioLine = findScenario(toCheckLineIndex - 1);

    return {
      errorLine,
      FAILED_STEP_MARK_LINE_NUMBER: toCheckLineIndex,
      stepLine,
      scenarioLine
    }
  }

  function findScenario(index) {
    const line = lines[index];
    if (line.indexOf('Scenario:') >= 0 || line.indexOf('Scenario Outline:') >= 0) {
      return line;
    }

    return findScenario(index - 1)
  }

  function findStep(index) {
    const line = lines[index];
    const isStep = STEP_PREFIX.some(possiblePrefix => {
      return line.indexOf(possiblePrefix) >= 0;
    });
    return isStep ? line : findStep(index - 1)
  }
}


function writeToHtml(sctTrs, sctSummary) {
  const table = document.createElement("table");
  table.innerHTML = sctSummary +  `<tr><td>Line Number</td><td>Scenario</td><td>Step</td><td>Error</td></tr>${sctTrs}`;
  document.body.prepend(table)

  const style = document.createElement('style');
  style.type = 'text/css';
  const cssText = 'table, tr, td {border: 1px solid black};';
  if (style.styleSheet) {
    style.styleSheet.cssText = cssText;
  } else {
    style.appendChild(document.createTextNode(cssText));
  }
  document.getElementsByTagName('head')[0].appendChild(style);
}
