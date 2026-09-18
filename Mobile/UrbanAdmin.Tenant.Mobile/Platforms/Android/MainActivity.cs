using Android.App;
using Android.Content.PM;
using Android.OS;
using Plugin.Firebase.Core.Platforms.Android;
using Plugin.Firebase.Crashlytics;

namespace UrbanAdmin.Tenant.Mobile;

[Activity(Theme = "@style/Maui.SplashTheme", MainLauncher = true, LaunchMode = LaunchMode.SingleTop, ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode | ConfigChanges.ScreenLayout | ConfigChanges.SmallestScreenSize | ConfigChanges.Density)]
public class MainActivity : MauiAppCompatActivity
{
    // Reads google-services.json (embedded via the csproj's GoogleServicesJson item) - the
    // activityLocator lets the plugin re-resolve the current activity later (e.g. for any
    // Firebase feature that needs to present UI), which this single-activity MAUI app always
    // satisfies by returning itself.
    //
    // CrossFirebaseCrashlytics.Current becomes available once Firebase Core is initialized here
    // (confirmed by IL inspection, specs/005-mobile-observability/research.md §5), but the
    // library's documented setup still requires the explicit SetCrashlyticsCollectionEnabled
    // call below (specs/006-fix-android-crashlytics-crash/research.md §2) - unrelated to the
    // startup crash fixed by Resources/values/strings.xml in this same feature, but part of
    // Crashlytics's own required setup checklist.
    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        CrossFirebase.Initialize(this, () => this);
        CrossFirebaseCrashlytics.Current.SetCrashlyticsCollectionEnabled(true);
    }
}
