using Google.Android.Material.BottomNavigation;
using Microsoft.Maui.Controls;
using Microsoft.Maui.Controls.Handlers.Compatibility;
using Microsoft.Maui.Controls.Platform.Compatibility;

namespace UrbanAdmin.Tenant.Mobile.Platforms.Android;

// Android's BottomNavigationView defaults to "shifting" mode once a TabBar has more than
// 3 items: only the selected tab shows its label at full size, the rest shrink/lose their
// label, which reads as tabs being "cut off". The admin role has 5 visible tabs, so we
// force a fixed mode here so every tab is equally sized.
// 017-icon-only-tab-bar: that fixed mode is now "unlabeled" (icons only, no text under them; the tab titles
// stay as the accessible names). It must be set here, on every appearance update: this override used to force
// the labeled mode and undid the icon-only setting made elsewhere (BottomMenu.ApplyIconOnly is only a backup).
public class CustomShellRenderer : ShellRenderer
{
    protected override IShellBottomNavViewAppearanceTracker CreateBottomNavViewAppearanceTracker(ShellItem shellItem)
    {
        return new CustomBottomNavViewAppearanceTracker(this, shellItem);
    }

    private class CustomBottomNavViewAppearanceTracker : ShellBottomNavViewAppearanceTracker
    {
        public CustomBottomNavViewAppearanceTracker(IShellContext shellContext, ShellItem shellItem)
            : base(shellContext, shellItem)
        {
        }

        public override void SetAppearance(BottomNavigationView bottomView, IShellAppearanceElement appearance)
        {
            base.SetAppearance(bottomView, appearance);
            bottomView.LabelVisibilityMode = Google.Android.Material.Navigation.NavigationBarView.LabelVisibilityUnlabeled;
        }
    }
}
