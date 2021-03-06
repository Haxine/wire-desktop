/*
 * Wire
 * Copyright (C) 2016 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

'use strict';

const {ipcRenderer, webFrame, desktopCapturer} = require('electron');
const pkg = require('./../package.json');

webFrame.setZoomLevelLimits(1, 1);
webFrame.registerURLSchemeAsBypassingCSP('file');

// https://github.com/electron/electron/issues/2984
const _setImmediate = setImmediate;
process.once('loaded', function() {
  global.setImmediate = _setImmediate;
  global.openGraph = require('./lib/openGraph');
  global.desktopCapturer = desktopCapturer;
});

///////////////////////////////////////////////////////////////////////////////
// Addressbook
///////////////////////////////////////////////////////////////////////////////
let cachedAddressBook;

function getAdressBook () {
  if (cachedAddressBook == undefined) {
    cachedAddressBook = require('node-addressbook');
  }
  return cachedAddressBook;
}

if (process.platform === 'darwin') {
  Object.defineProperty(window, 'zAddressBook', {get: getAdressBook});
}

///////////////////////////////////////////////////////////////////////////////
// App Start
///////////////////////////////////////////////////////////////////////////////
function loadWebapp() {
  ipcRenderer.send('load-webapp', navigator.onLine);
}

ipcRenderer.once('splash-screen-loaded', function() {
  if (navigator.onLine) {
    loadWebapp(navigator.onLine);
  } else {
    const offline = document.getElementById('offline');
    const loading = document.getElementById('loading');
    loading.style.display = 'none';
    offline.style.display = 'block';
    window.addEventListener('online', loadWebapp);
  }
});

// app.wire.com was loaded
ipcRenderer.once('webapp-loaded', function(sender, config) {
  window.electron_version = config.electron_version;
  window.notification_icon = config.notification_icon;
  window.winston = require('winston');

  winston
    .add(winston.transports.File, {
      filename: config.logging_file,
      handleExceptions: true,
    })
    .remove(winston.transports.Console)
    .info(pkg.productName, 'Version', pkg.version);

  require('./menu/context');

  // loading webapp failed
  if (window.wire == undefined) {
    return setInterval(function () {
      if (navigator.onLine) {
        location.reload();
      }
    }, 1000);
  }

  if (process.platform === 'darwin') {
    // add titlebar ghost to prevent interactions with the content while dragging
    const titleBar = document.createElement('div');
    titleBar.className = 'drag-region';
    document.body.appendChild(titleBar);
  }

  // we are on app.wire.com/
  if (wire.app) {
    // hijack google authenticate method
    wire.app.service.connect_google._authenticate = function() {
      return new Promise(function(resolve, reject) {
        ipcRenderer.send('google-auth-request');
        ipcRenderer.once('google-auth-success', function(event, token) {
          resolve(token);
        });
        ipcRenderer.once('google-auth-error', function(error) {
          reject(error);
        });
      });
    };

    amplify.subscribe(z.event.WebApp.SYSTEM_NOTIFICATION.CLICK, function() {
      ipcRenderer.send('notification-click');
    });

    amplify.subscribe(z.event.WebApp.LOADED, function() {
      ipcRenderer.send('loaded');
    });
  }
  // else we are on /auth
});

///////////////////////////////////////////////////////////////////////////////
// Webapp Events
///////////////////////////////////////////////////////////////////////////////
ipcRenderer.on('sign-out', function() {
  amplify.publish(z.event.WebApp.LOGOUT.ASK_TO_CLEAR_DATA);
});

ipcRenderer.on('preferences-show', function() {
  amplify.publish(z.event.WebApp.PREFERENCES.MANAGE_ACCOUNT);
});

ipcRenderer.on('conversation-start', function() {
  amplify.publish(z.event.WebApp.SHORTCUT.START);
});

ipcRenderer.on('conversation-ping', function() {
  amplify.publish(z.event.WebApp.SHORTCUT.PING);
});

ipcRenderer.on('conversation-call', function() {
  wire.app.view.content.conversation_titlebar.click_on_call_button();
});

ipcRenderer.on('conversation-video-call', function() {
  wire.app.view.content.conversation_titlebar.click_on_video_button();
});

ipcRenderer.on('conversation-people', function() {
  amplify.publish(z.event.WebApp.SHORTCUT.PEOPLE);
});

ipcRenderer.on('conversation-add-people', function() {
  amplify.publish(z.event.WebApp.SHORTCUT.ADD_PEOPLE);
});

ipcRenderer.on('conversation-archive', function() {
  amplify.publish(z.event.WebApp.SHORTCUT.ARCHIVE);
});

ipcRenderer.on('conversation-silence', function() {
  amplify.publish(z.event.WebApp.SHORTCUT.SILENCE);
});

ipcRenderer.on('conversation-delete', function() {
  wire.app.view.conversation_list.click_on_clear_action();
});

ipcRenderer.on('conversation-prev', function() {
  amplify.publish(z.event.WebApp.SHORTCUT.PREV);
});

ipcRenderer.on('conversation-next', function() {
  amplify.publish(z.event.WebApp.SHORTCUT.NEXT);
});

ipcRenderer.on('conversation-show', function(conversation_id) {
  amplify.publish(z.event.WebApp.CONVERSATION.SHOW, conversation_id);
});
