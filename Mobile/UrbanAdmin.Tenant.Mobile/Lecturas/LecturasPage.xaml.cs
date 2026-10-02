using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Lecturas;

// 029-tenant-mobile-lecturas: all wording, figures and state come from LecturasViewModel / Core
// (unit-tested); this page only maps them onto the approved layout. Strictly read-only (FR-008-
// equivalent) - the only gestures are the service pills, the two pickers, and the header logout.
public partial class LecturasPage : ContentPage
{
    private readonly LecturasViewModel _viewModel;

    // Guards the picker SelectedIndexChanged handlers against firing (and causing a reload loop)
    // while RenderState() itself is setting ItemsSource/SelectedIndex programmatically.
    private bool _isRendering;

    public LecturasPage(LecturasViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        MonthPicker.ItemsSource = Enumerable.Range(1, 12).Select(CarteraFormatting.MonthName).ToList();
        var currentYear = DateTime.Now.Year;
        YearPicker.ItemsSource = Enumerable.Range(currentYear - 1, 7).Select(y => y.ToString()).ToList();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ReloadAsync();
    }

    private async void OnAguaTapped(object? sender, EventArgs e)
    {
        if (_viewModel.SelectedService == "Agua")
        {
            return;
        }
        _viewModel.SelectedService = "Agua";
        await ReloadAsync();
    }

    private async void OnLuzTapped(object? sender, EventArgs e)
    {
        if (_viewModel.SelectedService == "Luz")
        {
            return;
        }
        _viewModel.SelectedService = "Luz";
        await ReloadAsync();
    }

    private async void OnGasTapped(object? sender, EventArgs e)
    {
        if (_viewModel.SelectedService == "Gas")
        {
            return;
        }
        _viewModel.SelectedService = "Gas";
        await ReloadAsync();
    }

    private async void OnMonthChanged(object? sender, EventArgs e)
    {
        if (_isRendering || MonthPicker.SelectedIndex < 0)
        {
            return;
        }
        _viewModel.Month = MonthPicker.SelectedIndex + 1;
        await ReloadAsync();
    }

    private async void OnYearChanged(object? sender, EventArgs e)
    {
        if (_isRendering || YearPicker.SelectedItem is not string yearText)
        {
            return;
        }
        _viewModel.Year = int.Parse(yearText);
        await ReloadAsync();
    }

    private async void OnPeriodoChanged(object? sender, EventArgs e)
    {
        if (_isRendering || PeriodoPicker.SelectedIndex < 0 || PeriodoPicker.SelectedIndex >= _viewModel.Periods.Count)
        {
            return;
        }
        _viewModel.SelectedPeriodId = _viewModel.Periods[PeriodoPicker.SelectedIndex].Id;
        await ReloadAsync();
    }

    private async void OnRetryClicked(object? sender, EventArgs e) => await ReloadAsync();

    private async Task ReloadAsync()
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorPanel.IsVisible = false;
        EmptyPanel.IsVisible = false;
        ContentPanel.IsVisible = false;

