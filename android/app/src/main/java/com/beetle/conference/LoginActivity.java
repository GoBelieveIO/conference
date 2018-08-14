package com.beetle.conference;


import android.content.Intent;
import android.os.Bundle;
import android.support.v4.app.FragmentActivity;
import android.text.TextUtils;
import android.view.View;
import android.widget.EditText;

/**
 * LoginActivity
 * Description: 登录页面,给用户指定消息发送方Id
 */
public class LoginActivity extends FragmentActivity {
    private final String TAG = "demo";
    private final int REQUEST_CONFERENCE = 1;

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

        Intent intent = new Intent(LoginActivity.this, GroupVOIPActivity.class);
        intent.putExtra("current_uid", uid);
        intent.putExtra("channel_id", "" + conferenceID);

        startActivityForResult(intent, REQUEST_CONFERENCE);
    }




    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {

    }


}
