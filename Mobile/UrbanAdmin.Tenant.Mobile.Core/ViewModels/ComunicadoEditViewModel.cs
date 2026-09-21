using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// 013-tenant-pagos-alertas-redesign slice C: create, edit or delete one announcement. Null
// ComunicadoId means "creating"; the client validates like the server (title 1-80, message 1-1000
// after trimming) so the administrator sees what to fix before anything is sent, and a server 400
// message is still shown as is.
public class ComunicadoEditViewModel(IAdminApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    public const int MaxTitleLength = 80;
    public const int MaxBodyLength = 1000;

    public long? ComunicadoId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? TitleError { get; private set; }
    public string? BodyError { get; private set; }
    public string? ErrorMessage { get; private set; }
    public bool IsBusy { get; private set; }

    public bool IsEditing => ComunicadoId is not null;

    public void Load(ComunicadoModel comunicado)
    {
        ComunicadoId = comunicado.Id;
        Title = comunicado.Title;
        Body = comunicado.Body;
        TitleError = null;
        BodyError = null;
        ErrorMessage = null;
    }

    public async Task<bool> SaveAsync()
    {
        TitleError = null;
        BodyError = null;
        ErrorMessage = null;

        var title = (Title ?? string.Empty).Trim();
        var body = (Body ?? string.Empty).Trim();

        if (title.Length == 0)
        {
            TitleError = "El título es obligatorio.";
        }
        else if (title.Length > MaxTitleLength)
        {
            TitleError = $"El título no puede superar {MaxTitleLength} caracteres.";
        }

        if (body.Length == 0)
        {
            BodyError = "El mensaje es obligatorio.";
        }
        else if (body.Length > MaxBodyLength)
        {
            BodyError = $"El mensaje no puede superar {MaxBodyLength} caracteres.";
        }

        if (TitleError is not null || BodyError is not null)
        {
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

            var result = ComunicadoId is long id
                ? await apiClient.UpdateComunicadoAsync(token, id, title, body)
                : await apiClient.CreateComunicadoAsync(token, title, body);

            if (!result.Success)
            {
                ErrorMessage = result.Error ?? "No se pudo guardar el comunicado.";
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("comunicados", ex.ToApiStatusCode());
            ErrorMessage = "No se pudo guardar. Verifica tu conexión e intenta de nuevo.";
            return false;
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task<bool> DeleteAsync()
    {
        if (ComunicadoId is not long id)
        {
            return false;
        }

        ErrorMessage = null;
        IsBusy = true;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                ErrorMessage = "No se pudo eliminar: sesión no válida.";
                return false;
            }

            await apiClient.DeleteComunicadoAsync(token, id);
            return true;
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("comunicados", ex.ToApiStatusCode());
            ErrorMessage = "No se pudo eliminar. Verifica tu conexión e intenta de nuevo.";
            return false;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
