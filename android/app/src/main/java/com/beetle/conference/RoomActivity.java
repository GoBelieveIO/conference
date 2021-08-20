package com.beetle.conference;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import android.app.Activity;
import android.app.Application;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Log;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.RelativeLayout;

import com.facebook.react.PackageList;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactNativeHost;
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
import com.oney.WebRTCModule.EglUtils;
import com.oney.WebRTCModule.WebRTCModule;

import org.webrtc.Camera1Enumerator;
import org.webrtc.Camera2Enumerator;
import org.webrtc.CameraEnumerator;
import org.webrtc.CameraVideoCapturer;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
import org.webrtc.IceCandidate;
import org.webrtc.MediaStream;
import org.webrtc.MediaStreamTrack;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.SessionDescription;
import org.webrtc.SoftwareVideoDecoderFactory;
import org.webrtc.SoftwareVideoEncoderFactory;
import org.webrtc.SurfaceViewRenderer;
import org.webrtc.VideoCapturer;
import org.webrtc.VideoDecoderFactory;
import org.webrtc.VideoEncoderFactory;
import org.webrtc.VideoTrack;
import org.webrtc.audio.AudioDeviceModule;
import org.webrtc.audio.JavaAudioDeviceModule;
import org.webrtc.voiceengine.WebRtcAudioManager;
import org.webrtc.voiceengine.WebRtcAudioUtils;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


class Participant {
    public String id;
    public String displayName;
    public Map<String, Consumer> consumers;
    public SurfaceViewRenderer render;
}

class ReactNativeHostImpl extends ReactNativeHost {

    public ReactNativeHostImpl(Application app) {
        super(app);
    }

    @Override
    public boolean getUseDeveloperSupport() {
        return BuildConfig.DEBUG;
    }

    @Override
    protected List<ReactPackage> getPackages() {
        List<ReactPackage> packages = new PackageList(this).getPackages();
        packages.add(new RoomPackage());
        return packages;
    }
}
public class RoomActivity extends Activity implements RoomModuleObserver {
    private static final String TAG = "face";

    private EglBase rootEglBase;
    private long currentUID;
    private String channelID;
    private String token;

    boolean cameraOn = true;
    boolean microphoneOn = true;

    ReactNativeHostImpl host;
    ReactInstanceManager mReactInstanceManager;

    SurfaceViewRenderer localRenderer;

    Map<String, Producer> producers = new HashMap<>();
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

        setContentView(R.layout.activity_room);

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
        rootEglBase = EglUtils.getRootEglBase();//EglBase.create();

        createLocalParticipant();

        host = new ReactNativeHostImpl(getApplication());
        mReactInstanceManager = host.getReactInstanceManager();
        mReactInstanceManager.addReactInstanceEventListener(new ReactInstanceManager.ReactInstanceEventListener() {
            @Override
            public void onReactContextInitialized(ReactContext context) {
                Log.i(TAG, "react context initialized");
                WritableMap params = Arguments.createMap();
                params.putString("roomId", channelID);
                params.putString("peerId", "" + currentUID);
                params.putString("displayName", "" + currentUID);
                sendEvent("join_room", params);
                RoomModule roomModule = mReactInstanceManager.getCurrentReactContext().getNativeModule(RoomModule.class);
                roomModule.setObserver(RoomActivity.this);
            }
        });

        mReactInstanceManager.createReactContextInBackground();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();

        for (Map.Entry<String, Producer> entry : producers.entrySet()) {
            Producer producer = entry.getValue();
            if (producer.kind.equals("video") && !TextUtils.isEmpty(producer.streamURL)) {
                stopRenderStream(producer.streamURL, localRenderer);
            }
        }
        for (int i = 0; i < peers.size(); i++) {
            for (Map.Entry<String, Consumer> entry : peers.get(i).consumers.entrySet()) {
                Consumer consumer = entry.getValue();
                if (consumer.kind.equals("video") && !TextUtils.isEmpty(consumer.streamURL)) {
                    stopRenderStream(consumer.streamURL, peers.get(i).render);
                }
            }
        }

        localRenderer.release();
        for (int i = 0; i < peers.size(); i++) {
            peers.get(i).render.release();
        }

