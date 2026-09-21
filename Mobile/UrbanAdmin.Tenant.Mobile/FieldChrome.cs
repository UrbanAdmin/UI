#if ANDROID
using Android.Content.Res;
using Microsoft.Maui.Handlers;
#elif IOS || MACCATALYST
using Microsoft.Maui.Handlers;
using UIKit;
#endif

namespace UrbanAdmin.Tenant.Mobile;

// 017-icon-only-tab-bar (US4, FR-017): the text boxes in the app sit inside their own rounded Organic box
// (FieldBorder), but the native Android field also draws its own underline inside it. One app-wide handler
// mapping clears that line for Entry, Editor, Picker and DatePicker, so every field (also ones added later)
// looks the same without touching any page. Behavior, colours, caret and selection are unchanged; the tint is
// only made transparent. Never throws: a failed mapping just leaves the platform default.
public static class FieldChrome
{
    private const string MappingKey = "UrbanAdminNoFieldLine";

    public static void Apply()
    {
#if ANDROID
        EntryHandler.Mapper.AppendToMapping(MappingKey, (handler, _) => Clear(handler.PlatformView));
        EditorHandler.Mapper.AppendToMapping(MappingKey, (handler, _) => Clear(handler.PlatformView));
        PickerHandler.Mapper.AppendToMapping(MappingKey, (handler, _) => Clear(handler.PlatformView));
        DatePickerHandler.Mapper.AppendToMapping(MappingKey, (handler, _) => Clear(handler.PlatformView));
#elif IOS || MACCATALYST
        // Apple fields have no line by default; this only makes that explicit.
        EntryHandler.Mapper.AppendToMapping(MappingKey, (handler, _) =>
        {
            try
            {
                handler.PlatformView.BorderStyle = UITextBorderStyle.None;
            }
            catch (Exception)
            {
                // Keep the platform default.
            }
        });
#endif
    }

#if ANDROID
    private static void Clear(Android.Views.View? field)
    {
        try
        {
            field?.BackgroundTintList = ColorStateList.ValueOf(Android.Graphics.Color.Transparent);
        }
        catch (Exception)
        {
            // Keep the platform default.
        }
    }
#endif
}
