#if ANDROID
using Google.Android.Material.BottomNavigation;
using Microsoft.Maui.ApplicationModel;
using Microsoft.Maui.Platform;
#elif IOS || MACCATALYST
using Microsoft.Maui.ApplicationModel;
using UIKit;
#endif

namespace UrbanAdmin.Tenant.Mobile;

// The platform bottom menu. .NET MAUI Shell has no built-in tab badge and no "icons only" switch, so both are
// done through the platform tab bar itself (Android BottomNavigationView, iOS/MacCatalyst UITabBarItem):
//  - 013-tenant-pagos-alertas-redesign (research.md §7): the number over the tenant's "Alertas" icon;
//  - 017-icon-only-tab-bar (research.md §1): no text drawn under the icons, for both roles. Every ShellContent
//    keeps its Title: on Android it stays the item's accessible name and how the Alertas tab is found; on Apple
//    it is copied into the item's AccessibilityLabel before the visible title is cleared.
// The count comes from AlertsBadgeState (Core, unit-tested); this class only paints and never throws - a
// missing tab bar simply means no badge and the labels stay.
public static class BottomMenu
{
    private const string AlertasTitle = "Alertas";

    public static void Apply(int count)
    {
        try
        {
#if ANDROID
            ApplyAndroid(count);
#elif IOS || MACCATALYST
            ApplyApple(count);
#endif
        }
        catch (Exception)
        {
            // The badge is a convenience; the app works without it.
        }
    }

    // Hides the text under every icon. Safe to call repeatedly: the platform bar can be rebuilt (a role change,
    // a rotation), so the shell calls this on every navigation.
    public static void ApplyIconOnly()
    {
        try
        {
#if ANDROID
            var nav = FindAndroidNavigation();
            if (nav is not null)
            {
                // Material's "unlabeled" mode: icons only, the selected item keeps its indicator pill.
                nav.LabelVisibilityMode = Google.Android.Material.Navigation.NavigationBarView.LabelVisibilityUnlabeled;
            }
#elif IOS || MACCATALYST
            HideAppleTitles();
#endif
        }
        catch (Exception)
        {
            // Labels simply stay visible.
        }
    }

#if ANDROID
    private static BottomNavigationView? FindAndroidNavigation()
    {
        var decor = Platform.CurrentActivity?.Window?.DecorView;
        return decor is null ? null : FindBottomNavigation(decor);
    }

    private static void ApplyAndroid(int count)
    {
        var nav = FindAndroidNavigation();
        if (nav is null)
        {
            return;
        }

        for (var i = 0; i < nav.Menu.Size(); i++)
        {
            var item = nav.Menu.GetItem(i);
            if (item is null || item.TitleFormatted?.ToString() != AlertasTitle)
            {
                continue;
            }

            if (count <= 0)
            {
                nav.RemoveBadge(item.ItemId);
                return;
            }

            var badge = nav.GetOrCreateBadge(item.ItemId);
            badge.Number = count;
            if (Application.Current?.Resources.TryGetValue("Primary", out var primary) == true && primary is Color color)
            {
                badge.BackgroundColor = color.ToPlatform();
            }

            return;
        }
    }

    private static BottomNavigationView? FindBottomNavigation(Android.Views.View view)
    {
        if (view is BottomNavigationView nav)
        {
            return nav;
        }

        if (view is Android.Views.ViewGroup group)
        {
            for (var i = 0; i < group.ChildCount; i++)
            {
                var child = group.GetChildAt(i);
                var found = child is null ? null : FindBottomNavigation(child);
                if (found is not null)
                {
                    return found;
                }
            }
        }

        return null;
    }
#elif IOS || MACCATALYST
    private static UITabBar? AppleTabBar() => Platform.GetCurrentUIViewController()?.TabBarController?.TabBar;

    // A tab item has no "no title" mode: keep the name as the accessibility label, clear the visible title and
    // centre the image where the title used to be. The Alertas item is found by that label.
    private static void HideAppleTitles()
    {
        var items = AppleTabBar()?.Items;
        if (items is null)
        {
            return;
        }

        foreach (var item in items)
        {
            if (!string.IsNullOrEmpty(item.Title))
            {
                item.AccessibilityLabel = item.Title;
                item.Title = string.Empty;
            }

            item.ImageInsets = new UIEdgeInsets(6, 0, -6, 0);
        }
    }

    private static void ApplyApple(int count)
    {
        var item = AppleTabBar()?.Items?.FirstOrDefault(i => i.AccessibilityLabel == AlertasTitle || i.Title == AlertasTitle);
        if (item is not null)
        {
            item.BadgeValue = count > 0 ? count.ToString() : null;
        }
    }
#endif
}
