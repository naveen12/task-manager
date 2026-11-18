package __PACKAGE__;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.content.ContextCompat;

public final class FocusDndManager {
  private static final String PREFS_NAME = "kairo_focus_dnd_prefs";
  private static final String KEY_DND_ACTIVE = "kairo_dnd_active";
  private static final String KEY_PREV_FILTER = "prev_interruption_filter";
  private static final String KEY_HAS_PREV_POLICY = "has_prev_policy";
  private static final String KEY_PREV_POLICY_CATS = "prev_policy_cats";
  private static final String KEY_PREV_POLICY_CALLS = "prev_policy_calls";
  private static final String KEY_PREV_POLICY_MSGS = "prev_policy_msgs";
  private static final String KEY_PREV_POLICY_VISUAL = "prev_policy_visual";
  private static final String KEY_STOPPED_FOCUS_END_MS = "stopped_focus_end_ms";
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

    SharedPreferences.Editor editor = prefs.edit();

    if (!alreadyActive) {
      int prevFilter = nm.getCurrentInterruptionFilter();
      if (prevFilter == NotificationManager.INTERRUPTION_FILTER_UNKNOWN) {
        prevFilter = NotificationManager.INTERRUPTION_FILTER_ALL;
      }
      editor.putInt(KEY_PREV_FILTER, prevFilter);

      try {
        NotificationManager.Policy prevPolicy = nm.getNotificationPolicy();
        if (prevPolicy != null) {
          editor.putBoolean(KEY_HAS_PREV_POLICY, true);
          editor.putInt(KEY_PREV_POLICY_CATS, prevPolicy.priorityCategories);
          editor.putInt(KEY_PREV_POLICY_CALLS, prevPolicy.priorityCallSenders);
          editor.putInt(KEY_PREV_POLICY_MSGS, prevPolicy.priorityMessageSenders);
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            editor.putInt(KEY_PREV_POLICY_VISUAL, prevPolicy.suppressedVisualEffects);
          }
        }
      } catch (Exception ignored) {}
    }

    try {
      // Enforce a strict Focus DND policy so OS DND exceptions (e.g. Contacts, Repeat Callers,
      // Messages/WhatsApp, or Pop-on-screen visual effects) are blocked while Focus is active.
      int focusCategories = allowAlarms && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
        ? NotificationManager.Policy.PRIORITY_CATEGORY_ALARMS
        : 0;

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        int suppressedVisual =
          NotificationManager.Policy.SUPPRESSED_EFFECT_FULL_SCREEN_INTENT |
          NotificationManager.Policy.SUPPRESSED_EFFECT_LIGHTS |
          NotificationManager.Policy.SUPPRESSED_EFFECT_PEEK |
          NotificationManager.Policy.SUPPRESSED_EFFECT_STATUS_BAR |
          NotificationManager.Policy.SUPPRESSED_EFFECT_BADGE |
          NotificationManager.Policy.SUPPRESSED_EFFECT_AMBIENT |
          NotificationManager.Policy.SUPPRESSED_EFFECT_NOTIFICATION_LIST;

        nm.setNotificationPolicy(
          new NotificationManager.Policy(
            focusCategories,
            NotificationManager.Policy.PRIORITY_SENDERS_STARRED,
            NotificationManager.Policy.PRIORITY_SENDERS_STARRED,
            suppressedVisual
          )
        );
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        int suppressedVisual =
          NotificationManager.Policy.SUPPRESSED_EFFECT_SCREEN_OFF |
          NotificationManager.Policy.SUPPRESSED_EFFECT_SCREEN_ON;
        nm.setNotificationPolicy(
          new NotificationManager.Policy(
            focusCategories,
            NotificationManager.Policy.PRIORITY_SENDERS_STARRED,
            NotificationManager.Policy.PRIORITY_SENDERS_STARRED,
            suppressedVisual
          )
        );
      } else {
        nm.setNotificationPolicy(
          new NotificationManager.Policy(
            focusCategories,
            NotificationManager.Policy.PRIORITY_SENDERS_STARRED,
            NotificationManager.Policy.PRIORITY_SENDERS_STARRED
          )
        );
      }

      nm.setInterruptionFilter(
        allowAlarms
          ? NotificationManager.INTERRUPTION_FILTER_PRIORITY
          : NotificationManager.INTERRUPTION_FILTER_NONE
      );

      int appliedFilter = nm.getCurrentInterruptionFilter();
      boolean activeNow = appliedFilter != NotificationManager.INTERRUPTION_FILTER_ALL;

      editor.putBoolean(KEY_DND_ACTIVE, activeNow).apply();
      return activeNow;
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

    if (prefs.getBoolean(KEY_HAS_PREV_POLICY, false)) {
      try {
        int cats = prefs.getInt(KEY_PREV_POLICY_CATS, 0);
        int calls = prefs.getInt(
          KEY_PREV_POLICY_CALLS,
          NotificationManager.Policy.PRIORITY_SENDERS_CONTACTS
        );
        int msgs = prefs.getInt(
          KEY_PREV_POLICY_MSGS,
          NotificationManager.Policy.PRIORITY_SENDERS_CONTACTS
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
          int visual = prefs.getInt(KEY_PREV_POLICY_VISUAL, 0);
          nm.setNotificationPolicy(new NotificationManager.Policy(cats, calls, msgs, visual));
        } else {
          nm.setNotificationPolicy(new NotificationManager.Policy(cats, calls, msgs));
        }
      } catch (Exception ignored) {}
    }

    int prevFilter = prefs.getInt(KEY_PREV_FILTER, NotificationManager.INTERRUPTION_FILTER_ALL);
    if (prevFilter == NotificationManager.INTERRUPTION_FILTER_UNKNOWN) {
      prevFilter = NotificationManager.INTERRUPTION_FILTER_ALL;
    }

    try {
      nm.setInterruptionFilter(prevFilter);
    } catch (SecurityException ignored) {}

    prefs
      .edit()
      .putBoolean(KEY_DND_ACTIVE, false)
      .putBoolean(KEY_HAS_PREV_POLICY, false)
      .apply();
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

  public static void markFocusStoppedByUser(Context context, long endsAtMs) {
    if (endsAtMs <= 0L) return;
    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    prefs.edit().putLong(KEY_STOPPED_FOCUS_END_MS, endsAtMs).apply();
  }

  public static long consumeStoppedFocusEndMs(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    long stopped = prefs.getLong(KEY_STOPPED_FOCUS_END_MS, 0L);
    if (stopped > 0L) {
      prefs.edit().remove(KEY_STOPPED_FOCUS_END_MS).apply();
    }
    return stopped;
  }

  public static void startLockScreenCountdown(
    Context context,
    long endsAtMs,
    String focusLabel,
    String timeLabel,
    boolean dndActive
  ) {
    if (endsAtMs <= System.currentTimeMillis() + 500L) return;
    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    prefs.edit().remove(KEY_STOPPED_FOCUS_END_MS).apply();
    try {
      Intent svc = new Intent(context, FocusTimerForegroundService.class);
      svc.setAction(FocusTimerForegroundService.ACTION_START);
      svc.putExtra("ends_at_ms", endsAtMs);
      svc.putExtra("focus_label", focusLabel != null ? focusLabel : "Deep Focus Session");
      svc.putExtra("time_label", timeLabel != null ? timeLabel : "");
      svc.putExtra("dnd_active", dndActive);
      ContextCompat.startForegroundService(context, svc);
    } catch (Exception ignored) {}
  }

  public static void stopLockScreenCountdown(Context context) {
    try {
      Intent svc = new Intent(context, FocusTimerForegroundService.class);
      svc.setAction(FocusTimerForegroundService.ACTION_STOP);
      context.stopService(svc);
    } catch (Exception ignored) {}
    try {
      Intent closeScreen = new Intent(FocusTimerForegroundService.ACTION_CLOSE_FOCUS_SCREEN);
      closeScreen.setPackage(context.getPackageName());
      context.sendBroadcast(closeScreen);
    } catch (Exception ignored) {}
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
