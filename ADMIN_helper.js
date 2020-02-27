// ==UserScript==
// @name         ADMIN scripts
// @namespace    http://tampermonkey.net/
// @version      0.1.2
// @description  try to take over the world!
// @author       You
// @include https://10.**
// @include https://onion.wroclaw.nsn-rdnet.net/*
// @include http://localhost:*/*
// @include http://*:*/ADMIN.html*

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
    }, 0)


    function isInLoginPage() {
        return location.href.indexOf('#/login') > 0;
    }

    function isADMIN() {
        if(!window.jQuery) return false;

        return window.jQuery('#loading-progress-bar').length > 0 || window.jQuery('header > title').text() === 'WebEM';
    }
})();
