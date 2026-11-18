package __PACKAGE__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class FocusTimerForegroundService extends Service {
  public static final String ACTION_START = "com.kairo.app.ACTION_START_FOCUS_TIMER";
  public static final String ACTION_STOP = "com.kairo.app.ACTION_STOP_FOCUS_TIMER";
  public static final String ACTION_CLOSE_FOCUS_SCREEN = "com.kairo.app.ACTION_CLOSE_FOCUS_SCREEN";

  public static final String CHANNEL_ID = "kairo_focus_timer_v1";
  private static final int NOTIFICATION_ID = 42002;

  public static volatile boolean isFocusRunning = false;
  public static volatile long currentEndsAtMs = 0L;

  private String currentLabel = "Deep Focus Session";
  private String currentTimeLabel = "";
  private boolean currentDndActive = false;

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
      long stoppedEndsAt = currentEndsAtMs;
      FocusDndManager.cancelFocusEnd(this);
      FocusDndManager.restoreFocusDnd(this);
      FocusDndManager.markFocusStoppedByUser(this, stoppedEndsAt);
      stopFocusServiceAndClear();
      return START_NOT_STICKY;
    }

    long endsAtMs = intent.getLongExtra("ends_at_ms", 0L);
    if (endsAtMs <= System.currentTimeMillis() + 500L) {
      stopFocusServiceAndClear();
      return START_NOT_STICKY;
    }

    String label = intent.getStringExtra("focus_label");
    String timeLabel = intent.getStringExtra("time_label");
    boolean dndActive = intent.getBooleanExtra("dnd_active", false);

    currentEndsAtMs = endsAtMs;
    currentLabel = (label != null && !label.trim().isEmpty())
      ? label.trim()
      : "Deep Focus Session";
    if (timeLabel != null && !timeLabel.trim().isEmpty()) {
      currentTimeLabel = timeLabel.trim();
    } else {
      currentTimeLabel = new SimpleDateFormat("hh:mm a", Locale.US).format(new Date(endsAtMs));
    }
    currentDndActive = dndActive;
    isFocusRunning = true;

    ensureFocusChannel();
    Notification notification = buildCountdownNotification();

    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        );
      } else {
        startForeground(NOTIFICATION_ID, notification);
      }
    } catch (Exception ignored) {}

    try {
      NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm != null) {
        nm.notify(NOTIFICATION_ID, notification);
      }
    } catch (Exception ignored) {}

    return START_STICKY;
  }

  private void ensureFocusChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;

    NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
    if (existing != null) return;

    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "Focus Lock-Screen Countdown",
      NotificationManager.IMPORTANCE_DEFAULT
    );
    channel.setDescription("Live Focus countdown timer displayed on the lock screen");
    channel.setSound(null, null);
    channel.enableVibration(false);
    channel.enableLights(false);
    channel.setShowBadge(false);
    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    channel.setBypassDnd(true);
    nm.createNotificationChannel(channel);
  }

  private Notification buildCountdownNotification() {
    Intent openAppIntent = new Intent(this, MainActivity.class);
    openAppIntent.setFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP
    );
    PendingIntent openAppPi = PendingIntent.getActivity(
      this,
      9101,
      openAppIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    Intent fullScreenTimerIntent = new Intent(this, FocusLockScreenActivity.class);
    fullScreenTimerIntent.setFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK |
      Intent.FLAG_ACTIVITY_CLEAR_TOP |
      Intent.FLAG_ACTIVITY_SINGLE_TOP
    );
    fullScreenTimerIntent.putExtra("ends_at_ms", currentEndsAtMs);
    fullScreenTimerIntent.putExtra("focus_label", currentLabel);
    fullScreenTimerIntent.putExtra("time_label", currentTimeLabel);
    fullScreenTimerIntent.putExtra("dnd_active", currentDndActive);

    PendingIntent fullScreenTimerPi = PendingIntent.getActivity(
      this,
      9102,
      fullScreenTimerIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    Intent stopIntent = new Intent(this, FocusTimerForegroundService.class);
    stopIntent.setAction(ACTION_STOP);
    PendingIntent stopPi = PendingIntent.getService(
      this,
      9103,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    int smallIcon = getApplicationInfo().icon != 0
      ? getApplicationInfo().icon
      : android.R.drawable.ic_lock_idle_alarm;

    String title = currentDndActive
      ? "Focus Timer · DND ON"
      : "Focus Timer Active";
    String body = currentLabel + (currentTimeLabel.isEmpty() ? "" : " · Ends " + currentTimeLabel);

    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(smallIcon)
      .setContentTitle(title)
      .setContentText(body)
      .setWhen(currentEndsAtMs)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setContentIntent(openAppPi)
      .addAction(0, "Full Screen", fullScreenTimerPi)
      .addAction(0, "End Focus", stopPi);

    return builder.build();
  }

  private void stopFocusServiceAndClear() {
    isFocusRunning = false;
    currentEndsAtMs = 0L;

    Intent closeScreen = new Intent(ACTION_CLOSE_FOCUS_SCREEN);
    closeScreen.setPackage(getPackageName());
    sendBroadcast(closeScreen);

    try {
      NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm != null) {
        nm.cancel(NOTIFICATION_ID);
      }
    } catch (Exception ignored) {}

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE);
    } else {
      stopForeground(true);
    }
    stopSelf();
  }

  @Override
  public void onDestroy() {
    isFocusRunning = false;
    currentEndsAtMs = 0L;
    try {
      NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm != null) {
        nm.cancel(NOTIFICATION_ID);
      }
    } catch (Exception ignored) {}
    super.onDestroy();
  }
}
