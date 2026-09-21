using System.ComponentModel;
using System.Globalization;
using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Cartera;

// Display-only rows for the timeline (012-cartera-vencida-timeline). All wording/number
// formatting comes from CarteraFormatting/CopCurrencyFormatter in Core; these classes only shape
// the models for the nested BindableLayouts in CarteraPage.xaml.
public abstract class ExpandableRow : INotifyPropertyChanged
{
    private bool _isExpanded;

    public string Key { get; init; } = string.Empty;

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
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs("PagosLinkVisible"));
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
}

public class CarteraMonthRow : ExpandableRow
{
    public int Month { get; init; }
    public int Year { get; init; }
    public string MonthLabel { get; init; } = string.Empty;
    public string TotalDisplay { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
    public string ServiciosLabel { get; init; } = string.Empty;
    public string ArriendoLabel { get; init; } = string.Empty;
    public Brush DotBrush { get; init; } = Brush.Transparent;
    public string PagosLinkText { get; init; } = string.Empty;
    public bool HasPagosLink { get; init; } = true;
    public bool PagosLinkVisible => IsExpanded && HasPagosLink;
    public string TagLabel { get; init; } = string.Empty;
    public bool HasTag => TagLabel.Length > 0;
    public string UpcomingLabel { get; init; } = string.Empty;
    public bool HasUpcoming { get; init; }
    public string EmptyNote { get; init; } = string.Empty;
    public bool HasEmptyNote => EmptyNote.Length > 0;
    public List<CarteraApartmentRow> Apartments { get; init; } = [];
}

public static class CarteraRowBuilder
{
    // colorOf resolves theme resource keys (Tertiary, Primary, ...) so no hex lives in code.
    public static List<CarteraMonthRow> Build(
        IEnumerable<CarteraMonthModel> months,
        IEnumerable<CarteraApartmentModel> apartmentModels,
        CarteraAnteriores? anteriores,
        ISet<string> expanded,
        Func<string, Color> colorOf)
    {
        var apartments = apartmentModels.ToDictionary(a => a.ApartmentId);
        var rows = months.Select(month => BuildMonth(month, apartments, expanded, colorOf)).ToList();
        if (anteriores is not null)
        {
            rows.Add(BuildAnteriores(anteriores, apartments, expanded, colorOf));
        }

        return rows;
    }

    public const string AnterioresKey = "anteriores";

    // The closing entry for overdue debt older than the listed range (FR-020): same look as a month,
    // a grey dot, a note that it is not part of the notice, no notify action and no Pagos link.
    private static CarteraMonthRow BuildAnteriores(
        CarteraAnteriores anteriores,
        IReadOnlyDictionary<long, CarteraApartmentModel> apartments,
        ISet<string> expanded,
        Func<string, Color> colorOf) =>
        new()
        {
            Key = AnterioresKey,
            IsExpanded = expanded.Contains(AnterioresKey),
            MonthLabel = "Anteriores",
            TotalDisplay = CopCurrencyFormatter.Format(anteriores.Total),
            Summary = CarteraFormatting.MonthSummary(anteriores.ChargeCount, anteriores.ApartmentCount),
            ServiciosLabel = CarteraFormatting.ServiciosLabel(anteriores.TotalServicios),
            ArriendoLabel = CarteraFormatting.ArriendoLabel(anteriores.TotalArriendo),
            TagLabel = CarteraFormatting.AnterioresChip(anteriores.FromYear),
            DotBrush = new SolidColorBrush(colorOf("Gray600")),
            HasPagosLink = false,
            EmptyNote = CarteraFormatting.AnterioresNote(anteriores.FromYear),
            Apartments = CarteraRowsBuilder.BuildAnterioresApartments(anteriores.Charges, apartments),
        };

