namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors an item of GET /admin/comunicados (the administrator's announcements list).
public class ComunicadoModel
{
    public long Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
