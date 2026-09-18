using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// Display-only grouping of AdminNotificationRowModel by apartment - same rationale as
// ApartmentPagoGroup on AdminPagosPage. No page-level period header here (unlike Pagos): the
// deadline-driven scan spans every configured period, not just the current one, so each row
// keeps its own DueDate rather than sharing one implied period.
public class ApartmentNotificationGroup : List<AdminNotificationRowModel>
{
    public string Header { get; }

    public ApartmentNotificationGroup(string apartmentNumber, string? owner, IEnumerable<AdminNotificationRowModel> items)
        : base(items)
    {
        Header = string.IsNullOrWhiteSpace(owner) ? apartmentNumber : $"{apartmentNumber} — {owner}";
    }
}

// 008-mobile-admin-views T045: US4 - read-only, all-apartments live outstanding-dues scan,
// matching Angular's admin Notifications screen exactly (research.md §1 - not the tenant
// Notificaciones screen's reminder-log semantics). Same imperative code-behind pattern as
// ApartmentsPage/UsersPage.
public partial class AdminNotificacionesPage : ContentPage
{
    private readonly AdminNotificacionesViewModel _viewModel;

    public AdminNotificacionesPage(AdminNotificacionesViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ReloadAsync();
    }

    private async Task ReloadAsync()
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ItemsList.IsVisible = false;
        EmptyLabel.IsVisible = false;
        ErrorLabel.IsVisible = false;

        await _viewModel.LoadAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (_viewModel.HasError)
        {
            ErrorLabel.IsVisible = true;
        }
        else if (_viewModel.IsEmpty)
        {
            EmptyLabel.IsVisible = true;
        }
        else
        {
            ItemsList.ItemsSource = _viewModel.Items
                .GroupBy(i => i.ApartmentId)
                .OrderBy(g => g.First().ApartmentNumber)
                .Select(g => new ApartmentNotificationGroup(g.First().ApartmentNumber, g.First().Owner, g))
                .ToList();
            ItemsList.IsVisible = true;
        }
    }
}