    private static CarteraMonthRow BuildMonth(
        CarteraMonthModel month,
        IReadOnlyDictionary<long, CarteraApartmentModel> apartments,
        ISet<string> expanded,
        Func<string, Color> colorOf)
    {
        // Older overdue = deeper accent; ramp built only from existing theme keys.
        var dot = month.Charges.Count == 0
            ? colorOf("Gray300") // nothing overdue (only "por vencer", or an empty selected month)
            : CarteraRowsBuilder.SeverityOf(month) switch
            {
                MonthSeverity.Severe => colorOf("Tertiary"),
                MonthSeverity.Aging => colorOf("Primary"),
                _ => colorOf("PendingDark"),
            };

        return new CarteraMonthRow
        {
            Key = CarteraRowsBuilder.MonthKey(month.Year, month.Month),
            IsExpanded = expanded.Contains(CarteraRowsBuilder.MonthKey(month.Year, month.Month)),
            Month = month.Month,
            Year = month.Year,
            MonthLabel = CarteraFormatting.MonthLabel(month.Month, month.Year),
            TotalDisplay = CopCurrencyFormatter.Format(month.Total),
            Summary = CarteraFormatting.MonthOverdueSummary(month.ChargeCount, month.ApartmentCount),
            UpcomingLabel = CarteraFormatting.PorVencerLabel(month.UpcomingTotal),
            HasUpcoming = month.UpcomingCharges.Count > 0,
            ServiciosLabel = CarteraFormatting.ServiciosLabel(month.TotalServicios),
            ArriendoLabel = CarteraFormatting.ArriendoLabel(month.TotalArriendo),
            DotBrush = new SolidColorBrush(dot),
            PagosLinkText = $"Ver pagos de {CarteraFormatting.MonthName(month.Month).ToLowerInvariant()} →",
            Apartments = CarteraRowsBuilder.BuildApartments(month.Charges, apartments, month.UpcomingCharges),
            EmptyNote = month.Charges.Count == 0 && month.UpcomingCharges.Count == 0
                ? $"Sin cartera vencida en {CarteraFormatting.MonthName(month.Month).ToLowerInvariant()} {month.Year}."
                : string.Empty,
        };
    }
}

// 012-cartera-vencida-timeline US1-US3: the Cartera tab (flat month timeline, no year headings, no pickers). Reloads on every appearance so returning
// from the detailed Pagos screen (or its edit screen) shows fresh figures (FR-009).
public partial class CarteraPage : ContentPage
{
    private readonly CarteraViewModel _viewModel;
    private readonly HashSet<string> _expanded = [];
    private bool _defaultsApplied;
    private int _bannerVersion;

    public CarteraPage(CarteraViewModel viewModel)
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
        ErrorPanel.IsVisible = false;
        ContentPanel.IsVisible = false;

        await _viewModel.LoadAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;
        RenderState();
    }

    private void RenderState()
    {
        if (_viewModel.HasError)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorPanel.IsVisible = true;
            ContentPanel.IsVisible = false;
            return;
        }

        ErrorPanel.IsVisible = false;
        ContentPanel.IsVisible = true;

        var empty = _viewModel.IsEmpty;
        var selected = _viewModel.CurrentMonthEntry;
        var nothingThisMonth = _viewModel.CurrentMonthIsEmpty;
        var monthName = $"{CarteraFormatting.MonthName(selected.Month).ToLowerInvariant()} {selected.Year}";

        // The card belongs to the current month (FR-002): sage $0 when nothing is overdue in it.
        HeroBorder.BackgroundColor = ColorResource(nothingThisMonth ? "Accent2Deep" : "Tertiary");
        HeroKickerLabel.Text = $"Cartera vencida · {monthName}";
        HeroTotalLabel.Text = CopCurrencyFormatter.Format(selected.Total);
        HeroServiciosLabel.Text = CopCurrencyFormatter.Format(selected.TotalServicios);
        HeroArriendoLabel.Text = CopCurrencyFormatter.Format(selected.TotalArriendo);
        HeroSplit.IsVisible = !nothingThisMonth;
        HeroHintLabel.Text = nothingThisMonth
            ? $"Nada vencido en {monthName}."
            : CarteraFormatting.Summary(selected.ChargeCount, selected.ApartmentCount);

        HeroUpcomingBorder.IsVisible = _viewModel.CurrentMonthHasUpcoming;
        HeroUpcomingAmountLabel.Text = CopCurrencyFormatter.Format(selected.UpcomingTotal);
        HeroUpcomingCountLabel.Text = CarteraFormatting.Concepts(selected.UpcomingChargeCount);

        NotifyAllButton.IsEnabled = _viewModel.CanNotifyAll && !_viewModel.IsSending;
        EmptyPanel.IsVisible = empty;
        TimelineHeader.IsVisible = !empty;
        TimelineList.IsVisible = !empty;

