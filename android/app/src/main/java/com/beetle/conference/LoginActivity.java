package com.beetle.conference;

import android.app.ProgressDialog;
import android.content.Intent;
import android.os.AsyncTask;
import android.os.Bundle;

import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedWriter;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import androidx.fragment.app.FragmentActivity;

/**
 * LoginActivity
 * Description: 登录页面,给用户指定消息发送方Id
 */
public class LoginActivity extends FragmentActivity {
    private final String TAG = "demo";
    private static boolean RN_UI = false;
    private static boolean TEST_INTERPHONE = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
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

        final ProgressDialog dialog = ProgressDialog.show(this, null, "登录中...");

        new AsyncTask<Void, Integer, String>() {
            @Override
            protected String doInBackground(Void... urls) {
                return LoginActivity.this.login(uid);
            }

            @Override
            protected void onPostExecute(String result) {
                dialog.dismiss();

                if (TextUtils.isEmpty(result)) {
                    Toast.makeText(LoginActivity.this, "登陆失败", Toast.LENGTH_SHORT).show();
                    return;
                }

                Log.i(TAG, "uid:" + uid + " channel id:" + conferenceID + " token:" + result);

                Class cls = TEST_INTERPHONE ? InterphoneActivity.class : (RN_UI ? GroupVOIPActivity.class : RoomActivity.class);
                Intent intent = new Intent(LoginActivity.this, cls);
                intent.putExtra("current_uid", uid);
                intent.putExtra("channel_id", "" + conferenceID);
                intent.putExtra("token", result);
                
                startActivity(intent);
            }
        }.execute();
    }


    private String login(long uid) {
        //调用app自身的登陆接口获取im服务必须的access token
        String URL = "http://demo.gobelieve.io";
        String uri = String.format("%s/auth/token", URL);

        try {
            java.net.URL url = new URL(uri);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setDoInput(true);
            connection.setUseCaches(false);
            connection.setRequestProperty("Content-type", "application/json");
            connection.connect();

            JSONObject json = new JSONObject();
            json.put("uid", uid);
            BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(connection.getOutputStream(), "UTF-8"));
            writer.write(json.toString());
            writer.close();

            int responseCode = connection.getResponseCode();
            if(responseCode != HttpURLConnection.HTTP_OK) {
                System.out.println("login failure code is:" + responseCode);
                return null;
            }

            InputStream inputStream = connection.getInputStream();

            //inputstream -> string
            ByteArrayOutputStream result = new ByteArrayOutputStream();
            byte[] buffer = new byte[1024];
            int length;
            while ((length = inputStream.read(buffer)) != -1) {
                result.write(buffer, 0, length);
            }
            String str = result.toString(StandardCharsets.UTF_8.name());


            JSONObject jsonObject = new JSONObject(str);
            String accessToken = jsonObject.getString("token");
            return accessToken;
        } catch (Exception e) {
            e.printStackTrace();
        }

        return "";
    }


}
