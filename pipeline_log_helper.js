    // ==UserScript==
    // @name         pipeline log helper
    // @namespace    http://tampermonkey.net/
    // @version      0.1
    // @description  asdfasdf
    // @author       You
    // @match        https://oam-cci.japco.scm.nsn-rdnet.net/**/?start=0
    // @grant        none
    // ==/UserScript==

    (function () {
        'use strict';

        // const fs = require('fs');

        setTimeout(extract, 2000)



        function extract() {
            const STEP_PREFIX = [
                'When I',
                'And I',
                'Given '
            ]

            const fileContent = document.querySelector('body>pre').textContent;
            // const fileContent = fs.readFileSync('test/1.txt', { encoding: 'utf-8' });
            const lines = fileContent.split('\n');
            // const lastIndex = lines.length - 1;

            lines.forEach((line, index) => {
                //console.log(`>>>>>> ${line}`);
                if (!line || line.indexOf('✖ failed') < 0) return;


                const info = retriveStepAndSchenario(index)
                console.log(info)
            });

            function retriveStepAndSchenario(currentIndex) {
                const toCheckLineIndex = currentIndex - 1;
                const step = findStep(toCheckLineIndex);
                const failureFirstLine = lines[currentIndex + 1]
                const scenario = findScenario(toCheckLineIndex - 1)

                return {
                    failureFirstLine,
                    index: toCheckLineIndex,
                    step,
                    scenario
                }
            }

            function findScenario(index) {
                const scenario = lines[index];
                if (scenario && scenario.indexOf('Scenario:') >= 0) {
                    return scenario;
                }

                return findScenario(index - 1)
            }


            function findStep(index) {
                const step = lines[index];
                const isStep = STEP_PREFIX.some(p => {
                    return step && step.indexOf(p) >= 0;
                })
                if (isStep) {
                    return step;
                }
                return findScenario(index - 1)
            }
        }


    })();
