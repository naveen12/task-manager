package __PACKAGE__;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public final class FocusDndManager {
  private static final String PREFS_NAME = "kairo_focus_dnd_prefs";
  private static final String KEY_DND_ACTIVE = "kairo_dnd_active";
  private static final String KEY_PREV_FILTER = "prev_interruption_filter";
  private static final int FOCUS_END_REQ_CODE = 77001;

  private FocusDndManager() {}

  public static boolean isDndAccessGranted(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return true;
    }
    NotificationManager nm =
      (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    return nm != null && nm.isNotificationPolicyAccessGranted();
  }

  public static boolean isFocusDndActive(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    return prefs.getBoolean(KEY_DND_ACTIVE, false);
  }

  public static boolean enableFocusDnd(Context context, boolean allowAlarms) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return false;
    }
    NotificationManager nm =
      (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null || !nm.isNotificationPolicyAccessGranted()) {
      return false;
    }

    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    boolean alreadyActive = prefs.getBoolean(KEY_DND_ACTIVE, false);
    int prevFilter = alreadyActive
      ? prefs.getInt(KEY_PREV_FILTER, NotificationManager.INTERRUPTION_FILTER_ALL)
      : nm.getCurrentInterruptionFilter();

    if (prevFilter == NotificationManager.INTERRUPTION_FILTER_UNKNOWN) {
      prevFilter = NotificationManager.INTERRUPTION_FILTER_ALL;
    }

    try {
      nm.setInterruptionFilter(
        allowAlarms
          ? NotificationManager.INTERRUPTION_FILTER_ALARMS
          : NotificationManager.INTERRUPTION_FILTER_NONE
      );
      prefs
        .edit()
        .putBoolean(KEY_DND_ACTIVE, true)
        .putInt(KEY_PREV_FILTER, prevFilter)
        .apply();
      return true;
    } catch (SecurityException e) {
      return false;
    }
  }

  public static boolean restoreFocusDnd(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    if (!prefs.getBoolean(KEY_DND_ACTIVE, false)) {
      return true;
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      prefs.edit().putBoolean(KEY_DND_ACTIVE, false).apply();
      return true;
    }

    NotificationManager nm =
      (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null || !nm.isNotificationPolicyAccessGranted()) {
      prefs.edit().putBoolean(KEY_DND_ACTIVE, false).apply();
      return false;
    }

    int prevFilter = prefs.getInt(KEY_PREV_FILTER, NotificationManager.INTERRUPTION_FILTER_ALL);
    if (prevFilter == NotificationManager.INTERRUPTION_FILTER_UNKNOWN) {
      prevFilter = NotificationManager.INTERRUPTION_FILTER_ALL;
    }

    try {
      nm.setInterruptionFilter(prevFilter);
    } catch (SecurityException ignored) {}

    prefs.edit().putBoolean(KEY_DND_ACTIVE, false).apply();
    return true;
  }

  public static void scheduleFocusEnd(
    Context context,
    long endsAtMs,
    String focusLabel,
    String timeLabel
  ) {
    cancelFocusEnd(context);
    if (endsAtMs <= System.currentTimeMillis() + 500L) return;
    String safeLabel =
      (focusLabel != null && !focusLabel.trim().isEmpty())
        ? focusLabel.trim()
        : "Focus Session Complete";
    AlarmScheduler.scheduleSingle(
      context,
      FOCUS_END_REQ_CODE,
      "focus-session",
      "focus-" + endsAtMs,
      "focus",
      safeLabel,
      timeLabel != null ? timeLabel : "",
      endsAtMs
    );
  }

  public static void cancelFocusEnd(Context context) {
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    try {
      Intent intent = new Intent(context, ExactAlarmReceiver.class);
      PendingIntent pi = PendingIntent.getBroadcast(
        context,
        FOCUS_END_REQ_CODE,
        intent,
        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
      );
      if (pi != null) {
        am.cancel(pi);
        pi.cancel();
      }
    } catch (Exception ignored) {}
  }
}
