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

    public event Action<string>? TokenRefreshed;

    public FirebasePushTokenProvider()
    {
        CrossFirebaseCloudMessaging.Current.TokenChanged += (_, args) => TokenRefreshed?.Invoke(args.Token);
    }

    public async Task<string?> GetTokenAsync()
    {
        // Android 13+ (API 33) will not display any notification unless the app has
        // been granted POST_NOTIFICATIONS at runtime - declaring it in the manifest
        // (which a transitive Firebase library already does) is necessary but not
        // sufficient. Permissions.PostNotifications is MAUI's built-in cross-platform
        // wrapper for it: Android-specific, a safe no-op everywhere else (iOS's
        // notification permission is requested internally by CheckIfValidAsync below
        // instead, per research.md §10). Converge finding F2.
        await Permissions.RequestAsync<Permissions.PostNotifications>();

        await CrossFirebaseCloudMessaging.Current.CheckIfValidAsync();
        return await CrossFirebaseCloudMessaging.Current.GetTokenAsync();
    }
}
