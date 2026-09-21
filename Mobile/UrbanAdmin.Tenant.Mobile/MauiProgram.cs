using Maui.Biometric;
using Microsoft.Extensions.Logging;
using UrbanAdmin.Tenant.Mobile.Account;
using UrbanAdmin.Tenant.Mobile.Admin;
using UrbanAdmin.Tenant.Mobile.Auth;
using UrbanAdmin.Tenant.Mobile.Cartera;
using UrbanAdmin.Tenant.Mobile.Core.Services;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Notificaciones;
using UrbanAdmin.Tenant.Mobile.Pagos;
using UrbanAdmin.Tenant.Mobile.Services;

namespace UrbanAdmin.Tenant.Mobile;

public static class MauiProgram
{
	public static MauiApp CreateMauiApp()
	{
		var builder = MauiApp.CreateBuilder();
		builder
			.UseMauiApp<App>()
			.UseBiometricAuthentication()
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
				fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
				fonts.AddFont("Caprasimo-Regular.ttf", "CaprasimoRegular");
				fonts.AddFont("Figtree-Regular.ttf", "FigtreeRegular");
				fonts.AddFont("Figtree-SemiBold.ttf", "FigtreeSemibold");
			});

#if DEBUG
		builder.Logging.AddDebug();
#endif

#if ANDROID
		builder.ConfigureMauiHandlers(handlers =>
		{
			handlers.AddHandler(typeof(Shell), typeof(Platforms.Android.CustomShellRenderer));
		});
#endif

		builder.Services.AddSingleton(sp => new HttpClient { BaseAddress = new Uri(AppConfig.BackendBaseUrl) });
		builder.Services.AddSingleton<ITenantApiClient, TenantApiClient>();
		builder.Services.AddSingleton<IAdminApiClient, AdminApiClient>();
		builder.Services.AddSingleton<ITokenStore, SecureStorageTokenStore>();
		builder.Services.AddSingleton<IBiometricCredentialStore, SecureStorageBiometricCredentialStore>();
		builder.Services.AddSingleton<IBiometricAuthenticator, OscoreBiometricAuthenticator>();
		builder.Services.AddSingleton<IPushTokenProvider, FirebasePushTokenProvider>();
		builder.Services.AddSingleton<DeviceRegistrationService>();
		builder.Services.AddSingleton<ICrashDiagnosticsService, FirebaseCrashDiagnosticsService>();

		builder.Services.AddTransient<LoginViewModel>();
		builder.Services.AddTransient<NotificacionesViewModel>();
		// 013-tenant-pagos-alertas-redesign: the tenant Alertas screen and the shared tab-badge state.
		builder.Services.AddTransient<AlertasViewModel>();
		builder.Services.AddSingleton<AlertsBadgeState>();
		builder.Services.AddSingleton<AlertsBadgeService>();
		builder.Services.AddTransient<PagosViewModel>();
		builder.Services.AddTransient<ApartmentsViewModel>();
		builder.Services.AddTransient<ApartmentEditViewModel>();
		builder.Services.AddTransient<UsersViewModel>();
		builder.Services.AddTransient<UserEditViewModel>();
		builder.Services.AddTransient<AdminPagosViewModel>();
		builder.Services.AddTransient<AdminPagosEditViewModel>();
		builder.Services.AddTransient<CarteraViewModel>();
		builder.Services.AddTransient<AccountViewModel>();

		builder.Services.AddTransient<LoginPage>();
		builder.Services.AddTransient<NotificacionesPage>();
		builder.Services.AddTransient<PagosPage>();
		builder.Services.AddTransient<ApartmentsPage>();
		builder.Services.AddTransient<UsersPage>();
		builder.Services.AddTransient<AdminPagosPage>();
		builder.Services.AddTransient<CarteraPage>();
		builder.Services.AddTransient<ApartmentEditPage>();
		builder.Services.AddTransient<UserEditPage>();
		builder.Services.AddTransient<AdminPagosEditPage>();
		builder.Services.AddTransient<AccountPage>();

		return builder.Build();
	}
}
