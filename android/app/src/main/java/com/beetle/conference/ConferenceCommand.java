package com.beetle.conference;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Created by houxh on 2016/12/25.
 */

public class ConferenceCommand {
    public static final String COMMAND_INVITE = "invite";
    public static final String COMMAND_WAIT = "waiting";
    public static final String COMMAND_ACCEPT = "accept";
    public static final String COMMAND_REFUSE = "refuse";


    public String channelID;
    public long initiator;
    public long[] partipants;
    public String command;

    public ConferenceCommand() {

    }
    public ConferenceCommand(JSONObject obj) throws JSONException {
        try {
            this.initiator = obj.getLong("initiator");
            this.channelID = obj.getString("channel_id");
            this.command = obj.getString("command");
            JSONArray array = obj.getJSONArray("partipants");
            long[] partipants = new long[array.length()];
            for (int i = 0; i < array.length(); i++) {
                partipants[i] = array.getLong(i);
            }
            this.partipants = partipants;
        } catch (JSONException e) {
            e.printStackTrace();
            throw e;
        }
    }

    public JSONObject getContent() {
        try {
            JSONObject json = new JSONObject();
            json.put("initiator", this.initiator);
            json.put("channel_id", this.channelID);
            json.put("command", this.command);
            JSONArray array = new JSONArray();
            for (long p : this.partipants) {
                array.put(p);
            }
            json.put("partipants", array);
            return json;
        } catch (JSONException e) {
            e.printStackTrace();
            return null;
        }
    }
}
