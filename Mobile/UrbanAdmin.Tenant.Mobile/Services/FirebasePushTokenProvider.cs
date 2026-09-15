using Plugin.Firebase.CloudMessaging;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Services;

// Cross-platform via Plugin.Firebase.CloudMessaging's shared API (no separate
// Platforms/Android or Platforms/iOS class needed for token acquisition
// itself - only Firebase's own project config differs per platform).
//
// Requires a real Firebase project's google-services.json (Android, under
// Platforms/Android/) and GoogleService-Info.plist (iOS, under
// Platforms/iOS/) plus a CrossFirebase.Initialize(...) call in
// MainApplication.cs / AppDelegate.cs before this can issue a real token -
// none of that exists yet (T028 - needs the user's own Firebase project) and
// is deliberately left as a deployment-time step, per research.md.
public class FirebasePushTokenProvider : IPushTokenProvider
{
    public string Platform => DeviceInfo.Platform == DevicePlatform.iOS ? "iOS" : "Android";

    public async Task<string?> GetTokenAsync()
    {
        await CrossFirebaseCloudMessaging.Current.CheckIfValidAsync();
        return await CrossFirebaseCloudMessaging.Current.GetTokenAsync();
    }
}
