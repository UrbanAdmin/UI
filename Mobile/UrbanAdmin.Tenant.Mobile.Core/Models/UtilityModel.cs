namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors the Backend's Utilities entity - just enough to populate the admin Payments edit
// screen's Servicio picker (specs/008-mobile-admin-views, Phase 6b).
public class UtilityModel
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
