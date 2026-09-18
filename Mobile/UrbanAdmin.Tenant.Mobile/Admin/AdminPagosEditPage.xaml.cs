using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// Display-only editable row for the CollectionView - Amount/Paid are plain settable
// properties (not INotifyPropertyChanged) that the Entry/Switch two-way-bind into; saves are
// triggered explicitly from the Unfocused/Toggled event handlers below, not by the binding
// itself (Phase 6b).
public class AdminPagoEditRow(AdminPagoRowModel row)
{
    public long ApartmentId { get; } = row.ApartmentId;
    public string ApartmentLabel { get; } = string.IsNullOrWhiteSpace(row.Owner) ? row.ApartmentNumber : $"{row.ApartmentNumber} — {row.Owner}";
    public string? Amount { get; set; } = row.Amount;
    public bool Paid { get; set; } = row.Paid;
}

// 008-mobile-admin-views T069 (Phase 6b): select a Servicio/Mes/Año, set the shared deadline
// (hidden for Arriendo), and edit each apartment's amount/paid status - every change saves
// immediately. Matches Mockups/admin-payments-summary-and-edit/index.html's confirmed layout.
public partial class AdminPagosEditPage : ContentPage
{
    private readonly AdminPagosEditViewModel _viewModel;
    private readonly List<int> _years;
    private bool _isInitializing = true;
    private bool _isFirstAppearance = true;

    public AdminPagosEditPage(AdminPagosEditViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;

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

        if (_isFirstAppearance)
        {
            _isFirstAppearance = false;
            await _viewModel.LoadUtilitiesAsync();
            var names = _viewModel.Utilities.Select(u => u.Name).ToList();
            ServicioPicker.ItemsSource = names;
            if (names.Count > 0)
            {
                ServicioPicker.SelectedIndex = 0;
            }
        }
        else
        {
            await ReloadAsync();
        }
    }

    private async void OnServicioChanged(object? sender, EventArgs e)
    {
        if (ServicioPicker.SelectedIndex < 0)
        {
            return;
        }

        _viewModel.Service = (string)ServicioPicker.ItemsSource[ServicioPicker.SelectedIndex]!;
        DeadlineRow.IsVisible = !_viewModel.IsArriendo;
        ArriendoHintLabel.IsVisible = _viewModel.IsArriendo;
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

    private async void OnSaveDeadlineClicked(object? sender, EventArgs e)
    {
        ErrorLabel.IsVisible = false;
        var success = await _viewModel.SetDeadlineAsync(DeadlineDatePicker.Date ?? DateTime.Today);
        if (!success)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
        }
    }

    private async void OnAmountUnfocused(object? sender, FocusEventArgs e)
    {
        if (sender is Entry { BindingContext: AdminPagoEditRow row })
        {
            await SavePaymentAsync(row);
        }
    }

    private async void OnPaidToggled(object? sender, ToggledEventArgs e)
    {
        if (sender is Switch { BindingContext: AdminPagoEditRow row })
        {
            await SavePaymentAsync(row);
        }
    }

    private async Task SavePaymentAsync(AdminPagoEditRow row)
    {
        ErrorLabel.IsVisible = false;
        var success = await _viewModel.SetPaymentAsync(row.ApartmentId, row.Amount, row.Paid);
        if (!success)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
        }
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
            ErrorLabel.Text = "No se pudieron cargar los pagos.";
            ErrorLabel.IsVisible = true;
        }
        else if (_viewModel.IsEmpty)
        {
            EmptyLabel.IsVisible = true;
        }
        else
        {
            ItemsList.ItemsSource = _viewModel.Items.Select(r => new AdminPagoEditRow(r)).ToList();
            ItemsList.IsVisible = true;

            if (!_viewModel.IsArriendo)
            {
                var dueDate = _viewModel.Items[0].DueDate;
                DeadlineDatePicker.Date = dueDate >= DeadlineDatePicker.MinimumDate ? dueDate : DateTime.Today;
            }
        }
    }
}
