import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const templateJavaDir = path.join(rootDir, 'android-native', 'java');
const templateResDir = path.join(rootDir, 'android-native', 'res');
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
const gradleGroovyPath = path.join(androidDir, 'app', 'build.gradle');
const gradleKtsPath = path.join(androidDir, 'app', 'build.gradle.kts');
const androidJavaRoot = path.join(androidDir, 'app', 'src', 'main', 'java');
const androidResRoot = path.join(androidDir, 'app', 'src', 'main', 'res');

function fail(message) {
  console.error(`\n[Kairo Android Setup] ${message}\n`);
  process.exit(1);
}

function findMainActivityPackage(dir) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivityPackage(fullPath);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java' || entry.name === 'MainActivity.kt') {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^\s*package\s+([a-zA-Z0-9_.]+)/m);
      if (match) return match[1];
    }
  }
  return null;
}

function detectPackageName() {
  for (const gradlePath of [gradleGroovyPath, gradleKtsPath]) {
    if (fs.existsSync(gradlePath)) {
      const gradle = fs.readFileSync(gradlePath, 'utf8');
      const appIdMatch = gradle.match(/applicationId\s*[=]?\s*["']([^"']+)["']/);
      if (appIdMatch) return appIdMatch[1];
      const nsMatch = gradle.match(/namespace\s*[=]?\s*["']([^"']+)["']/);
      if (nsMatch) return nsMatch[1];
    }
  }

  const fromMainActivity = findMainActivityPackage(androidJavaRoot);
  if (fromMainActivity) return fromMainActivity;

  if (fs.existsSync(manifestPath)) {
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    const pkgMatch = manifest.match(/package\s*=\s*["']([^"']+)["']/);
    if (pkgMatch) return pkgMatch[1];
  }

  return 'com.kairo.app';
}

function removeExistingMainActivityKt(pkgDir) {
  const ktPath = path.join(pkgDir, 'MainActivity.kt');
  if (fs.existsSync(ktPath)) {
    fs.unlinkSync(ktPath);
    console.log(`- Removed conflicting ${path.relative(rootDir, ktPath)} (replaced by MainActivity.java)`);
  }
}

function copyJavaTemplates(packageName) {
  if (!fs.existsSync(templateJavaDir)) {
    fail('Missing android-native/java templates folder.');
  }

  const targetPkgDir = path.join(androidJavaRoot, ...packageName.split('.'));
  fs.mkdirSync(targetPkgDir, { recursive: true });
  removeExistingMainActivityKt(targetPkgDir);

  const files = fs.readdirSync(templateJavaDir).filter((f) => f.endsWith('.java'));
  for (const file of files) {
    const src = fs.readFileSync(path.join(templateJavaDir, file), 'utf8');
    const rendered = src
      .replaceAll('__PACKAGE__', packageName)
      .replaceAll('com.kairo.app.ACTION_', `${packageName}.ACTION_`);
    const destPath = path.join(targetPkgDir, file);
    fs.writeFileSync(destPath, rendered, 'utf8');
    console.log(`+ Installed ${path.relative(rootDir, destPath)}`);
  }
}

function copyResTemplates() {
  if (!fs.existsSync(templateResDir)) return;
  const copyDirRecursive = (srcDir, destDir) => {
    fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
        console.log(`+ Installed ${path.relative(rootDir, destPath)}`);
      }
    }
  };
  copyDirRecursive(templateResDir, androidResRoot);
}

