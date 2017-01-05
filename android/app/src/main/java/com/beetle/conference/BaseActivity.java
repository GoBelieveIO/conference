package com.beetle.conference;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Bundle;
import android.support.v4.app.FragmentActivity;

import com.beetle.im.IMService;

import java.util.List;

/**
 * BaseActivity
 * Description: 基础Activity
 */
public abstract class BaseActivity extends FragmentActivity {
    @Override
    protected  void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }




    @Override
    protected void onStop() {
        super.onStop();

        if (!isAppOnForeground()) {
            //app 进入后台,停止IMService,采用push机制接收离线消息
            IMService.getInstance().enterBackground();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        IMService.getInstance().enterForeground();
    }

    /**
     * 程序是否在前台运行
     *
     * @return
     */
    public boolean isAppOnForeground() {
        // Returns a list of application processes that are running on the
        // device

        ActivityManager activityManager =
            (ActivityManager) getApplicationContext().getSystemService(
                Context.ACTIVITY_SERVICE);
        String packageName = getApplicationContext().getPackageName();

        List<ActivityManager.RunningAppProcessInfo> appProcesses = activityManager
            .getRunningAppProcesses();
        if (appProcesses == null)
            return false;

        for (ActivityManager.RunningAppProcessInfo appProcess : appProcesses) {
            // The name of the process that this object is associated with.
            if (appProcess.processName.equals(packageName)
                && appProcess.importance
                == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
                return true;
            }
        }

        return false;
    }
}
