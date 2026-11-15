package __PACKAGE__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import androidx.core.content.ContextCompat;

public class ExactAlarmReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
    PowerManager.WakeLock wakeLock = null;
    if (pm != null) {
      wakeLock = pm.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK,
        "Kairo::ExactAlarmWakeLock"
      );
      wakeLock.acquire(20000L);
    }

    Intent serviceIntent = new Intent(context, AlarmForegroundService.class);
    serviceIntent.setAction(AlarmForegroundService.ACTION_START);
    serviceIntent.putExtra("alert_id", intent.getStringExtra("alert_id"));
    serviceIntent.putExtra("alert_type", intent.getStringExtra("alert_type"));
    serviceIntent.putExtra("alert_name", intent.getStringExtra("alert_name"));
    serviceIntent.putExtra("alert_time", intent.getStringExtra("alert_time"));

    ContextCompat.startForegroundService(context, serviceIntent);
  }
}
