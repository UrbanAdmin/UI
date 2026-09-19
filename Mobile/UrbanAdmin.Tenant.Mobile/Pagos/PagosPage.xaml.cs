using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Pagos;

// Display-only row translating PagoModel.Amount into Colombian peso format via
// CopCurrencyFormatter (009-tenant-pagos-period-pesos FR-004) - mirrors NotificacionDisplayRow's
// existing pattern. Paid stays a plain bool so PagosPage.xaml's existing chip DataTriggers keep
// working unchanged.
public record PagoDisplayRow(string Utility, string AmountDisplay, string DueDateDisplay, bool Paid)
{
    public static PagoDisplayRow From(PagoModel model) => new(
        model.Utility,
        CopCurrencyFormatter.Format(model.Amount),
        model.DueDate.ToString("dd/MM/yyyy"),
        model.Paid);
}

public partial class PagosPage : ContentPage
{
    private readonly PagosViewModel _viewModel;
    private readonly List<int> _years;
    private bool _isInitializing = true;

    public PagosPage(PagosViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;

        // 009-tenant-pagos-period-pesos FR-001/research.md §3: a backward-leaning window sized
        // for checking payment history, not the admin Payments screen's future-leaning one.
        var currentYear = DateTime.Now.Year;
        _years = Enumerable.Range(currentYear - 3, 5).ToList();
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
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
        }
        else if (_viewModel.IsEmpty)
        {
            EmptyLabel.IsVisible = true;
        }
        else
        {
            ItemsList.ItemsSource = _viewModel.Items.Select(PagoDisplayRow.From).ToList();
            ItemsList.IsVisible = true;
        }
    }
}
