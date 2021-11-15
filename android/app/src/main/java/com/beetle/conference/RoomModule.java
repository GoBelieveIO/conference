package com.beetle.conference;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

class Producer {
    public String id;
    //public String streamURL;
    public String trackId;
    public String kind;

    //webcam device
    public String deviceLabel;
    //webcam front|back
    public String type;
    public String codec;
    public String rtpParameters;
}

class Consumer {
    public String id;
    //public String streamURL;
    public String trackId;

    public String kind;
    //'simple' | 'simulcast' | 'svc' | 'pipe';
    public String type;
}

interface RoomModuleObserver {
    void onRoomState(String state);
    void onNewPeer(String peerId, String displayName, boolean present, boolean cameraExists);
    void onPeerClosed(String peerId);
    void onNewPeerMessage(String peerId, String id, ReadableMap map);
    void onNewMember(String peerId);
    void onMemberLeft(String peerId);
    void onNewProducer(Producer producer);
    void onProducerWillClose(String producerId);
    void onProducerClosed(String producerId);
    void onNewConsumer(Consumer consumer, String peerId);
    void onConsumerWillClose(String consumerId, String peerId);
    void onConsumerClosed(String consumerId, String peerId);
    void onConsumerPaused(String consumerId, String peerId, String originator);
    void onConsumerResumed(String consumerId, String peerId, String originator);
}
/*
@ReactModule(name="RoomModule")
public class RoomModule extends ReactContextBaseJavaModule {
    static final String TAG = "RoomModule";

    private Handler handler;
    private RoomModuleObserver observer;
    public RoomModule(ReactApplicationContext reactContext) {
        super(reactContext);
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public String getName() {
        return "RoomModule";
    }

    void setObserver(RoomModuleObserver ob) {
        this.observer = ob;
    }

    @ReactMethod
    public void postRoomState(String state) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onRoomState(state);
                }
            }
        });

    }

    @ReactMethod
    public void postNewPeer(ReadableMap peer) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                String peerId = peer.getString("id");
                String displayName = peer.getString("displayName");
                if (observer != null) {
                    observer.onNewPeer(peerId, displayName);
                }
            }
        });

    }

    @ReactMethod
    public void postPeerClosed(String peerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onPeerClosed(peerId);
                }
            }
        });
    }

    @ReactMethod
    public void postAddProducer(ReadableMap map) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                Producer producer = new Producer();
                Log.i(TAG, "post add producer:" + map.toString());
                producer.id = map.getString("id");
                producer.deviceLabel = map.getString("deviceLabel");
                producer.type = map.getString("type");
                producer.codec = map.getString("codec");
                producer.streamURL = map.getString("streamURL");
                producer.kind = map.getString("kind");
                if (observer != null) {
                    observer.onAddProducer(producer);
                }
            }
        });

    }

    @ReactMethod
    public void postRemoveProducer(String producerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onRemoveProducer(producerId);
                }
            }
        });
    }

    @ReactMethod
    public void postAddConsumer(ReadableMap map, String peerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                Consumer consumer = new Consumer();
                consumer.id = map.getString("id");
                consumer.kind = map.getString("kind");
                consumer.streamURL = map.getString("streamURL");

                if (observer != null) {
                    observer.onAddConsumer(consumer, peerId);
                }
            }
        });
    }

    @ReactMethod
    public void postConsumerClosed(String consumerId, String peerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onConsumerClosed(consumerId, peerId);
                }
            }
        });

    }

    @ReactMethod
    public void postConsumerPaused(String consumerId, String peerId, String originator) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onConsumerPaused(consumerId, peerId, originator);
                }
            }
        });
    }

    @ReactMethod
    public void postConsumerResumed(String consumerId, String peerId, String originator) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onConsumerResumed(consumerId, peerId, originator);
                }
            }
        });
    }

}


*/

@ReactModule(name="RoomModule")
public class RoomModule extends ReactContextBaseJavaModule {
    static final String TAG = "RoomModule";
    public static final String INTERPHONE_MODE = "interphone";
    public static final String GROUP_MODE = "group";


