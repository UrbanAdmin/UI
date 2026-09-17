using Android.App;
using Android.Content.PM;
using Android.OS;
using Plugin.Firebase.Core.Platforms.Android;

namespace UrbanAdmin.Tenant.Mobile;

[Activity(Theme = "@style/Maui.SplashTheme", MainLauncher = true, LaunchMode = LaunchMode.SingleTop, ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode | ConfigChanges.ScreenLayout | ConfigChanges.SmallestScreenSize | ConfigChanges.Density)]
public class MainActivity : MauiAppCompatActivity
{
    // Reads google-services.json (embedded via the csproj's GoogleServicesJson item) - the
    // activityLocator lets the plugin re-resolve the current activity later (e.g. for any
    // Firebase feature that needs to present UI), which this single-activity MAUI app always
    // satisfies by returning itself.
    //
    // This one call also covers Crashlytics (Plugin.Firebase.Crashlytics) - confirmed by IL
    // inspection (specs/005-mobile-observability/research.md §5) that no separate
    // Crashlytics-specific initialization call exists; CrossFirebaseCrashlytics.Current
    // simply becomes available once Firebase Core is initialized here.
    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        CrossFirebase.Initialize(this, () => this);
    }
}
