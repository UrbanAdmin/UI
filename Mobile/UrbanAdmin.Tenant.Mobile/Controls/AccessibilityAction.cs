#if ANDROID
using AndroidX.Core.View;
using AndroidX.Core.View.Accessibility;
#elif IOS || MACCATALYST
using UIKit;
#endif

namespace UrbanAdmin.Tenant.Mobile.Controls;

// 017-icon-only-tab-bar: gives a view the screen-reader action "Marcar como leída" (TalkBack's actions menu on
// Android, VoiceOver's actions rotor on Apple) as the alternative to the swipe. Passing null removes it.
// Platform code, verified with the screen reader on a device; it never throws.
public static class AccessibilityAction
{
    private const string Label = "Marcar como leída";

#if ANDROID
    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<Android.Views.View, object> Ids = new();
#endif

    public static void Apply(VisualElement element, Action? perform)
    {
        try
        {
#if ANDROID
            if (element.Handler?.PlatformView is not Android.Views.View view)
            {
                return;
            }

            // Take away the action added earlier for this view (the id is remembered per view), then add it again if wanted.
            if (Ids.TryGetValue(view, out var previous))
            {
                ViewCompat.RemoveAccessibilityAction(view, (int)previous);
                Ids.Remove(view);
            }

            if (perform is null)
            {
                return;
            }

            Ids.Add(view, ViewCompat.AddAccessibilityAction(view, Label, new ActionCommand(perform)));
#elif IOS || MACCATALYST
            if (element.Handler?.PlatformView is not UIView view)
            {
                return;
            }

            view.AccessibilityCustomActions = perform is null
                ? null
                : [new UIAccessibilityCustomAction(Label, new UIAccessibilityCustomActionHandler(_ =>
                {
                    perform();
                    return true;
                }))];
#endif
        }
        catch (Exception)
        {
            // Keep the platform default.
        }
    }

#if ANDROID
    private sealed class ActionCommand(Action perform) : Java.Lang.Object, IAccessibilityViewCommand
    {
        public bool Perform(Android.Views.View? view, AccessibilityViewCommandCommandArguments? arguments)
        {
            perform();
            return true;
        }
    }
#endif
}
