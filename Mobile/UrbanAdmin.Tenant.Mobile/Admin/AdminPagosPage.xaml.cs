using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// Display-only row for the CollectionView - a placeholder (PaymentStatusId null) reads "Sin
// registrar" / "Nada aún" instead of a misleading amount/"Pendiente", so it's never confused
// with a real, already-pending payment. StatusKind ("paid"/"pending"/"placeholder") drives the
// chip's color via DataTriggers in AdminPagosPage.xaml - mirrors the chip states in
// Mockups/admin-payments-summary-and-edit/index.html (Phase 6b UI/UX pass).
public record AdminPagoDisplayRow(string Utility, string AmountDisplay, string StatusDisplay, string StatusKind);

// Display-only grouping of AdminPagoRowModel by apartment for the CollectionView - matches
// the web app's admin Payments table (Apartamento/Arrendatario are just columns there, but a
// flat un-grouped list of interleaved apartments/services reads as a mess on a narrow mobile
// screen, so this groups what the web app shows as columns). ApartmentNumber/OwnerDisplay and
// SubtotalLabel/SubtotalValue are split so the templates can lay them out left/right, matching
// the mockup's header and subtotal rows.
public class ApartmentPagoGroup : List<AdminPagoDisplayRow>
{
    public string ApartmentNumber { get; }
    public string OwnerDisplay { get; }
    public string SubtotalLabel => "Subtotal (sin Arriendo)";
    public string SubtotalValue { get; }

    public ApartmentPagoGroup(string apartmentNumber, string? owner, List<AdminPagoRowModel> rawItems)
        : base(rawItems.Select(ToDisplayRow))
    {
        ApartmentNumber = apartmentNumber;
        OwnerDisplay = owner ?? string.Empty;
        var subtotal = AdminPagosViewModel.SumNonArriendoAmounts(rawItems);
        SubtotalValue = CopCurrencyFormatter.Format(subtotal);
    }

    private static AdminPagoDisplayRow ToDisplayRow(AdminPagoRowModel row)
    {
        if (row.PaymentStatusId is null)
        {
            return new AdminPagoDisplayRow(row.Utility, "Sin registrar", "Nada aún", "placeholder");
        }

        var amount = row.Amount is null ? "—" : CopCurrencyFormatter.Format(row.Amount);
        return row.Paid
            ? new AdminPagoDisplayRow(row.Utility, amount, "Pagado", "paid")
            : new AdminPagoDisplayRow(row.Utility, amount, "Pendiente", "pending");
    }
}

// 008-mobile-admin-views T045/T064: US4 - read-only, all-apartments Payments summary for a
// selectable month/year, grouped by apartment with a per-apartment subtotal excluding Arriendo
// (FR-005c). Editing lives on the separate AdminPagosEditPage (FR-005a/b).
public partial class AdminPagosPage : ContentPage, IQueryAttributable
{
    private readonly AdminPagosViewModel _viewModel;
    private List<int> _years;
    private bool _isInitializing = true;

    public AdminPagosPage(AdminPagosViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;

        // Mirrors Angular's 7-year sliding window centered on "now" (payments.component.ts).
        _years = AdminPagosPeriodWindow.YearsFor(DateTime.Now.Year);
        YearPicker.ItemsSource = _years;

        MonthPicker.SelectedIndex = _viewModel.Month - 1;
        YearPicker.SelectedIndex = _years.IndexOf(_viewModel.Year);
        _isInitializing = false;
    }

    // 012-cartera-vencida-timeline US2: opened from a Cartera month (route "AdminPagos?month=&year=")
    // this screen starts on that period instead of the current month. The year window widens to
    // include the requested year, since overdue debt can be older than the default window.
    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (!query.TryGetValue("month", out var rawMonth) || !query.TryGetValue("year", out var rawYear)
            || !int.TryParse(rawMonth?.ToString(), out var month) || !int.TryParse(rawYear?.ToString(), out var year)
            || month < 1 || month > 12)
        {
            return;
        }

        _isInitializing = true;
        _viewModel.Month = month;
        _viewModel.Year = year;
        _years = AdminPagosPeriodWindow.YearsFor(DateTime.Now.Year, year);
        YearPicker.ItemsSource = _years;
        MonthPicker.SelectedIndex = month - 1;
        YearPicker.SelectedIndex = _years.IndexOf(year);
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
        }
    }
}
