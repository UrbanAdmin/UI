using System.ComponentModel;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// 014-admin-pagos-first-tab: display rows for the Pagos card. All wording, ordering and totals come from
// AdminPagosMonthCard (Core, unit-tested); these classes only shape it for the bindable layouts in the XAML.

// One service name of the subtitle; the separator is part of the text so the flex row reads "Agua, Energía, Gas".
public record ServiceNameDisplay(string Text, bool IsPending);

public class PagoLineDisplay(AdminPagosServiceLine line)
{
    public string Utility { get; } = line.Utility;
    public string DeadlineText { get; } = line.DeadlineText;
    public string AmountDisplay { get; } = line.AmountDisplay;
    public string StatusLabel { get; } = line.StatusLabel;

    // "sin monto" and "Sin registrar" read as muted text; the chip kinds reuse the shared StatusChip colors.
    public bool AmountMuted { get; } = line.StatusKind == "placeholder" || line.AmountDisplay == "sin monto";

    public string ChipKind { get; } = line.StatusKind switch
    {
        "paid" => "paid",
        "pending" => "due-soon",
        _ => "not-due",
    };
}

public class ApartmentDisplay : INotifyPropertyChanged
{
    private bool _isExpanded;

    public ApartmentDisplay(AdminPagosApartmentRow row)
    {
        Title = row.Title;
        OwedDisplay = row.OwedDisplay;
        IsUpToDate = row.IsUpToDate;
        Services = row.Services
            .Select((s, i) => new ServiceNameDisplay(i < row.Services.Count - 1 ? $"{s.Name}, " : s.Name, s.IsPending))
            .ToList();
        Lines = row.Lines.Select(l => new PagoLineDisplay(l)).ToList();
    }

    public string Title { get; }
    public string OwedDisplay { get; }
    public bool IsUpToDate { get; }
    public IReadOnlyList<ServiceNameDisplay> Services { get; }
    public IReadOnlyList<PagoLineDisplay> Lines { get; }

    public bool IsExpanded
    {
        get => _isExpanded;
        set
        {
            if (_isExpanded == value)
            {
                return;
            }

            _isExpanded = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsExpanded)));
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
}

// 014-admin-pagos-first-tab: one page, two roles. As the first admin tab it shows the logout button in the
// header, has no back arrow and always opens on the current month; opened from a Cartera month
// ("AdminPagos?month=&year=") it starts on that month, shows a back arrow and the header "Editar" action.
// Read-only: amounts and deadlines are edited on AdminPagosEditPage (008-mobile-admin-views FR-005a/b).
public partial class AdminPagosPage : ContentPage, IQueryAttributable
{
    private readonly AdminPagosViewModel _viewModel;
    private readonly PagosMonthNavigator _navigator = new();
    private bool _isPushed;
    private bool _returningFromEdit;

    public AdminPagosPage(AdminPagosViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _navigator.Set(_viewModel.Month, _viewModel.Year);
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (!query.TryGetValue("month", out var rawMonth) || !query.TryGetValue("year", out var rawYear)
            || !int.TryParse(rawMonth?.ToString(), out var month) || !int.TryParse(rawYear?.ToString(), out var year)
            || month < 1 || month > 12)
        {
            return;
        }

        _isPushed = true;
        _navigator.Set(month, year);
        _viewModel.Month = _navigator.Month;
        _viewModel.Year = _navigator.Year;

        Header.Kicker = "Detalle del mes";
        Header.Title = "Pagos";
        Header.ShowLogout = false;
        Header.ShowBack = true;
        Header.ActionText = "Editar";
        EditButton.IsVisible = false;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        // The tab always opens on the current month, except when it is back from the edit screen
        // (which must stay on the period that was being edited).
        if (!_isPushed && !_returningFromEdit)
        {
            _viewModel.ResetToCurrentPeriod(DateTime.Now);
            _navigator.Set(_viewModel.Month, _viewModel.Year);
        }

        _returningFromEdit = false;
        await ReloadAsync();
    }

    private async void OnPreviousTapped(object? sender, TappedEventArgs e)
    {
        if (_navigator.Previous())
        {
            await MoveToNavigatorMonthAsync();
        }
    }

    private async void OnNextTapped(object? sender, TappedEventArgs e)
    {
        if (_navigator.Next())
        {
            await MoveToNavigatorMonthAsync();
        }
    }

    private async Task MoveToNavigatorMonthAsync()
    {
        _viewModel.Month = _navigator.Month;
        _viewModel.Year = _navigator.Year;
        await ReloadAsync();
    }

    private async void OnEditClicked(object? sender, EventArgs e)
    {
        _returningFromEdit = true;
        await Shell.Current.GoToAsync($"AdminPagosEdit?month={_viewModel.Month}&year={_viewModel.Year}");
    }

    private async void OnRetryClicked(object? sender, EventArgs e) => await ReloadAsync();

    private void OnApartmentTapped(object? sender, TappedEventArgs e)
    {
        if ((sender as BindableObject)?.BindingContext is ApartmentDisplay apartment)
        {
            apartment.IsExpanded = !apartment.IsExpanded;
        }
    }

    private async Task ReloadAsync()
    {
        RenderNavigator();
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ContentPanel.IsVisible = false;
        EmptyPanel.IsVisible = false;
        ErrorPanel.IsVisible = false;

        await _viewModel.LoadAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (_viewModel.HasError)
        {
            ErrorPanel.IsVisible = true;
            return;
        }

        if (_viewModel.IsEmpty)
        {
            EmptyLabel.Text = $"No hay pagos registrados para {_navigator.Label.ToLowerInvariant()}.";
            EmptyPanel.IsVisible = true;
            return;
        }

        var card = AdminPagosMonthCard.Build(_viewModel.Items, _viewModel.Month, _viewModel.Year);
        CardTitleLabel.Text = card.Title;
        CardSummaryLabel.Text = card.Summary;
        CardTotalLabel.Text = card.TotalDisplay;
        PendingDot.IsVisible = !card.AllUpToDate;
        UpToDateDot.IsVisible = card.AllUpToDate;
        BindableLayout.SetItemsSource(ApartmentList, card.Apartments.Select(a => new ApartmentDisplay(a)).ToList());
        ContentPanel.IsVisible = true;
    }

    private void RenderNavigator()
    {
        MonthLabel.Text = _navigator.Label;

        // At either end of the reachable range the arrow dims instead of doing nothing silently.
        PreviousButton.Opacity = _navigator.CanGoPrevious ? 1 : 0.35;
        NextButton.Opacity = _navigator.CanGoNext ? 1 : 0.35;
    }
}
