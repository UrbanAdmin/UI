using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// Display-only row: the announcement plus its short date ("20 sep") in the building's local time.
public record ComunicadoRow(string Title, string Body, string DateLabel, ComunicadoModel Comunicado);

// 013 slice C: the administrator's announcements list (view models in Core carry the logic; this page
// only maps rows, asks for the delete confirmation and shows the result line).
public partial class ComunicadosPage : ContentPage
{
    // Set by the edit page just before it closes so this page can say what happened ("Comunicado publicado").
    public static string? PendingResult { get; set; }

    private readonly ComunicadosViewModel _viewModel;
    private readonly ComunicadoEditViewModel _deleteViewModel;

    public ComunicadosPage(ComunicadosViewModel viewModel, ComunicadoEditViewModel deleteViewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _deleteViewModel = deleteViewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ReloadAsync();
        await ShowPendingResultAsync();
    }

    private async Task ReloadAsync()
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ItemsScroll.IsVisible = false;
        EmptyPanel.IsVisible = false;
        ErrorPanel.IsVisible = false;

        await _viewModel.LoadAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (_viewModel.HasError)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorPanel.IsVisible = true;
        }
        else if (_viewModel.IsEmpty)
        {
            EmptyPanel.IsVisible = true;
        }
        else
        {
            var today = TenantChargeFormatting.LocalDate(DateTime.UtcNow);
            BindableLayout.SetItemsSource(ItemsList, null);
            BindableLayout.SetItemsSource(ItemsList, _viewModel.Items
                .Select(c => new ComunicadoRow(
                    c.Title,
                    c.Body,
                    TenantChargeFormatting.ShortDate(TenantChargeFormatting.LocalDate(c.CreatedAt), today),
                    c))
                .ToList());
            ItemsScroll.IsVisible = true;
        }
    }

    private async Task ShowPendingResultAsync()
    {
        var message = PendingResult;
        PendingResult = null;
        if (string.IsNullOrEmpty(message))
        {
            return;
        }

        ResultLabel.Text = message;
        ResultBanner.IsVisible = true;
        await Task.Delay(3000);
        ResultBanner.IsVisible = false;
    }

    private async void OnAddClicked(object? sender, EventArgs e) => await Shell.Current.GoToAsync("ComunicadoEdit");

    private async void OnRetryClicked(object? sender, EventArgs e) => await ReloadAsync();

    private async void OnEditClicked(object? sender, EventArgs e)
    {
        if (sender is not BindableObject { BindingContext: ComunicadoRow row })
        {
            return;
        }

        await Shell.Current.GoToAsync("ComunicadoEdit", new Dictionary<string, object>
        {
            ["Comunicado"] = row.Comunicado,
        });
    }

    private async void OnDeleteClicked(object? sender, EventArgs e)
    {
        if (sender is not BindableObject { BindingContext: ComunicadoRow row })
        {
            return;
        }

        var confirmed = await DisplayAlertAsync(
            "¿Eliminar este comunicado?",
            "Se quita para todos los inquilinos y no se puede deshacer.",
            "Eliminar",
            "Cancelar");
        if (!confirmed)
        {
            return;
        }

        _deleteViewModel.ComunicadoId = row.Comunicado.Id;
        if (await _deleteViewModel.DeleteAsync())
        {
            PendingResult = "Comunicado eliminado";
            await ReloadAsync();
            await ShowPendingResultAsync();
        }
        else
        {
            await DisplayAlertAsync("No se pudo eliminar", _deleteViewModel.ErrorMessage ?? "Intenta de nuevo.", "Aceptar");
        }
    }
}
