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
    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        CrossFirebase.Initialize(this, () => this);
    }
}