        RoomModule roomModule = mReactInstanceManager.getCurrentReactContext().getNativeModule(RoomModule.class);
        roomModule.setObserver(null);
        WritableMap params = Arguments.createMap();
        params.putString("roomId", channelID);
        sendEvent("leave_room", params);
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
            for (Map.Entry<String, Producer> entry : producers.entrySet()) {
                Producer producer = entry.getValue();
                if (producer.kind.equals("video") && !TextUtils.isEmpty(producer.streamURL)) {
                    stopRenderStream(producer.streamURL, localRenderer);
                }
            }
            for (int i = 0; i < peers.size(); i++) {
                for (Map.Entry<String, Consumer> entry : peers.get(i).consumers.entrySet()) {
                    Consumer consumer = entry.getValue();
                    if (consumer.kind.equals("video") && !TextUtils.isEmpty(consumer.streamURL)) {
                        stopRenderStream(consumer.streamURL, peers.get(i).render);
                    }
                }
            }

            for (int i = 0; i < peers.size(); i++) {
                RelativeLayout ll = (RelativeLayout) findViewById(R.id.relativeLayout);
                ll.removeView(peers.get(i).render);
                peers.get(i).render.release();
            }
            peers.clear();
            producers.clear();
        }
    }

    @Override
    public void onNewPeer(String peerId, String displayName) {
        Log.i(TAG, "on new peer:" + peerId);
        Participant p = new Participant();
        p.id = peerId;
        p.displayName = displayName;
        p.consumers = new HashMap<>();
        this.peers.add(p);
        int index = peers.size();
        localRenderer.post(new Runnable() {
            @Override
            public void run() {
                RoomActivity.this.createRemoteParticipant(p, index);
            }
        });
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

        RelativeLayout ll = (RelativeLayout) findViewById(R.id.relativeLayout);
        ll.removeView(peer.render);

        Display display = getWindowManager().getDefaultDisplay();
        Point size = new Point();
        display.getSize(size);
        int w = size.x/2;
        int h = w;

        for (int i = index; i < peers.size(); i++) {
            int x = w*((i+1)%2);
            int y = h*((i+1)/2);

            RelativeLayout.LayoutParams lp = new RelativeLayout.LayoutParams(w, h);
            lp.leftMargin = x;
            lp.topMargin = y;
            peer.render.setLayoutParams(lp);
        }
    }

    @Override
    public void onAddProducer(Producer producer) {
        Log.i(TAG, "on add producer:" + producer.id);
        this.producers.put(producer.id, producer);
        if (producer.kind.equals("video")) {
            startRenderStream(producer.streamURL, localRenderer);
            localRenderer.setMirror(producer.type.equals("front"));
        }
    }

    @Override
    public void onRemoveProducer(String producerId) {
        Log.i(TAG, "on remove producer:" + producerId);
        if (producers.containsKey(producerId)) {
            Producer producer = producers.get(producerId);
            producers.remove(producerId);
            if (producer.kind.equals("video")) {
                stopRenderStream(producer.streamURL, localRenderer);
            }
        }
    }

    @Override
    public void onAddConsumer(Consumer consumer, String peerId) {
        int index = -1;
        for (int i = 0; i < peers.size(); i++) {
            if (peers.get(i).id.equals(peerId)) {
                index = i;
                break;
            }
        }
        if (index == -1) {
            return;
        }

        Participant peer = peers.get(index);
        peer.consumers.put(consumer.id, consumer);
        if (consumer.kind.equals("video")) {
            startRenderStream(consumer.streamURL, peer.render);
        }
    }

    @Override
    public void onConsumerClosed(String consumerId, String peerId) {
        int index = -1;
        for (int i = 0; i < peers.size(); i++) {
            if (peers.get(i).id.equals(peerId)) {
                index = i;
                break;
            }
        }
        if (index == -1) {
            return;
        }

        Participant peer = peers.get(index);

        if (peer.consumers.containsKey(consumerId)) {
            Log.i(TAG, "remove consumer:" + consumerId);
            Consumer consumer = peer.consumers.get(consumerId);
            if (consumer.kind.equals("video")) {
                stopRenderStream(consumer.streamURL, peer.render);
            }
            peer.consumers.remove(consumerId);
        }
    }

    @Override
    public void onConsumerPaused(String consumerId, String peerId, String originator) {

    }

    public void onConsumerResumed(String consumerId, String peerId, String originator) {

    }


    void stopRenderStream(String streamURL, SurfaceViewRenderer render) {
        VideoTrack videoTrack = getVideoTrack(streamURL);
        if (videoTrack != null) {
            videoTrack.removeSink(render);
        }
    }

    void startRenderStream(String streamURL, SurfaceViewRenderer render) {
        VideoTrack videoTrack = getVideoTrack(streamURL);
        if (videoTrack != null) {
            videoTrack.addSink(render);
        }
    }

    VideoTrack getVideoTrack(String streamURL) {
        WebRTCModule module = mReactInstanceManager.getCurrentReactContext().getNativeModule(WebRTCModule.class);

        try {
            Method method = WebRTCModule.class.getDeclaredMethod("getStreamForReactTag", new Class[]{String.class});
            method.setAccessible(true);

            MediaStream stream = (MediaStream) method.invoke(module, streamURL);

            List<VideoTrack> videoTracks = stream.videoTracks;

            if (!videoTracks.isEmpty()) {
                VideoTrack videoTrack = videoTracks.get(0);
                return videoTrack;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    void createLocalParticipant() {

        Display display = getWindowManager().getDefaultDisplay();
        Point size = new Point();
        display.getSize(size);
        int w = size.x/2;
        int h = w;
        int x = w*(peers.size()%2);
        int y = h*(peers.size()/2);

        SurfaceViewRenderer render = new org.webrtc.SurfaceViewRenderer(this);
        render.init(rootEglBase.getEglBaseContext(), null);
        render.setZOrderMediaOverlay(true);
        render.setMirror(true);//default front camera
        render.getHolder().setFormat(PixelFormat.TRANSPARENT);

        RelativeLayout ll = (RelativeLayout) findViewById(R.id.relativeLayout);
        RelativeLayout.LayoutParams lp = new RelativeLayout.LayoutParams(w, h);
        lp.leftMargin = x;
        lp.topMargin = y;
        render.setLayoutParams(lp);
        ll.addView(render);

        View.OnClickListener listener = new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                switchCamera(view);
            }
        };

        render.setOnClickListener(listener);
        localRenderer = render;
    }

    void createRemoteParticipant(Participant p, int index) {
        Display display = getWindowManager().getDefaultDisplay();
        Point size = new Point();
        display.getSize(size);
        int w = size.x/2;
        int h = w;
        int x = w*(index%2);
        int y = h*(index/2);

        SurfaceViewRenderer render = new org.webrtc.SurfaceViewRenderer(this);
        render.init(rootEglBase.getEglBaseContext(), null);

        RelativeLayout ll = (RelativeLayout) findViewById(R.id.relativeLayout);
        RelativeLayout.LayoutParams lp = new RelativeLayout.LayoutParams(w, h);
        lp.leftMargin = x;
        lp.topMargin = y;
        render.setLayoutParams(lp);
        ll.addView(render);
        p.render = render;
    }

    public void switchCamera(View view) {
        Producer producer = null;
        for(Producer p : producers.values()) {
            if (p.kind.equals("video")) {
                producer = p;
                break;
            }
        }

        if (producer == null) {
            return;
        }

        if (producer.type.equals("front")) {
            producer.type = "back";
        } else {
            producer.type = "front";
        }
        localRenderer.setMirror(producer.type.equals("front"));
        WritableMap params = Arguments.createMap();
        sendEvent("switch_camera", params);
    }
    public void onHangup(View view) {
        Log.i(TAG, "hangup");
        this.finish();
    }

    public void toggleCamera(View v) {
        cameraOn = !cameraOn;
        WritableMap params = Arguments.createMap();
        params.putBoolean("videoMuted", !cameraOn);
        sendEvent("toggle_video", params);

        ImageButton cameraButton = (ImageButton)findViewById(R.id.camera);
        if (cameraOn) {
            cameraButton.setBackgroundColor(Color.TRANSPARENT);
        } else {
            cameraButton.setBackgroundColor(Color.WHITE);
        }
    }

    public void toggleMic(View view) {
        microphoneOn = !microphoneOn;
        WritableMap params = Arguments.createMap();
        params.putBoolean("audioMuted", !microphoneOn);
        sendEvent("toggle_audio", params);

        ImageButton muteButton = (ImageButton)findViewById(R.id.mute);
        if (microphoneOn) {
            muteButton.setBackgroundColor(Color.TRANSPARENT);
        } else {
            muteButton.setBackgroundColor(Color.WHITE);
        }
    }

}