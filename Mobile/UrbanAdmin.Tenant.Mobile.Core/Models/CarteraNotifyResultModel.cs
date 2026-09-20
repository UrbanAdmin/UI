namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Body of POST /admin/cartera/notificar's 200. UnreachableApartments = Requested - Notified
// (vacant / no active owner); "nobody reachable" is a normal result, not an error.
public class CarteraNotifyResultModel
{
    public int RequestedApartments { get; set; }
    public int NotifiedApartments { get; set; }
    public int UnreachableApartments { get; set; }
    public DateTime NotifiedAt { get; set; }
}
