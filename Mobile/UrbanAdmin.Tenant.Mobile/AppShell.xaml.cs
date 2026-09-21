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

		// 013 slice C: announcements, pushed from the "Comunicados" action in the Cartera header.
		Routing.RegisterRoute("Comunicados", typeof(ComunicadosPage));
		Routing.RegisterRoute("ComunicadoEdit", typeof(ComunicadoEditPage));

		// 012/014: the admin Pagos screen also opens as a pushed detail from a Cartera month
		// ("AdminPagos?month=&year="); as the first admin tab its route is "AdminPagosHome".
		Routing.RegisterRoute("AdminPagos", typeof(AdminPagosPage));

		// 013-tenant-pagos-alertas-redesign: paint the "Alertas" tab badge from the shared count
		// (AlertsBadgeState); repainted on navigation because the platform tab bar can be rebuilt.
		var badge = IPlatformApplication.Current?.Services.GetService<AlertsBadgeState>();
		if (badge is not null)
		{
			badge.Changed += () => MainThread.BeginInvokeOnMainThread(() => BottomMenu.Apply(badge.Count));
			Navigated += (_, _) => BottomMenu.Apply(badge.Count);
		}

		// 017-icon-only-tab-bar: no text under the bottom menu icons, for both roles (the titles stay as the
		// accessible names); repainted on every navigation because the platform bar can be rebuilt.
		Navigated += (_, _) => BottomMenu.ApplyIconOnly();
	}

	// 008-mobile-admin-views T005: called from LoginPage right after a successful login.
	// Today's tenant behavior for role == "ApartmentOwner" is preserved exactly (only the
	// tenant tabs were ever visible before this feature existed) - spec.md FR-002.
	public void ApplyRoleVisibility(string? role)
	{
		var isAdmin = role == "Admin";

		NotificacionesTab.IsVisible = !isAdmin;
		PagosTab.IsVisible = !isAdmin;

		AdminPagosTab.IsVisible = isAdmin;
		ApartmentsTab.IsVisible = isAdmin;
		UsersTab.IsVisible = isAdmin;
		CarteraTab.IsVisible = isAdmin;

		// 010-logout-biometric-login: the app's first tab visible for both roles - research.md §2.
		AccountTab.IsVisible = true;
	}
}