        // Only the current month starts open; after that the administrator's own
        // expand/collapse choices survive reloads.
        if (!_defaultsApplied)
        {
            OpenCurrentMonth();
            _defaultsApplied = true;
        }

        BindableLayout.SetItemsSource(
            TimelineList,
            CarteraRowBuilder.Build(_viewModel.TimelineMonths, _viewModel.Cartera.Apartments, _viewModel.Anteriores, _expanded, ColorResource));
    }

    private void OpenCurrentMonth()
    {
        _expanded.Add(CarteraRowsBuilder.MonthKey(_viewModel.CurrentYear, _viewModel.CurrentMonth));
    }

    private async void OnRetryClicked(object? sender, EventArgs e) => await ReloadAsync();

    // 013 slice C: the administrator's announcements list (pushed, with a back arrow).
    private async void OnComunicadosClicked(object? sender, EventArgs e) => await Shell.Current.GoToAsync("Comunicados");

    private void OnMonthTapped(object? sender, TappedEventArgs e)
    {
        if (sender is BindableObject { BindingContext: CarteraMonthRow row })
        {
            Toggle(row);
        }
    }

    private void Toggle(ExpandableRow row)
    {
        row.IsExpanded = !row.IsExpanded;
        if (row.IsExpanded)
        {
            _expanded.Add(row.Key);
        }
        else
        {
            _expanded.Remove(row.Key);
        }
    }

    // US2: the existing admin Pagos screen, now a pushed route (registered in AppShell).
    private async void OnMonthPagosTapped(object? sender, TappedEventArgs e)
    {
        if (sender is BindableObject { BindingContext: CarteraMonthRow row })
        {
            await Shell.Current.GoToAsync(_viewModel.BuildPagosRoute(row.Month, row.Year));
        }
    }

    // US3: bulk notify - confirm with counts (and who already got a notice today), then send.
    private async void OnNotifyAllClicked(object? sender, EventArgs e)
    {
        var confirmed = await DisplayAlertAsync("¿Enviar notificación?", _viewModel.BuildBulkConfirmation(), "Enviar", "Cancelar");
        if (confirmed)
        {
            await RunNotifyAsync(_viewModel.NotifyAllAsync);
        }
    }

    // US3: one apartment - the confirmation names it and warns when it was already notified today.
    private async void OnNotifyApartmentClicked(object? sender, EventArgs e)
    {
        if (sender is not BindableObject { BindingContext: CarteraApartmentRow row })
        {
            return;
        }

        var confirmed = await DisplayAlertAsync(
            $"Notificar al apto {row.Number}",
            _viewModel.BuildApartmentConfirmation(row.ApartmentId),
            row.AlreadyNotifiedToday ? "Enviar de nuevo" : "Enviar",
            "Cancelar");
        if (confirmed)
        {
            await RunNotifyAsync(() => _viewModel.NotifyApartmentAsync(row.ApartmentId));
        }
    }

    private async Task RunNotifyAsync(Func<Task<CarteraNotifyOutcome>> send)
    {
        NotifyAllButton.IsEnabled = false;
        var outcome = await send();
        RenderState(); // the view model reloaded, so "ya se notificó hoy" is current
        await ShowBannerAsync(outcome);
    }

    private async Task ShowBannerAsync(CarteraNotifyOutcome outcome)
    {
        var version = ++_bannerVersion;
        ResultLabel.Text = outcome.Message;
        if (outcome.Success)
        {
            ResultBanner.SetAppThemeColor(Border.BackgroundColorProperty, ColorResource("SuccessBg"), ColorResource("SuccessBgDark"));
            ResultLabel.SetAppThemeColor(Label.TextColorProperty, ColorResource("Success"), ColorResource("SuccessDark"));
        }
        else
        {
            ResultBanner.SetAppThemeColor(Border.BackgroundColorProperty, ColorResource("PendingBg"), ColorResource("PendingBgDark"));
            ResultLabel.SetAppThemeColor(Label.TextColorProperty, ColorResource("Pending"), ColorResource("PendingDark"));
        }

        ResultBanner.IsVisible = true;
        await Task.Delay(4000);
        if (version == _bannerVersion)
        {
            ResultBanner.IsVisible = false;
        }
    }

    private static Color ColorResource(string key) =>
        Application.Current?.Resources.TryGetValue(key, out var value) == true && value is Color color
            ? color
            : Colors.Transparent;
}
