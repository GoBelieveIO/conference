package com.beetle.conference;
import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.text.TextUtils;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.Toast;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class InterphoneActivity extends Activity implements RoomModuleObserver {
    private static final String TAG = "face";

    private static final int AV_PERMISSIONS_REQUEST = 1;

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
    Handler handler;
    Toast toast;

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

        handler = new Handler();

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



        pttView = findViewById(R.id.ptt);
        pttView.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        if (roomModule != null) {
                            roomModule.acquireMic();
                        }
                        showToast("开始讲话");
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (roomModule != null) {

                            pttView.setEnabled(false);
                            roomModule.muteMic(false);

                            handler.postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    roomModule.resumeAudioMixer();
                                    pttView.setEnabled(true);
                                }
                            }, 200);

                            //react native timer can't work in background
                            //roomModule.releaseMic();
                        }
                        showToast("停止讲话");
                        return true;
                    default:
                        return false;
                }
            }
        });

        requestAVPermission();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();

        RoomModule roomModule = mReactInstanceManager.getCurrentReactContext().getNativeModule(RoomModule.class);
        roomModule.setObserver(null);
        roomModule.leaveRoom(channelID);

        if (mReactInstanceManager != null) {
            mReactInstanceManager.onHostDestroy(this);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mReactInstanceManager != null) {
            mReactInstanceManager.onHostPause(this);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (mReactInstanceManager != null) {
            mReactInstanceManager.onHostResume(this, null);
        }
    }

    @Override
    public void onBackPressed() {
        //禁止通过返回按键退出界面
        //super.onBackPressed();
    }


    void showToast(String text) {
        if (toast != null) {
            toast.cancel();
        }

        toast = Toast.makeText(this, text, Toast.LENGTH_SHORT);
        toast.show();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == AV_PERMISSIONS_REQUEST && permissions != null && grantResults != null) {
            boolean granted = true;
            String device = "";
            for (int i = 0; i < permissions.length && i < grantResults.length; i++) {
                if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                    granted = false;
                    device = permissions[i];
                }
                Log.i(TAG, "granted permission:" + permissions[i] + " " + grantResults[i]);
            }

            final boolean fgranted = granted;
            final String gdevice = device;
            handler.post(new Runnable() {
                @Override
                public void run() {
                    if (fgranted) {
                        onPermissionGranted();
                    } else {
                        onPermissionDenied(gdevice);
                    }
                }
            });
        }
    }

    protected void requestAVPermission() {

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
            this.requestPermissions(array, AV_PERMISSIONS_REQUEST);
        } else {
            this.onPermissionGranted();
        }


    }

    protected void onPermissionGranted() {
        mReactInstanceManager.createReactContextInBackground();
    }


    protected void onPermissionDenied(String device) {
        if (TextUtils.isEmpty(device)) {
            device = "设备";
        }
        String msg = String.format("需要%s的访问权限", device);
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setMessage(msg);
        builder.setNegativeButton(getString(R.string.ok), new DialogInterface.OnClickListener() {
            public void onClick(DialogInterface dialog, int which) {
                finish();
            }
        });
        builder.show();
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

        String s = String.format("人数:%d", peers.size() + 1);
        TextView countTextView = findViewById(R.id.count);
        countTextView.setText(s);
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

        String s = String.format("人数:%d", peers.size() + 1);
        TextView countTextView = findViewById(R.id.count);
        countTextView.setText(s);
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