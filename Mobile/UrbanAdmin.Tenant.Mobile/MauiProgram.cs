using Microsoft.Extensions.Logging;
using UrbanAdmin.Tenant.Mobile.Auth;
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
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
				fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
			});

#if DEBUG
		builder.Logging.AddDebug();
#endif

		builder.Services.AddSingleton(sp => new HttpClient { BaseAddress = new Uri(AppConfig.BackendBaseUrl) });
		builder.Services.AddSingleton<ITenantApiClient, TenantApiClient>();
		builder.Services.AddSingleton<ITokenStore, SecureStorageTokenStore>();
		builder.Services.AddSingleton<IPushTokenProvider, FirebasePushTokenProvider>();
		builder.Services.AddSingleton<DeviceRegistrationService>();

		builder.Services.AddTransient<LoginViewModel>();
		builder.Services.AddTransient<NotificacionesViewModel>();
		builder.Services.AddTransient<PagosViewModel>();

		builder.Services.AddTransient<LoginPage>();
		builder.Services.AddTransient<NotificacionesPage>();
		builder.Services.AddTransient<PagosPage>();

		return builder.Build();
	}
}
