using Microsoft.Extensions.DependencyInjection;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Controls;

public partial class TenantHeader : ContentView
{
    public static readonly BindableProperty KickerProperty =
        BindableProperty.Create(nameof(Kicker), typeof(string), typeof(TenantHeader), string.Empty, propertyChanged: OnKickerChanged);

    public static readonly BindableProperty HasKickerProperty =
        BindableProperty.Create(nameof(HasKicker), typeof(bool), typeof(TenantHeader), false);

    public static readonly BindableProperty TitleProperty =
        BindableProperty.Create(nameof(Title), typeof(string), typeof(TenantHeader), string.Empty);

    // The tenant screens show a logout icon; the Cuenta tab and the admin screens (which have the
    // Cuenta tab) hide it.
    public static readonly BindableProperty ShowLogoutProperty =
        BindableProperty.Create(nameof(ShowLogout), typeof(bool), typeof(TenantHeader), true);

    // Pushed screens (edit forms, the detailed Pagos) show a back arrow instead of a native nav bar.
    public static readonly BindableProperty ShowBackProperty =
        BindableProperty.Create(nameof(ShowBack), typeof(bool), typeof(TenantHeader), false);

    // An optional pill on the right ("Agregar"); the page reacts to ActionClicked.
    public static readonly BindableProperty ActionTextProperty =
        BindableProperty.Create(nameof(ActionText), typeof(string), typeof(TenantHeader), string.Empty, propertyChanged: OnActionTextChanged);

    public static readonly BindableProperty HasActionProperty =
        BindableProperty.Create(nameof(HasAction), typeof(bool), typeof(TenantHeader), false);

    public TenantHeader() => InitializeComponent();

    public event EventHandler? ActionClicked;

    public string Kicker
    {
        get => (string)GetValue(KickerProperty);
        set => SetValue(KickerProperty, value);
    }

    public bool HasKicker => (bool)GetValue(HasKickerProperty);

    public string Title
    {
        get => (string)GetValue(TitleProperty);
        set => SetValue(TitleProperty, value);
    }

    public bool ShowLogout
    {
        get => (bool)GetValue(ShowLogoutProperty);
        set => SetValue(ShowLogoutProperty, value);
    }

    public bool ShowBack
    {
        get => (bool)GetValue(ShowBackProperty);
        set => SetValue(ShowBackProperty, value);
    }

    public string ActionText
    {
        get => (string)GetValue(ActionTextProperty);
        set => SetValue(ActionTextProperty, value);
    }

    public bool HasAction => (bool)GetValue(HasActionProperty);

    private static void OnKickerChanged(BindableObject bindable, object oldValue, object newValue) =>
        bindable.SetValue(HasKickerProperty, !string.IsNullOrWhiteSpace((string?)newValue));

    private static void OnActionTextChanged(BindableObject bindable, object oldValue, object newValue) =>
        bindable.SetValue(HasActionProperty, !string.IsNullOrWhiteSpace((string?)newValue));

    private async void OnBackTapped(object? sender, TappedEventArgs e)
    {
        if (Shell.Current is not null)
        {
            await Shell.Current.GoToAsync("..");
        }
    }

    private void OnActionTapped(object? sender, TappedEventArgs e) => ActionClicked?.Invoke(this, EventArgs.Empty);

    // The same sign-out as the Cuenta tab (AccountViewModel: clears the session and the biometric
    // credential), preceded by a confirmation, then back to the sign-in screen.
    private async void OnLogoutTapped(object? sender, TappedEventArgs e)
    {
        var services = Handler?.MauiContext?.Services;
        var account = services?.GetService<AccountViewModel>();
        if (account is null || Shell.Current is null)
        {
            return;
        }

        var confirmed = await Shell.Current.DisplayAlertAsync(
            "¿Cerrar sesión?",
            "Tendrás que ingresar de nuevo para ver tus pagos y avisos.",
            "Cerrar sesión",
            "Cancelar");
        if (!confirmed)
        {
            return;
        }

        await account.LogoutAsync();
        services?.GetService<AlertsBadgeState>()?.Reset();
        await Shell.Current.GoToAsync("//Login");
    }
}