    public static final String STATE_NEW = "new";
    public static final String STATE_CONNECTING = "connecting";
    public static final String STATE_CONNECTED = "connected";
    public static final String STATE_DISCONNECTED = "disconnected";
    public static final String STATE_CLOSED = "closed";

    private Handler handler;
    private RoomModuleObserver observer;
    public RoomModule(ReactApplicationContext reactContext) {
        super(reactContext);
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public String getName() {
        return "RoomModule";
    }

    public void setObserver(RoomModuleObserver ob) {
        this.observer = ob;
    }

    public void joinRoom(String roomId, String peerId, String token, String displayName, boolean cameraOn, boolean microphoneOn, String mode) {
        WritableMap params = Arguments.createMap();
        params.putString("roomId", roomId);
        params.putString("peerId", "" + peerId);
        params.putString("token", token);
        params.putString("displayName", displayName);
        params.putBoolean("cameraOn", cameraOn);
        params.putBoolean("microphoneOn", microphoneOn);
        params.putString("mode", mode);

        this.sendEvent("join_room", params);
    }

    public void leaveRoom(String roomId) {
        WritableMap params = Arguments.createMap();
        params.putString("roomId", roomId);
        sendEvent("leave_room", params);
    }

    public void switchCamera() {
        WritableMap params = Arguments.createMap();
        sendEvent("switch_camera", params);
    }

    public void toggleCamera(boolean cameraOn) {
        WritableMap params = Arguments.createMap();
        params.putBoolean("videoMuted", !cameraOn);
        sendEvent("toggle_camera", params);
    }

    public void toggleMic(boolean microphoneOn) {
        WritableMap params = Arguments.createMap();
        params.putBoolean("audioMuted", !microphoneOn);
        sendEvent("toggle_microphone", params);
    }

    public void enableWebcam() {
        WritableMap params = Arguments.createMap();
        sendEvent("enable_webcam", params);
    }

    public void disableWebcam() {
        WritableMap params = Arguments.createMap();
        sendEvent("disable_webcam", params);
    }

    public void enableMic() {
        WritableMap params = Arguments.createMap();
        sendEvent("enable_mic", params);
    }

    public void disableMic() {
        WritableMap params = Arguments.createMap();
        sendEvent("disable_mic", params);
    }

    public void muteMic(boolean remote) {
        WritableMap params = Arguments.createMap();
        params.putBoolean("remote", remote);
        sendEvent("mute_mic", params);
    }

    public void unmuteMic(boolean remote) {
        WritableMap params = Arguments.createMap();
        params.putBoolean("remote", remote);
        sendEvent("unmute_mic", params);
    }

    public void acquireMic() {
        WritableMap params = Arguments.createMap();
        sendEvent("acquire_microphone", params);
    }

    public void releaseMic() {
        WritableMap params = Arguments.createMap();
        sendEvent("release_microphone", params);
    }

    public void sendPeerMessage(WritableMap params) {
        if (!params.hasKey("receiver") || !params.hasKey(("id"))) {
            throw new RuntimeException("no receiver||id");
        }

        sendEvent("send_peer_message", params);
    }

    public void broadcastMessage(WritableMap params) {
        if (!params.hasKey(("id"))) {
            throw new RuntimeException("no id");
        }
        sendEvent("broadcast_message", params);
    }

    public void joinConference() {
        WritableMap params = Arguments.createMap();
        sendEvent("join_conference", params);
    }

    public void leaveConference() {
        WritableMap params = Arguments.createMap();
        sendEvent("leave_conference", params);
    }

    private void sendEvent(String eventName, @Nullable WritableMap params) {
        ReactContext reactContext = this.getReactApplicationContext();
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
    }


    @ReactMethod
    public void postRoomState(String state) {
        //track release
        postSync(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onRoomState(state);
                }
            }
        }, 1000);
    }

    @ReactMethod
    public void postNewPeer(ReadableMap peer) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                String peerId = peer.getString("id");
                String displayName = peer.getString("displayName");
                boolean present = peer.getBoolean("present");
                boolean cameraExists = true;
                if (peer.hasKey("device")) {
                    ReadableMap device = peer.getMap("device");
                    if (device.hasKey("camera")) {
                        cameraExists = device.getBoolean("camera");
                    }
                }
                if (observer != null) {
                    observer.onNewPeer(peerId, displayName, present, cameraExists);
                }
            }
        });
    }

    @ReactMethod
    public void postPeerClosed(String peerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onPeerClosed(peerId);
                }
            }
        });
    }

    @ReactMethod
    public void postNewPeerMessage(ReadableMap map) {
        String sender = map.getString("sender");
        String id = map.getString("id");
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onNewPeerMessage(sender, id, map);
                }
            }
        });
    }

    @ReactMethod
    public void postNewMember(String peerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onNewMember(peerId);
                }
            }
        });
    }

    @ReactMethod
    public void postMemberLeft(String peerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onMemberLeft(peerId);
                }
            }
        });
    }

    @ReactMethod
    public void postNewProducer(ReadableMap map) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                Producer producer = new Producer();
                Log.i(TAG, "post add producer:" + map.toString());
                producer.id = map.getString("id");
                producer.deviceLabel = map.getString("deviceLabel");
                producer.type = map.getString("type");
                producer.codec = map.getString("codec");
                producer.trackId = map.getString("trackId");
                producer.kind = map.getString("kind");
                if (observer != null) {
                    observer.onNewProducer(producer);
                }
            }
        });
    }

    @ReactMethod
    public void postProducerWillClose(String producerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onProducerWillClose(producerId);
                }
            }
        });
    }
    @ReactMethod
    public void postProducerClosed(String producerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onProducerClosed(producerId);
                }
            }
        });
    }

    @ReactMethod
    public void postNewConsumer(ReadableMap map, String peerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                Consumer consumer = new Consumer();
                consumer.id = map.getString("id");
                consumer.kind = map.getString("kind");
                consumer.trackId = map.getString("trackId");

                if (observer != null) {
                    observer.onNewConsumer(consumer, peerId);
                }
            }
        });
    }

    @ReactMethod
    public void postConsumerWillClose(String consumerId, String peerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onConsumerWillClose(consumerId, peerId);
                }
            }
        });
    }

    @ReactMethod
    public void postConsumerClosed(String consumerId, String peerId) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onConsumerClosed(consumerId, peerId);
                }
            }
        });
    }

    @ReactMethod
    public void postConsumerPaused(String consumerId, String peerId, String originator) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onConsumerPaused(consumerId, peerId, originator);
                }
            }
        });
    }

    @ReactMethod
    public void postConsumerResumed(String consumerId, String peerId, String originator) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (observer != null) {
                    observer.onConsumerResumed(consumerId, peerId, originator);
                }
            }
        });
    }


    public boolean postSync(Runnable r, long timeout) {
        if (Looper.myLooper() == handler.getLooper()) {
            r.run();
            return true;
        }

        BlockingRunnable br = new BlockingRunnable(r);
        return br.postAndWait(handler, timeout);
    }


    private static final class BlockingRunnable implements Runnable {
        private final Runnable mTask;
        private boolean mDone;

        public BlockingRunnable(Runnable task) {
            mTask = task;
        }

        @Override
        public void run() {
            try {
                mTask.run();
            } finally {
                synchronized (this) {
                    mDone = true;
                    notifyAll();
                }
            }
        }

        public boolean postAndWait(Handler handler, long timeout) {
            if (!handler.post(this)) {
                return false;
            }

            synchronized (this) {
                if (timeout > 0) {
                    final long expirationTime = SystemClock.uptimeMillis() + timeout;
                    while (!mDone) {
                        long delay = expirationTime - SystemClock.uptimeMillis();
                        if (delay <= 0) {
                            return false; // timeout
                        }
                        try {
                            wait(delay);
                        } catch (InterruptedException ex) {
                        }
                    }
                } else {
                    while (!mDone) {
                        try {
                            wait();
                        } catch (InterruptedException ex) {
                        }
                    }
                }
            }
            return true;
        }
    }

}


class RoomPackage implements ReactPackage {
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    @Override
    public List<NativeModule> createNativeModules(
            ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<NativeModule>();

        modules.add(new RoomModule(reactContext));

        return modules;
    }
}
