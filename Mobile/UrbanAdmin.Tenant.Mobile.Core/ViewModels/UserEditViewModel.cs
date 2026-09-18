using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

public class UserEditViewModel(IAdminApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    // Null means "creating a new user"; set means "editing this one" - mirrors
    // ApartmentEditViewModel's ApartmentId convention.
    public long? UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? NewPassword { get; set; }
    public string Role { get; set; } = string.Empty;
    public long? ApartmentId { get; set; }
    public List<ApartmentModel> Apartments { get; private set; } = [];
    public string? ErrorMessage { get; private set; }
    public bool IsBusy { get; private set; }

    // Populates the apartment picker's options - matches Angular's user-dialog.component.ts,
    // which shows every apartment (not just Arrendado ones) and relies on the Backend's own
    // validation to reject a non-rented pick (research.md §9 / Angular parity).
    public async Task LoadApartmentsAsync()
    {
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                return;
            }

            Apartments = await apiClient.GetApartmentsAsync(token);
        }
        catch
        {
            diagnostics.LogApiError("apartments", null);
        }
    }

    public async Task<bool> SaveAsync()
    {
        ErrorMessage = null;

        // Mirrors Angular's user-dialog.component.ts canSave: a minimal gate (role is one of
        // the two valid values, an ApartmentOwner has an apartment picked, and create requires
        // username/password). No client-side "must be Arrendado" check - the Backend remains
        // the sole source of truth for that (matches the web app exactly).
        if (Role is not ("Admin" or "ApartmentOwner"))
        {
            ErrorMessage = "El rol debe ser Admin o Propietario.";
            return false;
        }

        if (Role == "ApartmentOwner" && ApartmentId is null)
        {
            ErrorMessage = "Debes asignar un apartamento.";
            return false;
        }

        if (UserId is null && (string.IsNullOrWhiteSpace(Username) || string.IsNullOrWhiteSpace(Password)))
        {
            ErrorMessage = "Usuario y contraseña son obligatorios.";
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

            var effectiveApartmentId = Role == "ApartmentOwner" ? ApartmentId : null;

            var result = UserId is long id
                ? await apiClient.UpdateUserAsync(token, id, Role, effectiveApartmentId, string.IsNullOrWhiteSpace(NewPassword) ? null : NewPassword)
                : await apiClient.CreateUserAsync(token, Username, Password, Role, effectiveApartmentId);

            if (!result.Success)
            {
                ErrorMessage = result.Error ?? "No se pudo guardar el usuario.";
                return false;
            }

            return true;
        }
        catch
        {
            diagnostics.LogApiError("users", null);
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
        if (UserId is not long id)
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

            await apiClient.DeleteUserAsync(token, id);
            return true;
        }
        catch
        {
            diagnostics.LogApiError("users", null);
            ErrorMessage = "No se pudo eliminar. Verifica tu conexión e intenta de nuevo.";
            return false;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
