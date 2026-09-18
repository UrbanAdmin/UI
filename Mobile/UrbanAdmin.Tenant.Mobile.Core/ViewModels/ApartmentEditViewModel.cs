using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

public class ApartmentEditViewModel(IAdminApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    // Null means "creating a new apartment"; set means "editing this one" - mirrors how the
    // page decides which mode it's in.
    public long? ApartmentId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public DateTime? ContractStartDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ErrorMessage { get; private set; }
    public bool IsBusy { get; private set; }

    public async Task<bool> SaveAsync()
    {
        ErrorMessage = null;

        // research.md §9: client-side mirror of CreateApartmentHandler/UpdateApartmentHandler's
        // own validation, for immediate feedback - the Backend remains the source of truth for
        // everything else (its own Error string is what gets shown below).
        if (Status is not ("Arrendado" or "No arrendado"))
        {
            ErrorMessage = "El estado debe ser Arrendado o No arrendado.";
            return false;
        }

        if (Status == "Arrendado" && string.IsNullOrWhiteSpace(Owner))
        {
            ErrorMessage = "El propietario es obligatorio cuando el apartamento está arrendado.";
            return false;
        }

        IsBusy = true;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                ErrorMessage = "No se pudo guardar: sesión no válida.";
                return false;
            }

            var result = ApartmentId is long id
                ? await apiClient.UpdateApartmentAsync(token, id, Name, Owner, ContractStartDate, Status)
                : await apiClient.CreateApartmentAsync(token, Name, Owner, ContractStartDate, Status);

            if (!result.Success)
            {
                ErrorMessage = result.Error ?? "No se pudo guardar el apartamento.";
                return false;
            }

            return true;
        }
        catch
        {
            diagnostics.LogApiError("apartments", null);
            ErrorMessage = "No se pudo guardar. Verifica tu conexión e intenta de nuevo.";
            return false;
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task<bool> UploadContractAsync(Stream content, string fileName, string contentType)
    {
        if (ApartmentId is not long id)
        {
            return false;
        }

        IsBusy = true;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                ErrorMessage = "No se pudo subir el contrato: sesión no válida.";
                return false;
            }

            await apiClient.UploadContractAsync(token, id, fileName, contentType, content);
            return true;
        }
        catch
        {
            diagnostics.LogApiError("apartments", null);
            ErrorMessage = "No se pudo subir el contrato. Verifica tu conexión e intenta de nuevo.";
            return false;
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task<(byte[] Content, string ContentType, string FileName)?> DownloadContractAsync()
    {
        if (ApartmentId is not long id)
        {
            return null;
        }

        IsBusy = true;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                ErrorMessage = "No se pudo abrir el contrato: sesión no válida.";
                return null;
            }

            return await apiClient.DownloadContractAsync(token, id);
        }
        catch
        {
            diagnostics.LogApiError("apartments", null);
            ErrorMessage = "No se pudo abrir el contrato. Verifica tu conexión e intenta de nuevo.";
            return null;
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task<bool> DeleteAsync()
    {
        if (ApartmentId is not long id)
        {
            return false;
        }

        IsBusy = true;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                ErrorMessage = "No se pudo eliminar: sesión no válida.";
                return false;
            }

            await apiClient.DeleteApartmentAsync(token, id);
            return true;
        }
        catch
        {
            diagnostics.LogApiError("apartments", null);
            ErrorMessage = "No se pudo eliminar. Verifica tu conexión e intenta de nuevo.";
            return false;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
