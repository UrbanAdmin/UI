namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors CarteraApartmentDto - the per-apartment roll-up the notify actions are driven by.
// CanNotify/CannotNotifyReason and NotifiedToday/LastNotifiedAt are decided server-side.
public class CarteraApartmentModel
{
    public long ApartmentId { get; set; }
    public string ApartmentNumber { get; set; } = string.Empty;
    public string? Owner { get; set; }
    public int ChargeCount { get; set; }
    public decimal Total { get; set; }
    public bool CanNotify { get; set; }
    public string? CannotNotifyReason { get; set; }
    public DateTime? LastNotifiedAt { get; set; }
    public bool NotifiedToday { get; set; }
}
