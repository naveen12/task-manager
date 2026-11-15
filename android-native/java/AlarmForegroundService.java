package __PACKAGE__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmForegroundService extends Service {
  public static final String ACTION_START = "com.kairo.app.ACTION_START_ALERT";
  public static final String ACTION_SNOOZE = "com.kairo.app.ACTION_SNOOZE_ALERT";
  public static final String ACTION_STOP = "com.kairo.app.ACTION_STOP_ALERT";
  public static final String ACTION_CLOSE_POPUP = "com.kairo.app.ACTION_CLOSE_LOCK_POPUP";

  private static final String CHANNEL_ID = "kairo_urgent_alerts_v2";
  private static final int NOTIFICATION_ID = 42001;
  private static final long CRESCENDO_DURATION_MS = 15000L;

  public static volatile boolean isAlertActive = false;
  public static volatile String activeSlotKey = "";

  private MediaPlayer mediaPlayer;
  private Vibrator vibrator;
  private final Handler volumeHandler = new Handler(Looper.getMainLooper());
  private Runnable volumeRunnable;

  private String currentId = "alert";
  private String currentSlotKey = "";
  private String currentType = "alarm";
  private String currentName = "Kairo Alert";
  private String currentTime = "";

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent == null) {
      stopSelf();
      return START_NOT_STICKY;
    }

    String action = intent.getAction();
    if (ACTION_STOP.equals(action)) {
      AlarmScheduler.recordHandledAlert(
        this,
        currentSlotKey,
        currentId,
        currentType,
        currentName,
        currentTime,
        "stopped",
        0L
      );
      stopAlertAndSelf();
      return START_NOT_STICKY;
    }

    if (ACTION_SNOOZE.equals(action)) {
      long snoozeAtMs = scheduleSnooze5Min();
      AlarmScheduler.recordHandledAlert(
        this,
        currentSlotKey,
        currentId,
        currentType,
        currentName,
        currentTime,
        "snoozed",
        snoozeAtMs
      );
      stopAlertAndSelf();
      return START_NOT_STICKY;
    }

    String id = intent.getStringExtra("alert_id");
    String slotKey = intent.getStringExtra("slot_key");
    String type = intent.getStringExtra("alert_type");
    String name = intent.getStringExtra("alert_name");
    String time = intent.getStringExtra("alert_time");

    if (id != null && !id.isEmpty()) currentId = id;
    currentSlotKey = (slotKey != null && !slotKey.isEmpty()) ? slotKey : currentId;
    if (type != null && !type.isEmpty()) currentType = type;
    if (name != null && !name.isEmpty()) currentName = name;
    if (time != null) currentTime = time;

    isAlertActive = true;
    activeSlotKey = currentSlotKey;

    AlarmScheduler.recordHandledAlert(
      this,
      currentSlotKey,
      currentId,
      currentType,
      currentName,
      currentTime,
      "fired",
      0L
    );

    ensureNotificationChannel();
    Notification notification = buildUrgentNotification();
    startForeground(NOTIFICATION_ID, notification);

    startAlarmAudio();
    startAlarmVibration();
    launchLockScreenActivity();

    return START_STICKY;
  }

  private void ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;

    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "Alarms, Reminders & Task Alerts",
      NotificationManager.IMPORTANCE_HIGH
    );
    channel.setDescription("High-priority heads-up and lock-screen alerts with Snooze and Stop");
    channel.enableLights(true);
    channel.enableVibration(true);
    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    channel.setBypassDnd(true);
    nm.createNotificationChannel(channel);
  }

  private String formatTypeTitle() {
    if ("reminder".equalsIgnoreCase(currentType)) return "Reminder";
    if ("task".equalsIgnoreCase(currentType)) return "Task";
    return "Alarm";
  }

  private Notification buildUrgentNotification() {
    Intent fullScreenIntent = new Intent(this, AlarmLockScreenActivity.class);
    fullScreenIntent.setFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK |
      Intent.FLAG_ACTIVITY_CLEAR_TOP |
      Intent.FLAG_ACTIVITY_SINGLE_TOP
    );
    fullScreenIntent.putExtra("alert_id", currentId);
    fullScreenIntent.putExtra("alert_type", currentType);
    fullScreenIntent.putExtra("alert_name", currentName);
    fullScreenIntent.putExtra("alert_time", currentTime);

    PendingIntent fullScreenPi = PendingIntent.getActivity(
      this,
      9001,
      fullScreenIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    Intent snoozeIntent = new Intent(this, AlarmForegroundService.class);
    snoozeIntent.setAction(ACTION_SNOOZE);
    PendingIntent snoozePi = PendingIntent.getService(
      this,
      9002,
      snoozeIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    Intent stopIntent = new Intent(this, AlarmForegroundService.class);
    stopIntent.setAction(ACTION_STOP);
    PendingIntent stopPi = PendingIntent.getService(
      this,
      9003,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    int smallIcon = getApplicationInfo().icon != 0
      ? getApplicationInfo().icon
      : android.R.drawable.ic_lock_idle_alarm;

    String title = formatTypeTitle() + (currentTime.isEmpty() ? "" : " · " + currentTime);

    return new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(smallIcon)
      .setContentTitle(title)
      .setContentText(currentName)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setDefaults(NotificationCompat.DEFAULT_LIGHTS)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(fullScreenPi)
      .setFullScreenIntent(fullScreenPi, true)
      .addAction(0, "Snooze 5m", snoozePi)
      .addAction(0, "Stop", stopPi)
      .build();
  }

  private void launchLockScreenActivity() {
    try {
      Intent popupIntent = new Intent(this, AlarmLockScreenActivity.class);
      popupIntent.setFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK |
        Intent.FLAG_ACTIVITY_CLEAR_TOP |
        Intent.FLAG_ACTIVITY_SINGLE_TOP
      );
      popupIntent.putExtra("alert_id", currentId);
      popupIntent.putExtra("alert_type", currentType);
      popupIntent.putExtra("alert_name", currentName);
      popupIntent.putExtra("alert_time", currentTime);
      startActivity(popupIntent);
    } catch (Exception ignored) {}
  }

  private void startAlarmAudio() {
    stopAlarmAudio();
    try {
      Uri toneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
      if (toneUri == null) {
        toneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
      }
      if (toneUri == null) return;

      boolean gradual = AlarmScheduler.isGradualVolumeEnabled(this);

      mediaPlayer = new MediaPlayer();
      mediaPlayer.setDataSource(this, toneUri);
      mediaPlayer.setAudioAttributes(
        new AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      );
      mediaPlayer.setLooping(true);
      mediaPlayer.prepare();

      if (gradual) {
        mediaPlayer.setVolume(0.08f, 0.08f);
        final long startMs = System.currentTimeMillis();
        volumeRunnable = new Runnable() {
          @Override
          public void run() {
            if (mediaPlayer == null) return;
            long elapsed = Math.max(0L, System.currentTimeMillis() - startMs);
            float t = Math.min(1f, (float) elapsed / (float) CRESCENDO_DURATION_MS);
            float eased = 0.08f + 0.92f * (t * t * (3f - 2f * t));
            try {
              mediaPlayer.setVolume(eased, eased);
            } catch (Exception ignored) {}
            if (t < 1f) {
              volumeHandler.postDelayed(this, 450L);
            }
          }
        };
        volumeHandler.postDelayed(volumeRunnable, 450L);
      } else {
        mediaPlayer.setVolume(1.0f, 1.0f);
      }

      mediaPlayer.start();
    } catch (Exception ignored) {}
  }

  private void stopAlarmAudio() {
    if (volumeRunnable != null) {
      volumeHandler.removeCallbacks(volumeRunnable);
      volumeRunnable = null;
    }
    volumeHandler.removeCallbacksAndMessages(null);
    if (mediaPlayer != null) {
      try {
        if (mediaPlayer.isPlaying()) {
          mediaPlayer.stop();
        }
        mediaPlayer.release();
      } catch (Exception ignored) {}
      mediaPlayer = null;
    }
  }

  private void startAlarmVibration() {
    try {
      vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
      if (vibrator == null || !vibrator.hasVibrator()) return;
      long[] pattern = new long[]{0, 500, 300, 500};
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
      } else {
        vibrator.vibrate(pattern, 0);
      }
    } catch (Exception ignored) {}
  }

  private void stopAlarmVibration() {
    if (vibrator != null) {
      try {
        vibrator.cancel();
      } catch (Exception ignored) {}
      vibrator = null;
    }
  }

  private long scheduleSnooze5Min() {
    long snoozeAtMs = System.currentTimeMillis() + 5 * 60 * 1000L;
    String nextTime = new SimpleDateFormat("hh:mm a", Locale.US).format(new Date(snoozeAtMs));
    String snoozeSlotKey = currentId + "-snooze-" + snoozeAtMs;
    int reqCode = Math.abs(snoozeSlotKey.hashCode());
    AlarmScheduler.scheduleSingle(
      this,
      reqCode,
      currentId,
      snoozeSlotKey,
      currentType,
      currentName,
      nextTime,
      snoozeAtMs
    );
    return snoozeAtMs;
  }

  private void stopAlertAndSelf() {
    isAlertActive = false;
    activeSlotKey = "";
    stopAlarmAudio();
    stopAlarmVibration();

    Intent closePopup = new Intent(ACTION_CLOSE_POPUP);
    closePopup.setPackage(getPackageName());
    sendBroadcast(closePopup);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE);
    } else {
      stopForeground(true);
    }
    stopSelf();
  }

  @Override
  public void onDestroy() {
    isAlertActive = false;
    activeSlotKey = "";
    stopAlarmAudio();
    stopAlarmVibration();
    super.onDestroy();
  }
}
