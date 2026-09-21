using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// 013 slice C: create/edit form for one announcement. All rules and messages live in
// ComunicadoEditViewModel; this page copies the fields in, shows the messages and closes on success.
[QueryProperty(nameof(Comunicado), "Comunicado")]
public partial class ComunicadoEditPage : ContentPage
{
    private readonly ComunicadoEditViewModel _viewModel;

    public ComunicadoEditPage(ComunicadoEditViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
    }

    // Set by Shell navigation when editing (ComunicadosPage.OnEditClicked); null when creating.
    public ComunicadoModel? Comunicado
    {
        set
        {
            if (value is null)
            {
                return;
            }

            _viewModel.Load(value);
            TitleEntry.Text = value.Title;
            BodyEditor.Text = value.Body;
            Header.Title = "Editar comunicado";
            SaveButton.Text = "Guardar cambios";
        }
    }

    private async void OnSaveClicked(object? sender, EventArgs e)
    {
        _viewModel.Title = TitleEntry.Text ?? string.Empty;
        _viewModel.Body = BodyEditor.Text ?? string.Empty;

        SaveButton.IsEnabled = false;
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;

        var editing = _viewModel.IsEditing;
        var success = await _viewModel.SaveAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;
        SaveButton.IsEnabled = true;

        Show(TitleErrorLabel, _viewModel.TitleError);
        Show(BodyErrorLabel, _viewModel.BodyError);
        Show(ErrorLabel, _viewModel.ErrorMessage);

        if (!success)
        {
            return;
        }

        ComunicadosPage.PendingResult = editing ? "Cambios guardados" : "Comunicado publicado";
        await Shell.Current.GoToAsync("..");
    }

    private static void Show(Label label, string? message)
    {
        label.Text = message;
        label.IsVisible = !string.IsNullOrEmpty(message);
    }
}
