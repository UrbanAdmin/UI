namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors GET /tenant/alertas: the alerts newest first plus the number of payment alerts that need
// action (the Alertas tab badge).
public class AlertasModel
{
    public int NeedsActionCount { get; set; }
    public List<AlertaModel> Items { get; set; } = [];
}
