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

        var isAgua = _viewModel.SelectedService == "Agua";
        AguaPillButton.BackgroundColor = isAgua ? accent2Deep : Colors.Transparent;
        AguaPillButton.TextColor = isAgua ? white : ink;
        GasPillButton.BackgroundColor = !isAgua ? accent2Deep : Colors.Transparent;
        GasPillButton.TextColor = !isAgua ? white : ink;

        GasPickersGrid.IsVisible = !isAgua;
        PeriodoBorder.IsVisible = isAgua;
    }

    private void RenderPickers()
    {
        if (_viewModel.SelectedService == "Gas")
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
        TotalLabel.Text = statement?.Total is string total ? CopCurrencyFormatter.Format(total) : string.Empty;

        BreakdownList.Children.Clear();
        foreach (var line in statement?.Breakdown ?? [])
        {
            BreakdownList.Children.Add(BuildBreakdownRow(line.Label, CopCurrencyFormatter.Format(line.Value)));
        }

        PreviousReadingLabel.Text = LecturasFormatting.FormatDecimal(statement?.PreviousReading);
        CurrentReadingLabel.Text = LecturasFormatting.FormatDecimal(statement?.CurrentReading);
        ConsumoLabel.Text = LecturasFormatting.FormatConsumption(statement?.Consumption, statement?.Unit);

        ShareLabel.Text = LecturasFormatting.FormatPercentage(statement?.Percentage);
        var pct = (double)Math.Min(100m, Math.Max(0m, ParsePercent(statement?.Percentage)));
        ShareBarTrack.ColumnDefinitions[0].Width = new GridLength(pct, GridUnitType.Star);
        ShareBarTrack.ColumnDefinitions[1].Width = new GridLength(100 - pct, GridUnitType.Star);
    }

    private static decimal ParsePercent(string? value) =>
        decimal.TryParse(value, out var parsed) ? parsed * 100 : 0m;

    private static View BuildBreakdownRow(string label, string value)
    {
        var grid = new Grid
        {
            ColumnDefinitions = [new ColumnDefinition(GridLength.Star), new ColumnDefinition(GridLength.Auto)],
            Margin = new Thickness(0, 6, 0, 0),
        };
        var labelView = new Label { Text = label, TextColor = Colors.White, Opacity = 0.75, FontSize = 13 };
        var valueView = new Label { Text = value, TextColor = Colors.White, FontAttributes = FontAttributes.Bold, FontSize = 13, HorizontalTextAlignment = TextAlignment.End };
        Grid.SetColumn(labelView, 0);
        Grid.SetColumn(valueView, 1);
        grid.Children.Add(labelView);
        grid.Children.Add(valueView);
        return grid;
    }
}
