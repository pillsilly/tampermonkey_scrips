// ==UserScript==
// @name         ADMIN scripts
// @namespace    http://tampermonkey.net/
// @version      0.1.4
// @description  try to take over the world!
// @author       You
// @include https://10.**
// @include https://onion.wroclaw.nsn-rdnet.net/*
// @include http://localhost:*/*
// @include http://*:*/ADMIN.html*
// @include http://127.0.0.1:*/WebEM*.html

// @grant        none
// ==/UserScript==


(async function () {
    'use strict';
    console.log('ADMIN scripts loaded')
    if (!isADMIN()) {
        console.log('Not admin page, exit')
        return;
    };
    console.log('Continue to load ADMIN script')

    const htmlButtons = '<div class="simple-container" style="display: inline-flex;">' +
          '<button class="btn btn-defaultBlue btn-small" onclick="_loginOffline()">Offline mode</button>' +
          '<button class="btn btn-defaultBlue btn-small" onclick="_loginDev()">Online Dev mode</button>'
    '</div>';

    function _myService(name) {
        return angular.element(document.body).injector().get(name);
    }

    window._loginDev = _loginDev;
    function _loginDev() {
        _myService('imAuth').isRouteIdValid = () => { return true };
        $('input[name="userName"]').val('Nemuadmin');
        $('input[name="password"]').val('Nemuuser');
        $('div.login-buttons[a-text="Login"]').click();
    }

    window._myService = _myService;
    window._currentScope = () => angular.element($0).scope();
    window._loginOffline = loginOffline;
    window._copyObjectAsJSON = copyObjectAsJSON;
    window.onhashchange = () => {
        if(window.location.hash === "#/developer/tree")
            addCopyObjectButton();
    };

    function addCopyObjectButton() {
        angular.element('#main-view wf-panel.info-model-parameters > wf-panel-section div.parameters-panel-toolbar > div.other-buttons')
            .append('<button class="btn btn-small compact-button" style="color:blue" type="button" onclick=\'_copyObjectAsJSON()\'><i class="fa fa-copy" title="copy json node with decendants"></i></button>')
            .append('<button class="btn btn-small compact-button" style="color:red" type="button" onclick=\'_copyObjectAsJSON(false)\'><i class="fa fa-copy" title="copy json node without decendants" ></i></button>');
    }

    function copyObjectAsJSON(withDescendants = true){
        const dnInput = document.querySelector("#main-view wf-panel.info-model-parameters.view-panel wf-panel-section div.parameters-panel-toolbar > dist-name-input input");
        dnInput.focus();
        const distName = dnInput.value;
        if(!distName){
            alert('Please select a MO firstly');
            return;
        }
        _myService('updateService').getImTree().then(tree => {
            const node = tree.findByDistName(distName);
            const json = node2Json({node, withDescendants});
            navigator.clipboard.writeText(JSON.stringify(json));
            alert(`object ${distName} copied`)
            console.log(json);
        })

        function node2Json({
            node,
            json = {},
            withDescendants = true,
            withAncestorPath = true,
            path = ''
        }) {
            if (!path) {
                path = withAncestorPath ? node.distName.replace(/\//g, '.').substr(1) : node.name;
            } else {
                path = `${path}.${node.name}`;
            }
            _myService('_').set(json, `${path}.parameters`, node.parameters);

            if (withDescendants) {
                node.getChildren().forEach(child => {
                    node2Json({node: child, json, withDescendants, withAncestorPath: true, path});
                });
            }
            return json;
        }
    }

    function loginOffline() {
        _myService('imAuth').loginOfflineUser({
            profile: 'readonly',
            userName: 'readonly',
            failedLoginNo: 0,
            lastSuccess: '3 days ago'
        });
        _myService('$location').path('/developer/tree')
        _myService('$rootScope').$digest()
    }

    angular.element(document.body).injector().get('$timeout')(function()  {
        if (isInLoginPage()) {
            console.log('is in login page, add buttons')
            $('div.input-password:eq(0)').next().prepend(htmlButtons);
        }
        if(window.location.hash === "#/developer/tree")
            addCopyObjectButton();
    }, 0)


    function isInLoginPage() {
        return location.href.indexOf('#/login') > 0;
    }

    function isADMIN() {
        if(!window.jQuery) return false;

        return window.jQuery('#loading-progress-bar').length > 0 || window.jQuery('header > title').text() === 'WebEM';
    }
})();
