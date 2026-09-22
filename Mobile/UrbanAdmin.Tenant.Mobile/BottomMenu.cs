#if ANDROID
using Google.Android.Material.BottomNavigation;
using Microsoft.Maui.ApplicationModel;
using Microsoft.Maui.Platform;
#elif IOS || MACCATALYST
using Microsoft.Maui.ApplicationModel;
using UIKit;
#endif

namespace UrbanAdmin.Tenant.Mobile;

// The platform bottom menu badge. .NET MAUI Shell has no built-in tab badge, so the number over the tenant's
// "Alertas" icon (013-tenant-pagos-alertas-redesign research.md §7) is painted through the platform tab bar
// itself (Android BottomNavigationView, iOS/MacCatalyst UITabBarItem), found by its Title. The count comes from
// AlertsBadgeState (Core, unit-tested); this class only paints and never throws - a missing tab bar simply
// means no badge. (017-icon-only-tab-bar had also added label-hiding here; reverted by 019-restore-tab-labels -
// the tab bar keeps its normal labels, set by the platform itself.)
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

    private static void ApplyApple(int count)
    {
        var item = AppleTabBar()?.Items?.FirstOrDefault(i => i.Title == AlertasTitle);
        if (item is not null)
        {
            item.BadgeValue = count > 0 ? count.ToString() : null;
        }
    }
#endif
}
