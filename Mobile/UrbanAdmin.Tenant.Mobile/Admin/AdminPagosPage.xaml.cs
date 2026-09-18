using System.Globalization;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// Display-only row for the CollectionView - a placeholder (PaymentStatusId null) reads "Sin
// registrar" instead of a misleading "Monto: / Pendiente", so it's never confused with a real,
// already-pending payment (Phase 6b).
public record AdminPagoDisplayRow(string Utility, string AmountDisplay, string StatusDisplay);

// Display-only grouping of AdminPagoRowModel by apartment for the CollectionView - matches
// the web app's admin Payments table (Apartamento/Arrendatario are just columns there, but a
// flat un-grouped list of interleaved apartments/services reads as a mess on a narrow mobile
// screen, so this groups what the web app shows as columns).
public class ApartmentPagoGroup : List<AdminPagoDisplayRow>
{
    public string Header { get; }
    public string SubtotalDisplay { get; }

    public ApartmentPagoGroup(string apartmentNumber, string? owner, List<AdminPagoRowModel> rawItems)
        : base(rawItems.Select(ToDisplayRow))
    {
        Header = string.IsNullOrWhiteSpace(owner) ? apartmentNumber : $"{apartmentNumber} — {owner}";
        var subtotal = AdminPagosViewModel.SumNonArriendoAmounts(rawItems);
        SubtotalDisplay = $"Subtotal (sin Arriendo): {AdminPagosPage.FormatCurrency(subtotal)}";
    }

    private static AdminPagoDisplayRow ToDisplayRow(AdminPagoRowModel row)
    {
        if (row.PaymentStatusId is null)
        {
            return new AdminPagoDisplayRow(row.Utility, "Sin registrar", string.Empty);
        }

        var amount = row.Amount is null ? "—" : AdminPagosPage.FormatCurrency(row.Amount);
        return new AdminPagoDisplayRow(row.Utility, $"Monto: {amount}", row.Paid ? "Pagado" : "Pendiente");
    }
}

// 008-mobile-admin-views T045/T064: US4 - read-only, all-apartments Payments summary for a
// selectable month/year, grouped by apartment with a per-apartment/grand-total subtotal
// excluding Arriendo (FR-005c). Editing lives on the separate AdminPagosEditPage (FR-005a/b).
public partial class AdminPagosPage : ContentPage
{
    private static readonly CultureInfo AmountCulture = new("es-CO");

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

    internal static string FormatCurrency(decimal amount) => amount.ToString("N0", AmountCulture);

    internal static string FormatCurrency(string amount) =>
        decimal.TryParse(amount, out var parsed) ? FormatCurrency(parsed) : amount;

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

    private async void OnEditClicked(object? sender, EventArgs e)
    {
        await Shell.Current.GoToAsync("AdminPagosEdit");
    }

    private async Task ReloadAsync()
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ItemsList.IsVisible = false;
        EmptyLabel.IsVisible = false;
        ErrorLabel.IsVisible = false;
        GrandTotalLabel.IsVisible = false;

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
                .Select(g => new ApartmentPagoGroup(g.First().ApartmentNumber, g.First().Owner, g.ToList()))
                .ToList();
            ItemsList.IsVisible = true;

            GrandTotalLabel.Text = $"Total general (sin Arriendo): {FormatCurrency(_viewModel.GrandTotal)}";
            GrandTotalLabel.IsVisible = true;
        }
    }
}
