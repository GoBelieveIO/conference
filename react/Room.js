
import React, { Component } from 'react';

import {
    Platform,    
    NativeModules,
    NativeAppEventEmitter,
    BackHandler,    
} from 'react-native';

//强制执行BackHandler全局代码,原生的invokeDefaultOnBackPressed才会生效
BackHandler.addEventListener

var ConferenceModule = (Platform.OS == 'android') ?
             NativeModules.GroupVOIPActivity :
             NativeModules.GroupVOIPViewController;


const WS_URL = 'wss://jitsi.gobelieve.io/groupcall';


class Room {
    constructor(name, room, token) {
        this.onmessage = this.onmessage.bind(this);
        this.ping = this.ping.bind(this);

        this.name = name;
        this.room = room;
        this.token = token ? token : "";

        this.duration = 0;
        this.connectFailCount = 0;
        this.closeTimestamp = 0;


    }


    onmessage(message) {
        var parsedMessage = JSON.parse(message.data);
        console.info('Received message: ' + message.data);
        ConferenceModule.onMessage(parsedMessage, this.room);
    }
    
    stop() {
        console.log("hangup...");
        if (this.finished) {
            return;
        }
        this.finished = true;
        this.leaveRoom();
    }

    start() {
        console.log("start room...");
        this.pingTimer = setInterval(this.ping, 1000);
        this.connect();
    }
    
    connect() {
        var ws = new WebSocket(WS_URL);
        var self = this;
        this.ws = ws;                   
        this.ws.onmessage = this.onmessage;
        this.ws.onclose = function(e) {
            console.log("websockets on close:", e.code, e.reason, e.wasClean);
            self.connectFailCount += 1;
            var now = new Date().getTime()
            self.closeTimestamp = Math.floor(now/1000);
            if (!self.finished) {
                ConferenceModule.onClose(self.room);
            }
            //在ping的timer中会自动重连
        }
        
        this.ws.onerror = function() {
            console.log("websockets on error");
        }
        
        this.ws.onopen = function() {
            console.log("websockets on open");
            this.connectFailCount = 0;
            self.register();
        };        
    }
    
    register() {
        var message = {
	    id : 'joinRoom',
	    name : this.name,
	    room : this.room,
            token: this.token
        }
        this.sendMessage(message);
    }

    sendRoomMessage(message) {
        this.sendMessage(message);
    }
    
    ping() {
        //更新通话时间
        var duration = this.duration;
        duration += 1;
        this.duration = duration;

        //检查链接是否断开
        if (!this.ws || this.ws.readyState == WebSocket.CLOSED) {
            var now = new Date().getTime();
            now = Math.floor(now/1000);

            //失败次数越多，重连间隔的时间越长
            if (now - this.closeTimestamp > this.connectFailCount ||
                now - this.closeTimestamp > 60) {
                this.connect();                
            }
            return;
        }

        if (duration%10 == 0) {
            //10s发一次ping
            var message = {
	        id : 'ping'
            }
            this.sendMessage(message);              
        }
    }


    leaveRoom() {
        console.log("leave room");
        this.sendMessage({
	    id : 'leaveRoom'
        });

     
        if (this.ws) {
            this.ws.close();
        }
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = 0;
        }
    }



    sendMessage(message) {
        if (!this.ws || this.ws.readyState != WebSocket.OPEN) {
            return;
        }
        
        var jsonMessage = JSON.stringify(message);
        console.log('Sending message: ' + jsonMessage);
        this.ws.send(jsonMessage);
    }
}


export default Room;

