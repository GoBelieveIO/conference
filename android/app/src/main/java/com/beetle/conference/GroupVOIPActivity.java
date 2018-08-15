package com.beetle.conference;

import android.Manifest;
import android.app.Activity;
import android.app.Application;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.media.AudioManager;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.Display;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.RelativeLayout;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler;
import com.facebook.react.modules.core.RCTNativeAppEventEmitter;
import com.facebook.react.shell.MainReactPackage;
import com.facebook.react.uimanager.ViewManager;
import org.webrtc.Camera1Enumerator;
import org.webrtc.Camera2Enumerator;
import org.webrtc.CameraEnumerator;
import org.webrtc.CameraVideoCapturer;
import org.webrtc.EglBase;
import org.webrtc.IceCandidate;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.SessionDescription;
import org.webrtc.SurfaceViewRenderer;
import org.webrtc.VideoCapturer;
import org.webrtc.voiceengine.WebRtcAudioManager;
import org.webrtc.voiceengine.WebRtcAudioUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;


public class GroupVOIPActivity extends Activity implements DefaultHardwareBackBtnHandler, Participant.ParticipantObserver, ReactInstanceManager.ReactInstanceEventListener {
    private static final String TAG = "face";
    private static final int PERMISSIONS_REQUEST = 3;

    public static long activityCount = 0;
    PeerConnectionFactory factory;
    private EglBase rootEglBase;



    private  ScheduledExecutorService executor;
    ArrayList<Participant> participants = new ArrayList<>();

    private ReactInstanceManager mReactInstanceManager;
    private MusicIntentReceiver headsetReceiver;

    private long currentUID;
    private String channelID;
    private String token;


    ReactNativeHost host;

    public class GroupVOIPModule extends ReactContextBaseJavaModule {
        public GroupVOIPModule(ReactApplicationContext reactContext) {
            super(reactContext);
        }

        @Override
        public String getName() {
            return "GroupVOIPActivity";
        }

        @ReactMethod
        public void onMessage(final ReadableMap map, final String channelID) {
            Log.i(TAG, "on message:" + map + " channel id:" + channelID);
            getReactApplicationContext().runOnUiQueueThread(new Runnable() {
                @Override
                public void run() {
                    String id = map.getString("id");
                    if (id.equals("existingParticipants")) {
                        onExistingParticipants(map);
                    } else if (id.equals("newParticipantArrived")) {
                        onNewParticipantArrived(map);
                    } else if (id.equals("participantLeft")) {
                        onParticipantLeft(map);
                    } else if (id.equals("receiveVideoAnswer")) {
                        onReceiveVideoAnswer(map);
                    } else if (id.equals("iceCandidate")) {
                        onIceCandidate(map);
                    } else {
                        Log.i(TAG, "unrecognized message:" + map);
                    }
                }
            });
        }

        @ReactMethod
        public void onClose(final String channelID) {
            Log.i(TAG, "on room closed");

            getReactApplicationContext().runOnUiQueueThread(new Runnable() {
                @Override
                public void run() {
                    for (int i = 0; i < participants.size(); i++) {
                        Participant p = participants.get(i);
                        p.dispose();
                    }
                    participants.clear();
                    RelativeLayout ll = (RelativeLayout) findViewById(R.id.relativeLayout);
                    ll.removeAllViews();
                }
            });
        }

    }

    private  class ConferencePackage implements ReactPackage {
        @Override
        public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
            return Collections.emptyList();
        }

