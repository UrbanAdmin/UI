using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

public class UsersViewModel(IAdminApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    public List<UserModel> Items { get; private set; } = [];

    // Loaded alongside Items purely for the list's apartment-number display join, matching
    // Angular's manage-users.component.ts (apartmentNumber()).
    public List<ApartmentModel> Apartments { get; private set; } = [];
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }

    public bool IsEmpty => !IsBusy && !HasError && Items.Count == 0;

    public async Task LoadAsync()
    {
        IsBusy = true;
        HasError = false;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                HasError = true;
                return;
            }

            Items = await apiClient.GetUsersAsync(token);
            Apartments = await apiClient.GetApartmentsAsync(token);
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("users", ex.ToApiStatusCode());
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