        await _viewModel.LoadAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;
        RenderState();
    }

    private void RenderState()
    {
        _isRendering = true;
        try
        {
            Header.Kicker = _viewModel.HeaderKicker;
            RenderPills();
            RenderPickers();

            if (_viewModel.HasError)
            {
                ErrorLabel.Text = _viewModel.ErrorMessage;
                ErrorPanel.IsVisible = true;
                return;
            }

            if (_viewModel.IsEmpty)
            {
                EmptyLabel.Text = $"Aún no hay lectura de {_viewModel.SelectedService} para {_viewModel.PeriodLabel}.";
                EmptyPanel.IsVisible = true;
                return;
            }

            ContentPanel.IsVisible = true;
            RenderStatement();
        }
        finally
        {
            _isRendering = false;
        }
    }

    private void RenderPills()
    {
        var resources = Application.Current!.Resources;
        var accent2Deep = (Color)resources["Accent2Deep"];
        var white = (Color)resources["White"];
        var ink = (Color)resources["Ink"];

        SetPillState(AguaPillButton, _viewModel.SelectedService == "Agua", accent2Deep, white, ink);
        SetPillState(LuzPillButton, _viewModel.SelectedService == "Luz", accent2Deep, white, ink);
        SetPillState(GasPillButton, _viewModel.SelectedService == "Gas", accent2Deep, white, ink);

        var isAgua = _viewModel.SelectedService == "Agua";
        MesAnoPickersGrid.IsVisible = !isAgua; // Gas and Luz both use the plain Mes/Año pair.
        PeriodoBorder.IsVisible = isAgua;
    }

    private static void SetPillState(Button button, bool isSelected, Color accent2Deep, Color white, Color ink)
    {
        button.BackgroundColor = isSelected ? accent2Deep : Colors.Transparent;
        button.TextColor = isSelected ? white : ink;
    }

    private void RenderPickers()
    {
        if (_viewModel.SelectedService != "Agua")
        {
            MonthPicker.SelectedIndex = _viewModel.Month - 1;
            var yearIndex = ((List<string>)YearPicker.ItemsSource).IndexOf(_viewModel.Year.ToString());
            YearPicker.SelectedIndex = yearIndex;
            return;
        }

        var labels = _viewModel.Periods
            .Select(p => $"{LecturasFormatting.FormatPeriodRange(p.StartDate, p.EndDate)} · {(p.Confirmed ? "Confirmado" : "Sin confirmar")}")
            .ToList();
        PeriodoPicker.ItemsSource = labels;
        var selectedIndex = _viewModel.Periods.FindIndex(p => p.Id == _viewModel.SelectedPeriodId);
        PeriodoPicker.SelectedIndex = selectedIndex;
    }

    private void RenderStatement()
    {
        var statement = _viewModel.Statement;
        // No breakdown line items shown - per explicit user request (2026-10-01). LecturasModel
        // still carries Breakdown (Backend/ViewModel unchanged); this page simply doesn't render it.
        TotalLabel.Text = statement?.Total is string total ? CopCurrencyFormatter.Format(total) : string.Empty;

        // Luz's legacy pipeline has no previous reading and no consumption delta - hide those
        // sub-parts entirely rather than show a blank arrow or an empty chip.
        var hasPreviousReading = !string.IsNullOrEmpty(statement?.PreviousReading);
        PreviousReadingLabel.IsVisible = hasPreviousReading;
        ArrowLabel.IsVisible = hasPreviousReading;
        PreviousReadingLabel.Text = LecturasFormatting.FormatDecimal(statement?.PreviousReading);
        CurrentReadingLabel.Text = LecturasFormatting.FormatDecimal(statement?.CurrentReading);

        var hasConsumption = !string.IsNullOrEmpty(statement?.Consumption);
        ConsumoChipBorder.IsVisible = hasConsumption;
        ConsumoLabel.Text = LecturasFormatting.FormatConsumption(statement?.Consumption, statement?.Unit);

        // No percentage exists for Luz at all - the whole share card disappears rather than
        // showing an empty "0%"/zero-width bar.
        var hasPercentage = !string.IsNullOrEmpty(statement?.Percentage);
        ShareCardBorder.IsVisible = hasPercentage;
        if (hasPercentage)
        {
            ShareLabel.Text = LecturasFormatting.FormatPercentage(statement?.Percentage);
            var pct = (double)Math.Min(100m, Math.Max(0m, ParsePercent(statement?.Percentage)));
            ShareBarTrack.ColumnDefinitions[0].Width = new GridLength(pct, GridUnitType.Star);
            ShareBarTrack.ColumnDefinitions[1].Width = new GridLength(100 - pct, GridUnitType.Star);
        }
    }

    private static decimal ParsePercent(string? value) =>
        decimal.TryParse(value, out var parsed) ? parsed * 100 : 0m;
}
