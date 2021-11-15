package com.beetle.conference;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.media.AudioManager;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.Display;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.RelativeLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.oney.WebRTCModule.EglUtils;
import com.oney.WebRTCModule.WebRTCModule;

import org.webrtc.EglBase;
import org.webrtc.MediaStream;
import org.webrtc.SurfaceViewRenderer;
import org.webrtc.VideoTrack;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class InterphoneActivity extends Activity implements RoomModuleObserver {
    private static final String TAG = "face";

    static class Participant {
        public String id;
        public String displayName;
    }


    private long currentUID;
    private String channelID;
    private String token;


    boolean microphoneOn = true;

    ReactNativeHostImpl host;
    ReactInstanceManager mReactInstanceManager;


    View pttView;
    RoomModule roomModule;

    Map<String, Producer> producers = new HashMap<>();
    Map<String, Consumer> consumers = new HashMap<>();
    List<Participant> peers = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        getWindow().addFlags( WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_interphone);

        Intent intent = getIntent();

        currentUID = intent.getLongExtra("current_uid", 0);
        if (currentUID == 0) {
            Log.i(TAG, "current uid is 0");
            finish();
            return;
        }
        channelID = intent.getStringExtra("channel_id");
        if (TextUtils.isEmpty(channelID)) {
            Log.i(TAG, "channel id is empty");
            finish();
            return;
        }
        Log.i(TAG, "channel id:" + channelID);

        token = intent.getStringExtra("token");
        if (TextUtils.isEmpty(token)) {
            Log.i(TAG, "token is empty");
            finish();
            return;
        }

        try {
            AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
            am.setSpeakerphoneOn(true);
            am.setMode(AudioManager.MODE_IN_COMMUNICATION);
        } catch (Exception e) {
            e.printStackTrace();
        }

        host = new ReactNativeHostImpl(getApplication());
        mReactInstanceManager = host.getReactInstanceManager();
        mReactInstanceManager.addReactInstanceEventListener(new ReactInstanceManager.ReactInstanceEventListener() {
            @Override
            public void onReactContextInitialized(ReactContext context) {
                Log.i(TAG, "react context initialized");
                RoomModule roomModule = mReactInstanceManager.getCurrentReactContext().getNativeModule(RoomModule.class);
                roomModule.setObserver(InterphoneActivity.this);
                roomModule.joinRoom(channelID, getPeerId(), token, getPeerId(), false, microphoneOn, RoomModule.INTERPHONE_MODE);
                InterphoneActivity.this.roomModule = roomModule;
            }
        });

        mReactInstanceManager.createReactContextInBackground();

        pttView = findViewById(R.id.ptt);
        pttView.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        if (roomModule != null) {
                            roomModule.acquireMic();
                        }
                        Toast.makeText(InterphoneActivity.this, "开始讲话", Toast.LENGTH_SHORT).show();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (roomModule != null) {
                            roomModule.releaseMic();
                        }
                        Toast.makeText(InterphoneActivity.this, "停止讲话", Toast.LENGTH_SHORT).show();
                        return true;
                    default:
                        return false;
                }
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();

        RoomModule roomModule = mReactInstanceManager.getCurrentReactContext().getNativeModule(RoomModule.class);
        roomModule.setObserver(null);
        roomModule.leaveRoom(channelID);
    }

    @Override
    public void onBackPressed() {
        //禁止通过返回按键退出界面
        //super.onBackPressed();
    }

    void sendEvent(String eventName, @Nullable WritableMap params) {
        mReactInstanceManager.getCurrentReactContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
    }

    @Override
    public void onRoomState(String state) {
        Log.i(TAG, "on room state:" + state);
        if (state.equals("closed")) {
            peers.clear();
            producers.clear();
        }
    }

    @Override
    public void onNewPeer(String peerId, String displayName, boolean present, boolean cameraExists) {
        Log.i(TAG, "on new peer:" + peerId);
        Participant p = new Participant();
        p.id = peerId;
        p.displayName = displayName;
        this.peers.add(p);
    }

    @Override
    public void onPeerClosed(String peerId) {
        Log.i(TAG, "on peer closed:" + peerId);
        int index = -1;
        for (int i = 0; i < peers.size(); i++) {
            if (peers.get(i).id.equals(peerId)) {
                index = i;
                break;
            }
        }
        Participant peer = peers.get(index);
        peers.remove(index);
    }

    @Override
    public void onNewPeerMessage(String peerId, String id, ReadableMap map) {

    }

    @Override
    public void onNewMember(String peerId) {

    }
    @Override
    public void onMemberLeft(String peerId) {

    }

    @Override
    public void onNewProducer(Producer producer) {
        Log.i(TAG, "on add producer:" + producer.id);
        this.producers.put(producer.id, producer);
        if (producer.kind.equals("audio")) {
            roomModule.muteMic(false);
        }
    }

    @Override
    public void onProducerWillClose(String producerId) {

    }

    @Override
    public void onProducerClosed(String producerId) {
        Log.i(TAG, "on remove producer:" + producerId);
        if (producers.containsKey(producerId)) {
            Producer producer = producers.get(producerId);
            producers.remove(producerId);
        }
    }


    String getPeerId() {
        return "" + currentUID;
    }

    @Override
    public void onNewConsumer(Consumer consumer, String peerId) {
        if (peerId.equals(getPeerId())) {
            consumers.put(consumer.id, consumer);

        }
    }

    @Override
    public void onConsumerWillClose(String consumerId, String peerId) {

    }
    @Override
    public void onConsumerClosed(String consumerId, String peerId) {
        if (peerId.equals(getPeerId())) {
            if (consumers.containsKey(consumerId)) {
                consumers.remove(consumerId);
            }
        }
    }

    @Override
    public void onConsumerPaused(String consumerId, String peerId, String originator) {

    }

    public void onConsumerResumed(String consumerId, String peerId, String originator) {

    }

    public void onHangup(View view) {
        Log.i(TAG, "hangup");
        roomModule.leaveRoom(channelID);

        //等待leave命令发送完成
        pttView.postDelayed(new Runnable() {
            @Override
            public void run() {
                finish();
            }
        }, 500);
    }
}