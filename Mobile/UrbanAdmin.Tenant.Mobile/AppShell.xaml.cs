using Microsoft.Extensions.DependencyInjection;
using UrbanAdmin.Tenant.Mobile.Admin;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile;

public partial class AppShell : Shell
{
	public AppShell()
	{
		InitializeComponent();

		// Not part of the TabBar/visual tree, so needs an explicit route registration -
		// 008-mobile-admin-views T019.
		Routing.RegisterRoute("ApartmentEdit", typeof(ApartmentEditPage));
		Routing.RegisterRoute("UserEdit", typeof(UserEditPage));
		Routing.RegisterRoute("AdminPagosEdit", typeof(AdminPagosEditPage));

		// 012-cartera-vencida-timeline US2: the existing admin Pagos screen, demoted from a tab to a
		// pushed detail route opened from Cartera ("AdminPagos?month=&year=" or plain "AdminPagos").
		Routing.RegisterRoute("AdminPagos", typeof(AdminPagosPage));

		// 013-tenant-pagos-alertas-redesign: paint the "Alertas" tab badge from the shared count
		// (AlertsBadgeState); repainted on navigation because the platform tab bar can be rebuilt.
		var badge = IPlatformApplication.Current?.Services.GetService<AlertsBadgeState>();
		if (badge is not null)
		{
			badge.Changed += () => MainThread.BeginInvokeOnMainThread(() => TabBadge.Apply(badge.Count));
			Navigated += (_, _) => TabBadge.Apply(badge.Count);
		}
	}

	// 008-mobile-admin-views T005: called from LoginPage right after a successful login.
	// Today's tenant behavior for role == "ApartmentOwner" is preserved exactly (only the
	// tenant tabs were ever visible before this feature existed) - spec.md FR-002.
	public void ApplyRoleVisibility(string? role)
	{
		var isAdmin = role == "Admin";

		NotificacionesTab.IsVisible = !isAdmin;
		PagosTab.IsVisible = !isAdmin;

		ApartmentsTab.IsVisible = isAdmin;
		UsersTab.IsVisible = isAdmin;
		CarteraTab.IsVisible = isAdmin;
		AdminNotificacionesTab.IsVisible = isAdmin;

		// 010-logout-biometric-login: the app's first tab visible for both roles - research.md §2.
		AccountTab.IsVisible = true;
	}
}