function patchManifest() {
  if (!fs.existsSync(manifestPath)) {
    fail('AndroidManifest.xml not found. Run "npx cap add android" first.');
  }

  let xml = fs.readFileSync(manifestPath, 'utf8');

  const requiredPermissions = [
    { name: 'android.permission.POST_NOTIFICATIONS' },
    { name: 'android.permission.SCHEDULE_EXACT_ALARM' },
    { name: 'android.permission.USE_EXACT_ALARM' },
    { name: 'android.permission.USE_FULL_SCREEN_INTENT' },
    { name: 'android.permission.WAKE_LOCK' },
    { name: 'android.permission.DISABLE_KEYGUARD' },
    { name: 'android.permission.SYSTEM_ALERT_WINDOW' },
    { name: 'android.permission.FOREGROUND_SERVICE' },
    { name: 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK' },
    { name: 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE' },
    { name: 'android.permission.RECEIVE_BOOT_COMPLETED' },
    { name: 'android.permission.VIBRATE' },
    { name: 'android.permission.MODIFY_AUDIO_SETTINGS' },
    { name: 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS' },
    { name: 'android.permission.ACCESS_NOTIFICATION_POLICY' },
    { name: 'android.permission.RECORD_AUDIO' },
    { name: 'android.permission.READ_MEDIA_AUDIO' },
    { name: 'android.permission.READ_EXTERNAL_STORAGE', maxSdkVersion: 32 },
    { name: 'android.permission.WRITE_EXTERNAL_STORAGE', maxSdkVersion: 29 },
    { name: 'android.permission.ACCESS_NETWORK_STATE' },
  ];

  const missingPermissions = requiredPermissions
    .filter((perm) => !xml.includes(`android:name="${perm.name}"`))
    .map((perm) =>
      perm.maxSdkVersion
        ? `    <uses-permission android:name="${perm.name}" android:maxSdkVersion="${perm.maxSdkVersion}" />`
        : `    <uses-permission android:name="${perm.name}" />`
    );

  if (missingPermissions.length > 0) {
    const appTagIndex = xml.indexOf('<application');
    if (appTagIndex === -1) {
      fail('Invalid AndroidManifest.xml: missing <application tag.');
    }
    xml =
      xml.slice(0, appTagIndex) +
      missingPermissions.join('\n') +
      '\n\n    ' +
      xml.slice(appTagIndex).trimStart();
  }

  const lockScreenActivitySnippet = `<activity
            android:name=".AlarmLockScreenActivity"
            android:exported="false"
            android:showWhenLocked="true"
            android:showOnLockScreen="true"
            android:turnScreenOn="true"
            android:excludeFromRecents="true"
            android:taskAffinity=""
            android:launchMode="singleInstance"
            android:theme="@android:style/Theme.DeviceDefault.NoActionBar" />`;

  // Upgrade an existing .AlarmLockScreenActivity declaration if present
  const existingLockActivityRegex = /<activity\b[^>]*android:name="\.AlarmLockScreenActivity"[\s\S]*?\/>/;
  if (existingLockActivityRegex.test(xml)) {
    xml = xml.replace(existingLockActivityRegex, lockScreenActivitySnippet);
  }

  const componentSnippets = [
    {
      marker: '.AlarmLockScreenActivity',
      snippet: `\n        ${lockScreenActivitySnippet}`,
    },
    {
      marker: '.AlarmForegroundService',
      snippet: `
        <service
            android:name=".AlarmForegroundService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />`,
    },
    {
      marker: '.FocusTimerForegroundService',
      snippet: `
        <service
            android:name=".FocusTimerForegroundService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Live lock-screen Focus countdown timer" />
        </service>`,
    },
    {
      marker: '.FocusLockScreenActivity',
      snippet: `
        <activity
            android:name=".FocusLockScreenActivity"
            android:exported="false"
            android:showWhenLocked="true"
            android:showOnLockScreen="true"
            android:excludeFromRecents="true"
            android:taskAffinity=""
            android:launchMode="singleInstance"
            android:theme="@android:style/Theme.DeviceDefault.NoActionBar" />`,
    },
    {
      marker: '.ExactAlarmReceiver',
      snippet: `
        <receiver
            android:name=".ExactAlarmReceiver"
            android:enabled="true"
            android:exported="false" />`,
    },
    {
      marker: '.BootReceiver',
      snippet: `
        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="true"
            android:directBootAware="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED" />
            </intent-filter>
        </receiver>`,
    },
    {
      marker: '.KairoQuickWidgetProvider',
      snippet: `
        <receiver
            android:name=".KairoQuickWidgetProvider"
            android:exported="true"
            android:label="Kairo Quick Add">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/kairo_quick_add_widget_info" />
        </receiver>`,
    },
  ];

  const toInsert = componentSnippets
    .filter((item) => !xml.includes(item.marker))
    .map((item) => item.snippet)
    .join('\n');

  if (toInsert.length > 0) {
    const closeAppIndex = xml.lastIndexOf('</application>');
    if (closeAppIndex === -1) {
      fail('Invalid AndroidManifest.xml: missing </application>.');
    }
    xml = xml.slice(0, closeAppIndex) + toInsert + '\n    ' + xml.slice(closeAppIndex);
  }

  fs.writeFileSync(manifestPath, xml, 'utf8');
  console.log(`+ Updated ${path.relative(rootDir, manifestPath)}`);
}

function ensureLocalProperties() {
  const localPropsPath = path.join(androidDir, 'local.properties');
  if (fs.existsSync(localPropsPath)) {
    const existing = fs.readFileSync(localPropsPath, 'utf8');
    if (/^\s*sdk\.dir\s*=/m.test(existing)) {
      return;
    }
  }

  const home = process.env.USERPROFILE || process.env.HOME || '';
  const localAppData = process.env.LOCALAPPDATA || (home ? path.join(home, 'AppData', 'Local') : '');
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    localAppData ? path.join(localAppData, 'Android', 'Sdk') : null,
    home ? path.join(home, 'Android', 'Sdk') : null,
    home ? path.join(home, 'Library', 'Android', 'sdk') : null,
  ].filter(Boolean);

  const foundSdk = candidates.find((p) => fs.existsSync(p));
  if (foundSdk) {
    const escaped = foundSdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
    fs.writeFileSync(localPropsPath, `sdk.dir=${escaped}\n`, 'utf8');
    console.log(`+ Created android/local.properties (sdk.dir=${foundSdk})`);
  } else {
    console.log(
      '! Android SDK not auto-detected. Set ANDROID_HOME or create android/local.properties with sdk.dir=...'
    );
  }
}

if (!fs.existsSync(androidDir)) {
  fail('android/ folder not found. Run "npx cap add android" first, then re-run "node scripts/apply-android-native.mjs".');
}

const packageName = detectPackageName();
console.log(`[Kairo Android Setup] Detected Android package: ${packageName}`);
copyJavaTemplates(packageName);
copyResTemplates();
patchManifest();
ensureLocalProperties();
console.log('[Kairo Android Setup] Native lock-screen alarm, widget, notification & permission support applied successfully.');
