package __PACKAGE__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import androidx.core.content.ContextCompat;

public class ExactAlarmReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    String slotKey = intent.getStringExtra("slot_key");
    if (AlarmScheduler.isSlotMarkedHandled(context, slotKey)) {
      return;
    }

    PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
    if (pm != null) {
      PowerManager.WakeLock wakeLock = pm.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK,
        "Kairo::ExactAlarmWakeLock"
      );
      wakeLock.acquire(20000L);
    }

    String alertType = intent.getStringExtra("alert_type");
    if ("focus".equalsIgnoreCase(alertType)) {
      FocusDndManager.restoreFocusDnd(context);
    }

    Intent serviceIntent = new Intent(context, AlarmForegroundService.class);
    serviceIntent.setAction(AlarmForegroundService.ACTION_START);
    serviceIntent.putExtra("alert_id", intent.getStringExtra("alert_id"));
    serviceIntent.putExtra("slot_key", slotKey);
    serviceIntent.putExtra("alert_type", alertType);
    serviceIntent.putExtra("alert_name", intent.getStringExtra("alert_name"));
    serviceIntent.putExtra("alert_time", intent.getStringExtra("alert_time"));
    serviceIntent.putExtra("snooze_minutes", intent.getIntExtra("snooze_minutes", 5));
    serviceIntent.putExtra("vibration_mode", intent.getStringExtra("vibration_mode"));

    ContextCompat.startForegroundService(context, serviceIntent);
  }
}
