package __PACKAGE__;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
  name = "KairoAlarm",
  permissions = {
    @Permission(
      strings = { Manifest.permission.POST_NOTIFICATIONS },
      alias = "notifications"
    )
  }
)
public class KairoAlarmPlugin extends Plugin {
  @PluginMethod
  public void syncAlerts(PluginCall call) {
    String alertsJson = call.getString("alertsJson", "[]");
    boolean gradualVolume = call.getBoolean("gradualVolume", true);
    AlarmScheduler.setGradualVolumeEnabled(getContext(), gradualVolume);
    AlarmScheduler.saveAndSchedule(getContext(), alertsJson);
    JSObject ret = new JSObject();
    ret.put("scheduled", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void consumeHandledAlerts(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("handledJson", AlarmScheduler.getHandledAlertsJson(getContext()));
    ret.put("isAlertActive", AlarmForegroundService.isAlertActive);
    ret.put("activeSlotKey", AlarmForegroundService.activeSlotKey);
    call.resolve(ret);
  }

  @PluginMethod
  public void markAlertHandled(PluginCall call) {
    String slotKey = call.getString("slotKey", "");
    AlarmScheduler.markSlotHandled(getContext(), slotKey);
    call.resolve();
  }

  @PluginMethod
  public void getPermissionStatus(PluginCall call) {
    Context ctx = getContext();
    boolean postNotifications = true;
    if (Build.VERSION.SDK_INT >= 33) {
      postNotifications =
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
        == PackageManager.PERMISSION_GRANTED;
    }

    boolean exactAlarms = true;
    if (Build.VERSION.SDK_INT >= 31) {
      AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
      exactAlarms = am != null && am.canScheduleExactAlarms();
    }

    boolean fullScreenIntent = true;
    if (Build.VERSION.SDK_INT >= 34) {
      NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm != null) {
        try {
          Object res = nm.getClass().getMethod("canUseFullScreenIntent").invoke(nm);
          if (res instanceof Boolean) {
            fullScreenIntent = (Boolean) res;
          }
        } catch (Exception ignored) {}
      }
    }

    boolean overlayPermission = true;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      overlayPermission = Settings.canDrawOverlays(ctx);
    }

    boolean batteryIgnored = true;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
      batteryIgnored = pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }

    JSObject ret = new JSObject();
    ret.put("postNotifications", postNotifications);
    ret.put("exactAlarms", exactAlarms);
    ret.put("fullScreenIntent", fullScreenIntent);
    ret.put("overlayPermission", overlayPermission);
    ret.put("batteryOptimizationIgnored", batteryIgnored);
    call.resolve(ret);
  }

  @PluginMethod
  public void requestNotificationPermission(PluginCall call) {
    if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
      JSObject ret = new JSObject();
      ret.put("granted", true);
      call.resolve(ret);
      return;
    }
    requestPermissionForAlias("notifications", call, "notificationsPermsCallback");
  }

  @PermissionCallback
  private void notificationsPermsCallback(PluginCall call) {
    boolean granted = getPermissionState("notifications") == PermissionState.GRANTED;
    JSObject ret = new JSObject();
    ret.put("granted", granted);
    call.resolve(ret);
  }

  @PluginMethod
  public void openExactAlarmSettings(PluginCall call) {
    if (Build.VERSION.SDK_INT >= 31) {
      try {
        Intent intent = new Intent("android.settings.REQUEST_SCHEDULE_EXACT_ALARM");
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
      } catch (Exception e) {
        openAppInfoFallback();
      }
    }
    call.resolve();
  }

  @PluginMethod
  public void openFullScreenIntentSettings(PluginCall call) {
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        Intent intent = new Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT");
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
      } else {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
      }
    } catch (Exception e) {
      openAppInfoFallback();
    }
    call.resolve();
  }

  @PluginMethod
  public void openOverlaySettings(PluginCall call) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      try {
        Intent intent = new Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
      } catch (Exception e) {
        try {
          Intent generic = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
          generic.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          getContext().startActivity(generic);
        } catch (Exception e2) {
          openAppInfoFallback();
        }
      }
    }
    call.resolve();
  }

  @PluginMethod
  public void openAppInfoSettings(PluginCall call) {
    openAppInfoFallback();
    call.resolve();
  }

  private void openAppInfoFallback() {
    try {
      Intent intent = new Intent(
        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        Uri.parse("package:" + getContext().getPackageName())
      );
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(intent);
    } catch (Exception ignored) {}
  }

  @PluginMethod
  public void openBatterySettings(PluginCall call) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      try {
        Intent intent = new Intent(
          Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
          Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
      } catch (Exception e) {
        openAppInfoFallback();
      }
    }
    call.resolve();
  }

  @PluginMethod
  public void stopActiveAlert(PluginCall call) {
    String action = call.getString("action", "stop");
    Intent intent = new Intent(getContext(), AlarmForegroundService.class);
    intent.setAction("snooze".equals(action)
      ? AlarmForegroundService.ACTION_SNOOZE
      : AlarmForegroundService.ACTION_STOP);
    try {
      getContext().startService(intent);
    } catch (Exception ignored) {}
    call.resolve();
  }
}
