using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// Display-only grouping of AdminPagoRowModel by apartment for the CollectionView - matches
// the web app's admin Payments table (Apartamento/Arrendatario are just columns there, but a
// flat un-grouped list of interleaved apartments/services reads as a mess on a narrow mobile
// screen, so this groups what the web app shows as columns).
public class ApartmentPagoGroup : List<AdminPagoRowModel>
{
    public string Header { get; }

    public ApartmentPagoGroup(string apartmentNumber, string? owner, IEnumerable<AdminPagoRowModel> items)
        : base(items)
    {
        Header = string.IsNullOrWhiteSpace(owner) ? apartmentNumber : $"{apartmentNumber} — {owner}";
    }
}

// 008-mobile-admin-views T045: US4 - all-apartments Payments list for a selectable
// month/year, matching the web app's admin Payments screen (research.md's Mes/Año
// selectors). Same imperative code-behind pattern as ApartmentsPage/UsersPage.
public partial class AdminPagosPage : ContentPage
{
    private readonly AdminPagosViewModel _viewModel;
    private readonly List<int> _years;
    private bool _isInitializing = true;

    public AdminPagosPage(AdminPagosViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;

        // Mirrors Angular's 7-year sliding window centered on "now" (payments.component.ts).
        var currentYear = DateTime.Now.Year;
        _years = Enumerable.Range(currentYear - 1, 7).ToList();
        YearPicker.ItemsSource = _years;

        MonthPicker.SelectedIndex = _viewModel.Month - 1;
        YearPicker.SelectedIndex = _years.IndexOf(_viewModel.Year);
        _isInitializing = false;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ReloadAsync();
    }

    private async void OnPeriodChanged(object? sender, EventArgs e)
    {
        if (_isInitializing || MonthPicker.SelectedIndex < 0 || YearPicker.SelectedIndex < 0)
        {
            return;
        }

        _viewModel.Month = MonthPicker.SelectedIndex + 1;
        _viewModel.Year = _years[YearPicker.SelectedIndex];
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
                .Select(g => new ApartmentPagoGroup(g.First().ApartmentNumber, g.First().Owner, g))
                .ToList();
            ItemsList.IsVisible = true;
        }
    }
}
