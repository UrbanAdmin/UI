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
	public override bool FinishedLaunching(UIApplication application, NSDictionary? launchOptions)
	{
		CrossFirebase.Initialize();
		return base.FinishedLaunching(application, launchOptions);
	}
}
