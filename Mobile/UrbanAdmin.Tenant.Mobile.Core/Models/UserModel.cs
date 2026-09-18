namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors the Backend's UserDto (specs/008-mobile-admin-views/data-model.md).
public class UserModel
{
    public long Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public long? ApartmentId { get; set; }
}
