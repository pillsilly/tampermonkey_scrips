// ==UserScript==
// @name         pipeline log helper
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  pipeline log helper
// @author       Frank
// @match        https://oam-cci.japco.scm.nsn-rdnet.net/**/?start=0
// @grant        none
// ==/UserScript==

const STEP_PREFIX = [
  'When I',
  'And I',
  'Given '
];
const FAILED_STEP_MARK = '✖ failed';
const FAILED_STEP_JEST_MARK = '] FAIL';

// comment out for nodejs test
// execute(require('fs').readFileSync('test/1.txt', {encoding: 'utf-8'}));
// return;

(async function () {
  'use strict';
  console.log('pipe line log helper executing');

  const logLink2 = `${window.location.href}&download=true`
  const fileContent = await fetch(logLink2).then(body => body.text());
  //const fileContent = document.querySelector('body>pre').textContent;
  console.log('file content', fileContent);
  execute(fileContent, writeToHtml);

  console.log('pipe line log helper done');
})();


function writeToHtml(records) {
  const table = document.createElement("table");
  table.innerHTML = `<thead><tr><td>Line Number</td><td>Scenario</td><td>Step</td><td>Error</td></tr></thead>${records}`;
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

function execute(fileContent, writeToHtml) {
  const lines = fileContent.split('\n');

  let sctRecords = '';
  let sctFaileCount = 0;
  lines.forEach((line, index) => {

    if (line.indexOf(FAILED_STEP_MARK) >= 0) {
      const sctInfo = recallStepAndScenario(index);
      const { FAILED_STEP_MARK_LINE_NUMBER, scenarioLine, stepLine, errorLine } = sctInfo;
      const tr = `<tr><td>${FAILED_STEP_MARK_LINE_NUMBER}</td><td>${scenarioLine}</td><td>${stepLine}</td><td>${errorLine}</td></tr>`
      console.info(tr)
      sctRecords = sctRecords + tr;
      sctFaileCount++
    }
    sctRecords += `<tr><td colspan="3">${sctFaileCount} SCT failed</td><tr>`
 
  });

  if (writeToHtml) writeToHtml(sctRecords);


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
    if (line.indexOf('Scenario:') >= 0) {
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