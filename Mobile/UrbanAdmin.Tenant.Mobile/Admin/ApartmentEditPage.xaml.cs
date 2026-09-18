using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// 008-mobile-admin-views T018: create/edit form for a single apartment, including the
// contract file upload (research.md §8 - FilePicker + the ViewModel's UploadContractAsync).
[QueryProperty(nameof(Apartment), "Apartment")]
public partial class ApartmentEditPage : ContentPage
{
    private readonly ApartmentEditViewModel _viewModel;

    public ApartmentEditPage(ApartmentEditViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        StatusPicker.SelectedIndex = 0;
    }

    // Set by Shell navigation's query parameter (ApartmentsPage.OnApartmentSelected) when
    // editing; stays null when navigated to via "Agregar" (create mode).
    public ApartmentModel? Apartment
    {
        set
        {
            if (value is null)
            {
                return;
            }

            _viewModel.ApartmentId = value.Id;
            NameEntry.Text = value.Name;
            OwnerEntry.Text = value.Owner;
            StatusPicker.SelectedItem = value.Status;
            if (value.ContractStartDate is DateTime contractStartDate)
            {
                ContractStartDatePicker.Date = contractStartDate;
            }

            ContractStatusLabel.Text = value.HasContract ? $"Contrato: {value.ContractFileName}" : "Sin contrato";
            ViewContractButton.IsVisible = value.HasContract;
            DeleteButton.IsVisible = true;
        }
    }

    private async void OnSaveClicked(object? sender, EventArgs e)
    {
        _viewModel.Name = NameEntry.Text ?? string.Empty;
        _viewModel.Owner = OwnerEntry.Text ?? string.Empty;
        _viewModel.Status = StatusPicker.SelectedItem as string ?? string.Empty;
        _viewModel.ContractStartDate = ContractStartDatePicker.Date;

        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorLabel.IsVisible = false;

        var success = await _viewModel.SaveAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (!success)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
            return;
        }

        await Shell.Current.GoToAsync("..");
    }

    private async void OnDeleteClicked(object? sender, EventArgs e)
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorLabel.IsVisible = false;

        var success = await _viewModel.DeleteAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (!success)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
            return;
        }

        await Shell.Current.GoToAsync("..");
    }

    private async void OnUploadContractClicked(object? sender, EventArgs e)
    {
        if (_viewModel.ApartmentId is null)
        {
            ErrorLabel.Text = "Guarda el apartamento antes de subir el contrato.";
            ErrorLabel.IsVisible = true;
            return;
        }

        FileResult? file;
        try
        {
            file = await FilePicker.Default.PickAsync();
        }
        catch
        {
            return;
        }

        if (file is null)
        {
            return;
        }

        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorLabel.IsVisible = false;

        using var stream = await file.OpenReadAsync();
        var success = await _viewModel.UploadContractAsync(stream, file.FileName, file.ContentType ?? "application/octet-stream");

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (!success)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
            return;
        }

        ContractStatusLabel.Text = $"Contrato: {file.FileName}";
        ViewContractButton.IsVisible = true;
    }

    private async void OnViewContractClicked(object? sender, EventArgs e)
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorLabel.IsVisible = false;

        var download = await _viewModel.DownloadContractAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (download is null)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage ?? "No se pudo abrir el contrato.";
            ErrorLabel.IsVisible = true;
            return;
        }

        var (content, contentType, fileName) = download.Value;
        var path = Path.Combine(FileSystem.CacheDirectory, fileName);
        await File.WriteAllBytesAsync(path, content);

        await Launcher.Default.OpenAsync(new OpenFileRequest(fileName, new ReadOnlyFile(path, contentType)));
    }
}
