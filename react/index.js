import { AppRegistry } from 'react-native';
//import GroupCall from './GroupCall.js';
import Room from './Room.js';
import RCTDeviceEventEmitter from 'RCTDeviceEventEmitter'

//AppRegistry.registerComponent('GroupCall', () => GroupCall);

var app = {
    room:undefined,

    startApp: function() {
        console.log("start app...");
        
        var self = this;
        
        RCTDeviceEventEmitter.addListener('enter_room', function(event) {
            console.log("group call event:", event);
            if (self.room && !self.room.finished) {
                console.log("must stop last room:", self.room);
                return;
            }
            
            var name = "" + event.uid;
            var room = event.channelID;
            var token = event.token;


            self.room = new Room(name, room, token)
            self.room.start();
        });


        RCTDeviceEventEmitter.addListener('leave_room', function(event) {
            console.log("group call event:", event);
            var room = event.channelID;
            if (!self.room || self.room.room != room) {
                console.log("can't leave room:", room, " current room:", self.room ? self.room.room : undefined);
                return;
            }

            self.room.stop();
        });


        RCTDeviceEventEmitter.addListener('send_room_message', function(event) {
            console.log("send room message event:", event);
            var room = event.channelID;
            if (!self.room || self.room.room != room) {
                console.log("can't send room message:", event);
                return;
            }
            
            self.room.sendRoomMessage(event.message);
        });

    }

}

app.startApp();
