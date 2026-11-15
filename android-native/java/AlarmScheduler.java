package __PACKAGE__;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

public final class AlarmScheduler {
  private static final String PREFS_NAME = "kairo_native_prefs";
  private static final String KEY_ALERTS_JSON = "alerts_json";
  private static final String KEY_REQ_CODES = "scheduled_request_codes";

  private AlarmScheduler() {}

  public static void saveAndSchedule(Context context, String alertsJson) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    cancelExisting(context, prefs);
    prefs.edit().putString(KEY_ALERTS_JSON, alertsJson).apply();
    scheduleFromJson(context, alertsJson);
  }

  public static void rescheduleSaved(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    String json = prefs.getString(KEY_ALERTS_JSON, "[]");
    scheduleFromJson(context, json);
  }

  private static void cancelExisting(Context context, SharedPreferences prefs) {
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    Set<String> codes = prefs.getStringSet(KEY_REQ_CODES, new HashSet<String>());
    for (String codeStr : codes) {
      try {
        int reqCode = Integer.parseInt(codeStr);
        Intent intent = new Intent(context, ExactAlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(
          context,
          reqCode,
          intent,
          PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pi != null) {
          am.cancel(pi);
          pi.cancel();
        }
      } catch (Exception ignored) {}
    }
    prefs.edit().remove(KEY_REQ_CODES).apply();
  }

  public static void scheduleFromJson(Context context, String alertsJson) {
    if (alertsJson == null || alertsJson.trim().isEmpty()) return;
    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    Set<String> newCodes = new HashSet<>();
    long nowMs = System.currentTimeMillis();

    try {
      JSONArray arr = new JSONArray(alertsJson);
      for (int i = 0; i < arr.length(); i++) {
        JSONObject obj = arr.getJSONObject(i);
        String id = obj.optString("id", "alert-" + i);
        String type = obj.optString("type", "alarm");
        String name = obj.optString("name", "Kairo Alert");
        String timeLabel = obj.optString("timeLabel", "");
        long triggerAtMs = obj.optLong("triggerAtMs", 0L);

        if (triggerAtMs <= nowMs + 500L) continue;

        int reqCode = Math.abs((id + ":" + triggerAtMs).hashCode());
        scheduleSingle(context, reqCode, id, type, name, timeLabel, triggerAtMs);
        newCodes.add(String.valueOf(reqCode));
      }
    } catch (Exception ignored) {}

    prefs.edit().putStringSet(KEY_REQ_CODES, newCodes).apply();
  }

  public static void scheduleSingle(
    Context context,
    int reqCode,
    String id,
    String type,
    String name,
    String timeLabel,
    long triggerAtMs
  ) {
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;

    Intent receiverIntent = new Intent(context, ExactAlarmReceiver.class);
    receiverIntent.putExtra("alert_id", id);
    receiverIntent.putExtra("alert_type", type);
    receiverIntent.putExtra("alert_name", name);
    receiverIntent.putExtra("alert_time", timeLabel);

    PendingIntent pi = PendingIntent.getBroadcast(
      context,
      reqCode,
      receiverIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    Intent showIntent = new Intent(context, MainActivity.class);
    PendingIntent showPi = PendingIntent.getActivity(
      context,
      reqCode + 1,
      showIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(triggerAtMs, showPi);
        am.setAlarmClock(info, pi);
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
      } else {
        am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
      }
    } catch (SecurityException secEx) {
      // Fallback if SCHEDULE_EXACT_ALARM was revoked by user
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
      } else {
        am.set(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
      }
    }
  }
}
