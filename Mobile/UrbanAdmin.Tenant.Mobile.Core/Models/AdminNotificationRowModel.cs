namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors the new AdminNotificationDto (specs/008-mobile-admin-views/research.md §1) - the
// live outstanding-dues scan, already filtered server-side to overdue/due-today/due-soon rows
// only (Paid is always false here; Status is never "paid"/"not-due").
public class AdminNotificationRowModel
{
    public long ApartmentId { get; set; }
    public string ApartmentNumber { get; set; } = string.Empty;
    public string? Owner { get; set; }
    public string Service { get; set; } = string.Empty;
    public int Month { get; set; }
    public int Year { get; set; }
    public DateTime DueDate { get; set; }
    public bool Paid { get; set; }
    public string? Amount { get; set; }
    public string Status { get; set; } = string.Empty;
}
