using Plugin.Firebase.CloudMessaging;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Services;

// Cross-platform via Plugin.Firebase.CloudMessaging's shared API (no separate
// Platforms/Android or Platforms/iOS class needed for token acquisition
// itself - only Firebase's own project config differs per platform).
//
// Backed by the real urbanadmin-tenant Firebase project's google-services.json
// (Android) / GoogleService-Info.plist (iOS), both at the project root and
// wired into the build via the csproj's GoogleServicesJson/BundleResource
// items, plus CrossFirebase.Initialize(...) in MainActivity.OnCreate
// (Android) / AppDelegate.FinishedLaunching (iOS) - see research.md §10.
public class FirebasePushTokenProvider : IPushTokenProvider
{
    public string Platform => DeviceInfo.Platform == DevicePlatform.iOS ? "iOS" : "Android";

    public async Task<string?> GetTokenAsync()
    {
        await CrossFirebaseCloudMessaging.Current.CheckIfValidAsync();
        return await CrossFirebaseCloudMessaging.Current.GetTokenAsync();
    }
}
