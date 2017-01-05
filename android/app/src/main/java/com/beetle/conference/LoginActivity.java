package com.beetle.conference;

import android.app.ProgressDialog;
import android.content.Intent;
import android.os.AsyncTask;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;


import com.beetle.im.IMService;
import com.beetle.im.RTMessage;
import com.beetle.im.RTMessageObserver;

import org.apache.http.Header;
import org.apache.http.HttpResponse;
import org.apache.http.HttpStatus;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.message.BasicHeader;
import org.apache.http.protocol.HTTP;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.UUID;


/**
 * LoginActivity
 * Description: 登录页面,给用户指定消息发送方Id
 */
public class LoginActivity extends BaseActivity implements RTMessageObserver {
    private final String TAG = "demo";
    private final int REQUEST_CONFERENCE = 1;

    private long myUID;
    private String token;
    private ProgressDialog dialog;
    private ArrayList<String> channelIDs = new ArrayList<>();

    AsyncTask mLoginTask;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);


        String androidID = Settings.Secure.getString(this.getContentResolver(),
                Settings.Secure.ANDROID_ID);
        IMService.getInstance().setDeviceID(androidID);
        IMService.getInstance().addRTObserver(this);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();

        IMService.getInstance().removeRTObserver(this);
    }


    public void receiveCall(View v) {
        EditText uidEditText = (EditText)findViewById(R.id.initiator_username);

        String uidText = uidEditText.getText().toString();

        if (TextUtils.isEmpty(uidText)) {
            return;
        }

        final long uid = Long.parseLong(uidText);

        if (uid == 0) {
            return;
        }

        if (mLoginTask != null) {
            return;
        }

        final ProgressDialog dialog = ProgressDialog.show(this, null, "登录中...");

        mLoginTask = new AsyncTask<Void, Integer, String>() {
            @Override
            protected String doInBackground(Void... urls) {
                return LoginActivity.this.login(uid);
            }
            @Override
            protected void onPostExecute(String result) {
                dialog.dismiss();
                mLoginTask = null;
                if (result != null && result.length() > 0) {
                    LoginActivity.this.myUID = uid;
                    LoginActivity.this.token = result;

                    IMService.getInstance().stop();
                    IMService.getInstance().setToken(token);
                    IMService.getInstance().setUID(myUID);
                    IMService.getInstance().start();

                    ProgressDialog dialog = ProgressDialog.show(LoginActivity.this, null, "等待中...");
                    dialog.setTitle("等待中...");
                    LoginActivity.this.dialog = dialog;
                } else {
                    Toast.makeText(LoginActivity.this, "登陆失败", Toast.LENGTH_SHORT).show();
                }
            }
        }.execute();
    }

    public void dial(View v) {
        EditText uidEditText = (EditText)findViewById(R.id.initiator_username);
        EditText p1EditText = (EditText)findViewById(R.id.p1_username);
        EditText p2EditText = (EditText)findViewById(R.id.p2_username);
        EditText p3EditText = (EditText)findViewById(R.id.p3_username);
        EditText p4EditText = (EditText)findViewById(R.id.p4_username);


        String uidText = uidEditText.getText().toString();

        if (TextUtils.isEmpty(uidText)) {
            return;
        }

        final long uid = Long.parseLong(uidText);


        if (uid == 0) {
            return;
        }


        final ArrayList<Long> partipants = new ArrayList<>();
        partipants.add(uid);
        String p1Text = p1EditText.getText().toString();
        String p2Text = p2EditText.getText().toString();
        String p3Text = p3EditText.getText().toString();
        String p4Text = p4EditText.getText().toString();

        if (!TextUtils.isEmpty(p1Text)) {
            long p1 = Long.parseLong(p1Text);
            if (p1 > 0) {
                partipants.add(p1);
            }
        }

        if (!TextUtils.isEmpty(p2Text)) {
            long p2 = Long.parseLong(p2Text);
            if (p2 > 0) {
                partipants.add(p2);
            }
        }

        if (!TextUtils.isEmpty(p3Text)) {
            long p3 = Long.parseLong(p3Text);
            if (p3 > 0) {
                partipants.add(p3);
            }
        }

        if (!TextUtils.isEmpty(p4Text)) {
            long p4 = Long.parseLong(p4Text);
            if (p4 > 0) {
                partipants.add(p4);
            }
        }

        if (partipants.size() <= 1) {
            return;
        }

        if (mLoginTask != null) {
            return;
        }
        mLoginTask = new AsyncTask<Void, Integer, String>() {
            @Override
            protected String doInBackground(Void... urls) {
                return LoginActivity.this.login(uid);
            }
            @Override
            protected void onPostExecute(String result) {
                mLoginTask = null;
                if (result != null && result.length() > 0) {

                    LoginActivity.this.myUID = uid;
                    LoginActivity.this.token = result;

                    IMService.getInstance().stop();
                    IMService.getInstance().setToken(token);
                    IMService.getInstance().setUID(myUID);
                    IMService.getInstance().start();


                    //设置用户id,进入MainActivity
                    String[] partipantNames = new String[partipants.size()];
                    String[] partipantAvatars = new String[partipants.size()];
                    long[] partipantIDs = new long[partipants.size()];
                    for (int i = 0; i < partipants.size(); i++) {
                        partipantIDs[i] = partipants.get(i);
                        partipantNames[i] = "";
                        partipantAvatars[i] = "";
                    }

                    Intent intent = new Intent(LoginActivity.this, ConferenceActivity.class);
                    intent.putExtra("current_uid", myUID);
                    intent.putExtra("initiator", myUID);
                    String channelID = UUID.randomUUID().toString();
                    intent.putExtra("channel_id", "" + channelID);
                    intent.putExtra("partipants", partipantIDs);
                    intent.putExtra("partipant_names", partipantNames);
                    intent.putExtra("partipant_avatars", partipantAvatars);
                    startActivityForResult(intent, REQUEST_CONFERENCE);
                } else {
                    Toast.makeText(LoginActivity.this, "登陆失败", Toast.LENGTH_SHORT).show();
                }
            }
        }.execute();


    }

    public void enterRoom(View v) {
        EditText uidEditText = (EditText)findViewById(R.id.et_username);
        EditText conferenceEditText = (EditText)findViewById(R.id.conference_id);

        String uidText = uidEditText.getText().toString();
        String confText = conferenceEditText.getText().toString();

        if (TextUtils.isEmpty(uidText) || TextUtils.isEmpty(confText)) {
            return;
        }

        final long uid = Long.parseLong(uidText);
        final long conferenceID = Long.parseLong(confText);

        if (uid == 0 || conferenceID == 0) {
            return;
        }

        if (mLoginTask != null) {
            return;
        }
        mLoginTask = new AsyncTask<Void, Integer, String>() {
            @Override
            protected String doInBackground(Void... urls) {
                return LoginActivity.this.login(uid);
            }
            @Override
            protected void onPostExecute(String result) {
                mLoginTask = null;
                if (result != null && result.length() > 0) {

                    LoginActivity.this.myUID = uid;
                    LoginActivity.this.token = result;

                    IMService.getInstance().stop();
                    IMService.getInstance().setToken(token);
                    IMService.getInstance().setUID(myUID);
                    IMService.getInstance().start();

                    Intent intent = new Intent(LoginActivity.this, GroupVOIPActivity.class);
                    intent.putExtra("current_uid", myUID);
                    intent.putExtra("channel_id", "" + conferenceID);

                    startActivityForResult(intent, REQUEST_CONFERENCE);
                } else {
                    Toast.makeText(LoginActivity.this, "登陆失败", Toast.LENGTH_SHORT).show();
                }
            }
        }.execute();


    }


    private String login(long uid) {
        //调用app自身的登陆接口获取im服务必须的access token,之后可将token保存在本地供下次直接登录IM服务
        String URL = "http://demo.gobelieve.io";
        
        String uri = String.format("%s/auth/token", URL);
        try {
            HttpClient getClient = new DefaultHttpClient();
            HttpPost request = new HttpPost(uri);
            JSONObject json = new JSONObject();
            json.put("uid", uid);
            int PLATFORM_ANDROID = 2;
            String androidID = Settings.Secure.getString(this.getContentResolver(),
                    Settings.Secure.ANDROID_ID);
            json.put("platform_id", PLATFORM_ANDROID);
            json.put("device_id", androidID);
            StringEntity s = new StringEntity(json.toString());
            s.setContentEncoding((Header) new BasicHeader(HTTP.CONTENT_TYPE, "application/json"));
            request.setEntity(s);

            HttpResponse response = getClient.execute(request);
            int statusCode = response.getStatusLine().getStatusCode();
            if (statusCode != HttpStatus.SC_OK){
                System.out.println("login failure code is:"+statusCode);
                return null;
            }
            int len = (int)response.getEntity().getContentLength();
            byte[] buf = new byte[len];
            InputStream inStream = response.getEntity().getContent();
            int pos = 0;
            while (pos < len) {
                int n = inStream.read(buf, pos, len - pos);
                if (n == -1) {
                    break;
                }
                pos += n;
            }
            inStream.close();
            if (pos != len) {
                return null;
            }
            String txt = new String(buf, "UTF-8");
            JSONObject jsonObject = new JSONObject(txt);
            String accessToken = jsonObject.getString("token");
            return accessToken;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IMService.getInstance().stop();
    }

    @Override
    public void onRTMessage(RTMessage rt) {
        Log.i(TAG, "rt message:" + rt.content);
        try {
            JSONObject json = new JSONObject(rt.content);
            JSONObject obj = json.getJSONObject("conference");
            ConferenceCommand confCommand = new ConferenceCommand(obj);

            if (channelIDs.contains(confCommand.channelID)) {
                return;
            }

            if (ConferenceActivity.activityCount > 0) {
                return;
            }

            if (confCommand.command.equals(ConferenceCommand.COMMAND_INVITE)) {
                dialog.dismiss();
                channelIDs.add(confCommand.channelID);

                String[] partipantNames = new String[confCommand.partipants.length];
                String[] partipantAvatars = new String[confCommand.partipants.length];
                for (int i = 0; i < confCommand.partipants.length; i++) {
                    partipantNames[i] = "";
                    partipantAvatars[i] = "";
                }

                Intent intent = new Intent(LoginActivity.this, ConferenceActivity.class);
                intent.putExtra("channel_id", confCommand.channelID);
                intent.putExtra("current_uid", this.myUID);
                intent.putExtra("token", token);
                intent.putExtra("initiator", confCommand.initiator);
                intent.putExtra("partipants", confCommand.partipants);
                intent.putExtra("partipant_names", partipantNames);
                intent.putExtra("partipant_avatars", partipantAvatars);
                startActivityForResult(intent, REQUEST_CONFERENCE);
            }
        } catch (JSONException e) {
            e.printStackTrace();
            return;
        }

    }
}
