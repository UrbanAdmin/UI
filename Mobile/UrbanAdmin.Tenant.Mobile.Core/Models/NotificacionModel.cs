namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors GET /tenant/notificaciones's response shape (contracts/tenant-api.md).
public class NotificacionModel
{
    public string Utility { get; set; } = string.Empty;
    public string? Amount { get; set; }
    public DateTime DueDate { get; set; }
    public string Stage { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
}
