namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors GET /tenant/perfil: what the tenant screens' header shows ("APTO 502 · LAURA GÓMEZ").
// Either value may be empty.
public class PerfilModel
{
    public string? ApartmentNumber { get; set; }
    public string? OwnerName { get; set; }
}