        @Override
        public List<NativeModule> createNativeModules(
                ReactApplicationContext reactContext) {
            List<NativeModule> modules = new ArrayList<NativeModule>();

            modules.add(new GroupVOIPModule(reactContext));

            return modules;
        }
    }

    private  class ReactNativeHostImpl extends ReactNativeHost {

        public ReactNativeHostImpl(Application app) {
            super(app);
        }

        @Override
        public boolean getUseDeveloperSupport() {
            return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
            List<ReactPackage> list = new ArrayList<>();
                list.add(new MainReactPackage());
                list.add(new ConferencePackage());
            return list;
        }
    }

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

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_conference);

        activityCount++;


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

        executor = Executors.newSingleThreadScheduledExecutor();
        rootEglBase = EglBase.create();

        headsetReceiver = new MusicIntentReceiver();


        host = new ReactNativeHostImpl(getApplication());
        mReactInstanceManager = host.getReactInstanceManager();
        mReactInstanceManager.createReactContextInBackground();
        mReactInstanceManager.addReactInstanceEventListener(this);

        AudioManager am = (AudioManager)getSystemService(AUDIO_SERVICE);
        am.setSpeakerphoneOn(true);
        am.setMode(AudioManager.MODE_IN_COMMUNICATION);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int cameraPermission = (checkSelfPermission(Manifest.permission.CAMERA));
            int recordPermission = (checkSelfPermission(Manifest.permission.RECORD_AUDIO));

            if (cameraPermission == PackageManager.PERMISSION_GRANTED &&
                    recordPermission == PackageManager.PERMISSION_GRANTED) {
                createPeerConnectionFactory(this);
            } else {
                requestPermission();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSIONS_REQUEST && permissions != null && grantResults != null) {
            for (int i = 0; i < permissions.length && i < grantResults.length; i++) {
                Log.i(TAG, "granted permission:" + permissions[i] + " " + grantResults[i]);
            }
        }

        if (requestCode == PERMISSIONS_REQUEST) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                int cameraPermission = (checkSelfPermission(Manifest.permission.CAMERA));
                int recordPermission = (checkSelfPermission(Manifest.permission.RECORD_AUDIO));

                if (cameraPermission == PackageManager.PERMISSION_GRANTED &&
                        recordPermission == PackageManager.PERMISSION_GRANTED) {
                    createPeerConnectionFactory(this);
                }
            }
        }

    }


    @Override
    public void invokeDefaultOnBackPressed() {
        Log.i(TAG, "invokeDefaultOnBackPressed...");
        hangup();
        super.onBackPressed();
    }


    @Override
    protected void onPause() {
        super.onPause();
        unregisterReceiver(headsetReceiver);
        if (mReactInstanceManager != null) {
            mReactInstanceManager.onHostPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();

        IntentFilter filter = new IntentFilter(Intent.ACTION_HEADSET_PLUG);
        registerReceiver(headsetReceiver, filter);

        if (mReactInstanceManager != null) {
            mReactInstanceManager.onHostResume(this, this);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        activityCount--;
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (mReactInstanceManager != null) {
            mReactInstanceManager.onHostDestroy(this);
            mReactInstanceManager.removeReactInstanceEventListener(this);
        }
    }


    @Override
    public void onBackPressed() {
        if (mReactInstanceManager != null) {
            mReactInstanceManager.onBackPressed();
        } else {
            super.onBackPressed();
        }
    }


    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MENU && mReactInstanceManager != null) {
            mReactInstanceManager.showDevOptionsDialog();
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }

    private void requestPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int cameraPermission = (checkSelfPermission(Manifest.permission.CAMERA));
            int recordPermission = (checkSelfPermission(Manifest.permission.RECORD_AUDIO));

            ArrayList<String> permissions = new ArrayList<String>();
            if (cameraPermission != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.CAMERA);
            }
            if (recordPermission != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.RECORD_AUDIO);
            }

            if (permissions.size() > 0) {
                String[] array = new String[permissions.size()];
                permissions.toArray(array);
                this.requestPermissions(array, PERMISSIONS_REQUEST);
            }

        }
    }

    public void mute(View v) {
        Log.i(TAG, "toogle audio");

        if (participants.size() == 0) {
            return;
        }
        Participant p = participants.get(0);
        if (p.getUid() != this.currentUID) {
            return;
        }

        boolean isEnabled= !p.audioTrack.enabled();
        executor.execute(new Runnable() {
            @Override
            public void run() {
                p.audioTrack.setEnabled(isEnabled);
            }
        });
        ImageButton muteButton = (ImageButton)findViewById(R.id.mute);
        if (isEnabled) {
            muteButton.setBackgroundResource(R.drawable.unmute);
        } else {
            muteButton.setBackgroundResource(R.drawable.mute);
        }
    }

    public void toogleCamera(View v) {
        Log.i(TAG, "toogle camera");

        if (participants.size() == 0) {
            return;
        }
        Participant p = participants.get(0);
        if (p.getUid() != this.currentUID) {
            return;
        }

        p.toogleVideo();
    }

    public void switchCamera() {

        Log.i(TAG, "switch camera");
        if (participants.size() == 0) {
            return;
        }
        Participant p = participants.get(0);
        if (p.getUid() != this.currentUID) {
            return;
        }
        executor.execute(new Runnable() {
            @Override
            public void run() {
                if (!p.videoTrack.enabled()) {
                    return;
                }
                CameraVideoCapturer cameraVideoCapturer = (CameraVideoCapturer) p.videoCapturer;
                cameraVideoCapturer.switchCamera(null);
            }
        });
    }

    public void hangup(View v) {
        Log.i(TAG, "hangup...");
        hangup();
        finish();
    }

    void hangup() {
        this.leaveRoom();
        for (int i = 0; i < participants.size(); i++) {
            Participant p = participants.get(i);
            p.dispose();
        }
        participants.clear();

        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    if (factory != null) {
                        factory.dispose();
                        factory = null;
                    }

                    if (rootEglBase != null) {
                        rootEglBase.release();
                        rootEglBase = null;
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    throw e;
                }
            }
        });
    }

    void createTestParticipant() {
        Display display = getWindowManager().getDefaultDisplay();
        Point size = new Point();
        display.getSize(size);
        int w = size.x/2;
        int h = w;
        int x = w*(participants.size()%2);
        int y = h*(participants.size()/2);

        SurfaceViewRenderer render = new org.webrtc.SurfaceViewRenderer(this);
        render.init(rootEglBase.getEglBaseContext(), null);

        RelativeLayout ll = (RelativeLayout) findViewById(R.id.relativeLayout);
        RelativeLayout.LayoutParams lp = new RelativeLayout.LayoutParams(w, h);
        lp.leftMargin = x;
        lp.topMargin = y;
        render.setLayoutParams(lp);
        render.setBackgroundColor(Color.RED);
        ll.addView(render);


        Participant p = new Participant(-1, this.channelID, "test", factory, render, this, executor);
        this.participants.add(p);
    }

    void createLocalParticipant() {

        Display display = getWindowManager().getDefaultDisplay();
        Point size = new Point();
        display.getSize(size);
        int w = size.x/2;
        int h = w;
        int x = w*(participants.size()%2);
        int y = h*(participants.size()/2);

        SurfaceViewRenderer render = new org.webrtc.SurfaceViewRenderer(this);
        render.init(rootEglBase.getEglBaseContext(), null);
        render.setZOrderMediaOverlay(true);
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
                GroupVOIPActivity.this.switchCamera();
            }
        };

        render.setOnClickListener(listener);

        VideoCapturer capturer = createVideoCapturer();

        Participant p = new Participant(this.currentUID, this.channelID, "test", factory, render, this, executor);

        p.createPeerConnection(rootEglBase.getEglBaseContext(), capturer);

        this.participants.add(p);

    }

    void createRemoteParticipant(long pid) {
        Display display = getWindowManager().getDefaultDisplay();
        Point size = new Point();
        display.getSize(size);
        int w = size.x/2;
        int h = w;
        int x = w*(participants.size()%2);
        int y = h*(participants.size()/2);

        SurfaceViewRenderer render = new org.webrtc.SurfaceViewRenderer(this);
        render.init(rootEglBase.getEglBaseContext(), null);

        RelativeLayout ll = (RelativeLayout) findViewById(R.id.relativeLayout);
        RelativeLayout.LayoutParams lp = new RelativeLayout.LayoutParams(w, h);
        lp.leftMargin = x;
        lp.topMargin = y;
        render.setLayoutParams(lp);
        ll.addView(render);


        Participant p = new Participant(pid, this.channelID, "test", factory, render, this, executor);
        p.createRemotePeerConnection(rootEglBase.getEglBaseContext());

        this.participants.add(p);
    }

    void onExistingParticipants(ReadableMap map) {
        if (this.participants.size() > 0) {
            Log.e(TAG, "participants not empty");
            return;
        }

        createLocalParticipant();

        ReadableArray data = map.getArray("data");
        for (int i = 0; i < data.size(); i++) {
            long pid = Long.parseLong(data.getString(i));
            createRemoteParticipant(pid);
        }

//        for (int i = 0; i < 10; i++) {
//            createTestParticipant();
//        }
    }

    void onReceiveVideoAnswer(ReadableMap map) {
        String name = map.getString("name");
        long uid = Long.parseLong(name);
        int index = -1;
        for (int i = 0; i < participants.size(); i++) {
            Participant p = participants.get(i);
            if (p.getUid() == uid) {
                index = i;
                break;
            }
        }

        if (index == -1) {
            return;
        }

        String sdp = map.getString("sdpAnswer");
        SessionDescription description = new SessionDescription(SessionDescription.Type.ANSWER, sdp);


        Participant p = participants.get(index);
        p.setRemoteDescription(description);
    }

    void onNewParticipantArrived(ReadableMap map) {
        String name = map.getString("name");
        long uid = Long.parseLong(name);
        int index = -1;
        for (int i = 0; i < participants.size(); i++) {
            Participant p = participants.get(i);
            if (p.getUid() == uid) {
                index = i;
                break;
            }
        }

        if (index != -1) {
            return;
        }
        createRemoteParticipant(uid);
    }

    void onParticipantLeft(ReadableMap map) {
        String name = map.getString("name");
        long uid = Long.parseLong(name);
        int index = -1;
        for (int i = 0; i < participants.size(); i++) {
            Participant p = participants.get(i);
            if (p.getUid() == uid) {
                index = i;
                break;
            }
        }

        if (index == -1) {
            return;
        }
        Participant p = participants.get(index);
        p.dispose();
        participants.remove(index);

        RelativeLayout ll = (RelativeLayout) findViewById(R.id.relativeLayout);
        ll.removeView(p.videoRender);

        Display display = getWindowManager().getDefaultDisplay();
        Point size = new Point();
        display.getSize(size);
        int w = size.x/2;
        int h = w;

        for (int i = index; i < participants.size(); i++) {
            int x = w*(i%2);
            int y = h*(i/2);

            RelativeLayout.LayoutParams lp = new RelativeLayout.LayoutParams(w, h);
            lp.leftMargin = x;
            lp.topMargin = y;
            p.videoRender.setLayoutParams(lp);
        }
    }

    void onIceCandidate(ReadableMap map) {
        ReadableMap mm = map.getMap("candidate");
        String sdpMid = mm.getString("sdpMid");
        String sdp = mm.getString("candidate");
        int sdpMLineIndex = mm.getInt("sdpMLineIndex");
        String name = map.getString("name");
        long uid = Long.parseLong(name);

        int index = -1;
        for (int i = 0; i < participants.size(); i++) {
            Participant p = participants.get(i);
            if (p.getUid() == uid) {
                index = i;
                break;
            }
        }

        if (index == -1) {
            return;
        }

        IceCandidate candidate = new IceCandidate(sdpMid, sdpMLineIndex, sdp);
        Participant p = participants.get(index);
        p.addRemoteIceCandidate(candidate);
    }

    void enterRoom() {
        WritableMap map = Arguments.createMap();

        map.putString("channelID", this.channelID);
        map.putDouble("uid", this.currentUID);
        map.putString("token", this.token);

        ReactContext reactContext = mReactInstanceManager.getCurrentReactContext();
        this.sendEvent(reactContext, "enter_room", map);
    }

    void leaveRoom() {
        WritableMap map = Arguments.createMap();
        map.putString("channelID", this.channelID);
        ReactContext reactContext = mReactInstanceManager.getCurrentReactContext();
        this.sendEvent(reactContext, "leave_room", map);
    }

    void sendRoomMessage(WritableMap msg) {
        WritableMap map = Arguments.createMap();

        map.putString("channelID", this.channelID);
        map.putMap("message", msg);

        ReactContext reactContext = mReactInstanceManager.getCurrentReactContext();
        this.sendEvent(reactContext, "send_room_message", map);
    }

    private void sendEvent(ReactContext reactContext, String eventName, WritableMap params) {
        if (reactContext != null) {
            reactContext.getJSModule(RCTNativeAppEventEmitter.class).emit(eventName, params);
        }
    }


    @Override
    public void onLocalOfferSDP(Participant p, SessionDescription sdp) {
        WritableMap map = Arguments.createMap();

        map.putString("id", "receiveVideoFrom");
        map.putString("sender", "" + p.getUid());
        map.putString("sdpOffer", sdp.description);
        sendRoomMessage(map);
    }

    @Override
    public void onLocalIceCandidate(Participant p, IceCandidate candidate) {
        WritableMap obj = Arguments.createMap();
        obj.putString("sdpMid", candidate.sdpMid);
        obj.putInt("sdpMLineIndex", candidate.sdpMLineIndex);
        obj.putString("candidate", candidate.sdp);

        WritableMap map = Arguments.createMap();

        map.putString("id", "onIceCandidate");
        map.putString("name", "" + p.getUid());
        map.putMap("candidate", obj);
        sendRoomMessage(map);
    }


    @Override
    public void onReactContextInitialized(ReactContext context) {
        Log.i(TAG, "on react context initialized");



        this.enterRoom();
    }

    private class MusicIntentReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent.getAction().equals(Intent.ACTION_HEADSET_PLUG)) {
                AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                int state = intent.getIntExtra("state", -1);
                switch (state) {
                    case 0:
                        Log.d(TAG, "Headset is unplugged");
                        audioManager.setSpeakerphoneOn(true);
                        break;
                    case 1:
                        Log.d(TAG, "Headset is plugged");
                        audioManager.setSpeakerphoneOn(false);
                        break;
                    default:
                        Log.d(TAG, "I have no idea what the headset state is");
                }
            }
        }
    }


    public static class PeerConnectionParameters {
        public final boolean videoCallEnabled;
        public final boolean loopback;
        public final boolean tracing;
        public final int videoWidth;
        public final int videoHeight;
        public final int videoFps;
        public final int videoMaxBitrate;
        public final String videoCodec;
        public final boolean videoCodecHwAcceleration;
        public final int audioStartBitrate;
        public final String audioCodec;
        public final boolean noAudioProcessing;
        public final boolean aecDump;
        public final boolean useOpenSLES;
        public final boolean disableBuiltInAEC;
        public final boolean disableBuiltInAGC;
        public final boolean disableBuiltInNS;
        public final boolean enableLevelControl;

        public PeerConnectionParameters(boolean videoCallEnabled, boolean loopback, boolean tracing,
                                        int videoWidth, int videoHeight, int videoFps, int videoMaxBitrate, String videoCodec,
                                        boolean videoCodecHwAcceleration, int audioStartBitrate, String audioCodec,
                                        boolean noAudioProcessing, boolean aecDump, boolean useOpenSLES, boolean disableBuiltInAEC,
                                        boolean disableBuiltInAGC, boolean disableBuiltInNS, boolean enableLevelControl) {
            this.videoCallEnabled = videoCallEnabled;
            this.loopback = loopback;
            this.tracing = tracing;
            this.videoWidth = videoWidth;
            this.videoHeight = videoHeight;
            this.videoFps = videoFps;
            this.videoMaxBitrate = videoMaxBitrate;
            this.videoCodec = videoCodec;
            this.videoCodecHwAcceleration = videoCodecHwAcceleration;
            this.audioStartBitrate = audioStartBitrate;
            this.audioCodec = audioCodec;
            this.noAudioProcessing = noAudioProcessing;
            this.aecDump = aecDump;
            this.useOpenSLES = useOpenSLES;
            this.disableBuiltInAEC = disableBuiltInAEC;
            this.disableBuiltInAGC = disableBuiltInAGC;
            this.disableBuiltInNS = disableBuiltInNS;
            this.enableLevelControl = enableLevelControl;
        }
    }
    private void createPeerConnectionFactory(Context context) {
        executor.execute(new Runnable() {
            @Override
            public void run() {
                createPeerConnectionFactoryInternal(context);
            }
        });
    }
    private void createPeerConnectionFactoryInternal(Context context) {

        PeerConnectionParameters peerConnectionParameters = new PeerConnectionParameters(true, false, false,
                0, 0, 0, 0, null, true, 0,
                null, false, false, false, false, false,
                false, false);

        Log.d(TAG,"Create peer connection factory.");

        // Enable/disable OpenSL ES playback.
        if (!peerConnectionParameters.useOpenSLES) {
            Log.d(TAG, "Disable OpenSL ES audio even if device supports it");
            WebRtcAudioManager.setBlacklistDeviceForOpenSLESUsage(true /* enable */);
        } else {
            Log.d(TAG, "Allow OpenSL ES audio if device supports it");
            WebRtcAudioManager.setBlacklistDeviceForOpenSLESUsage(false);
        }

        if (peerConnectionParameters.disableBuiltInAEC) {
            Log.d(TAG, "Disable built-in AEC even if device supports it");
            WebRtcAudioUtils.setWebRtcBasedAcousticEchoCanceler(true);
        } else {
            Log.d(TAG, "Enable built-in AEC if device supports it");
            WebRtcAudioUtils.setWebRtcBasedAcousticEchoCanceler(false);
        }

        if (peerConnectionParameters.disableBuiltInAGC) {
            Log.d(TAG, "Disable built-in AGC even if device supports it");
            WebRtcAudioUtils.setWebRtcBasedAutomaticGainControl(true);
        } else {
            Log.d(TAG, "Enable built-in AGC if device supports it");
            WebRtcAudioUtils.setWebRtcBasedAutomaticGainControl(false);
        }

        if (peerConnectionParameters.disableBuiltInNS) {
            Log.d(TAG, "Disable built-in NS even if device supports it");
            WebRtcAudioUtils.setWebRtcBasedNoiseSuppressor(true);
        } else {
            Log.d(TAG, "Enable built-in NS if device supports it");
            WebRtcAudioUtils.setWebRtcBasedNoiseSuppressor(false);
        }

        PeerConnectionFactory.InitializationOptions.Builder builder = PeerConnectionFactory.InitializationOptions.builder(context.getApplicationContext());
        builder.setEnableVideoHwAcceleration(peerConnectionParameters.videoCodecHwAcceleration);
        PeerConnectionFactory.InitializationOptions initOptions = builder.createInitializationOptions();
        PeerConnectionFactory.initialize(initOptions);

        factory = new PeerConnectionFactory(null);
        EglBase.Context eglContext = rootEglBase.getEglBaseContext();
        if (eglContext != null) {
            factory.setVideoHwAccelerationOptions(eglContext, eglContext);
        }

        Log.d(TAG, "Peer connection factory created.");
    }


    private boolean useCamera2() {
        return Camera2Enumerator.isSupported(this);
    }

    private VideoCapturer createVideoCapturer() {
        VideoCapturer videoCapturer = null;
        if (useCamera2()) {
            Log.d(TAG, "Creating capturer using camera2 API.");
            videoCapturer = createCameraCapturer(new Camera2Enumerator(this));
        } else {
            Log.d(TAG, "Creating capturer using camera1 API.");
            videoCapturer = createCameraCapturer(new Camera1Enumerator(true));
        }
        if (videoCapturer == null) {
            Log.e(TAG, "Failed to open camera");
            return null;
        }
        return videoCapturer;
    }

    private VideoCapturer createCameraCapturer(CameraEnumerator enumerator) {
        final String[] deviceNames = enumerator.getDeviceNames();

        // First, try to find front facing camera
        Log.d(TAG, "Looking for front facing cameras.");
        for (String deviceName : deviceNames) {
            if (enumerator.isFrontFacing(deviceName)) {
                Log.d(TAG, "Creating front facing camera capturer.");
                VideoCapturer videoCapturer = enumerator.createCapturer(deviceName, null);

                if (videoCapturer != null) {
                    return videoCapturer;
                }
            }
        }

        // Front facing camera not found, try something else
        Log.d(TAG, "Looking for other cameras.");
        for (String deviceName : deviceNames) {
            if (!enumerator.isFrontFacing(deviceName)) {
                Log.d(TAG, "Creating other camera capturer.");
                VideoCapturer videoCapturer = enumerator.createCapturer(deviceName, null);

                if (videoCapturer != null) {
                    return videoCapturer;
                }
            }
        }

        return null;
    }

}
