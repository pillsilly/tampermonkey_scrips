// ==UserScript==
// @name         jenkins-blue-reveal-duration
// @namespace    http://tampermonkey.net/
// @version      2024-03-14
// @description  try to take over the world!
// @author       You
// @match        https://oam-cci.oam.scm.nsn-rdnet.net/blue/organizations/jenkins/*/detail/*/*/pipeline/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nsn-rdnet.net
// @require  http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant GM_addStyle
// ==/UserScript==

(function() {
    'use strict';


    waitForKeyElements(
        'g.PWGx-pipeline-node',
        () => {
            revealDuration()
        }
    );

    function revealDuration() {
        document.querySelectorAll('.title-text').forEach(c => c.remove());
        document.querySelectorAll('g.PWGx-pipeline-node').forEach(node => {
            // Extract text from the <title> element
            const t = node.querySelector('title');
            if(!t) return ;
            const titleText = t?.innerHTML;
            // Create a new SVG <text> element to display the title text
            const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textElement.setAttribute("x", -9);
            textElement.setAttribute("y", 55); // Adjust the Y position as needed to not overlap with the circle
            textElement.setAttribute("class", "title-text"); // Optional: for styling purposes
            textElement.textContent = titleText;
            // Append the <text> element to the <g> node
            node.appendChild(textElement);
        });
    }

})();