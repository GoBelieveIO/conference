package com.beetle.conference;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

class Producer {
    public String id;
    public String streamURL;
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
    public String streamURL;

    public String kind;
    //'simple' | 'simulcast' | 'svc' | 'pipe';
    public String type;
}

interface RoomModuleObserver {
    void onRoomState(String state);
    void onNewPeer(String peerId, String displayName);
    void onPeerClosed(String peerId);
    void onAddProducer(Producer producer);
    void onRemoveProducer(String producerId);
    void onAddConsumer(Consumer consumer, String peerId);
    void onConsumerClosed(String consumerId, String peerId);
    void onConsumerPaused(String consumerId, String peerId, String originator);
    void onConsumerResumed(String consumerId, String peerId, String originator);
}

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
