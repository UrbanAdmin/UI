using Foundation;
using Plugin.Firebase.Core.Platforms.iOS;
using UIKit;

namespace UrbanAdmin.Tenant.Mobile;

[Register("AppDelegate")]
public class AppDelegate : MauiUIApplicationDelegate
{
	protected override MauiApp CreateMauiApp() => MauiProgram.CreateMauiApp();

	// Reads GoogleService-Info.plist (embedded via the csproj's BundleResource item) when
	// called with no arguments.
	//
	// This one call also covers Crashlytics (Plugin.Firebase.Crashlytics) - confirmed by IL
	// inspection (specs/005-mobile-observability/research.md §5) that no separate
	// Crashlytics-specific initialization call exists; CrossFirebaseCrashlytics.Current
	// simply becomes available once Firebase Core is initialized here.
	public override bool FinishedLaunching(UIApplication application, NSDictionary? launchOptions)
	{
		CrossFirebase.Initialize();
		return base.FinishedLaunching(application, launchOptions);
	}
}
