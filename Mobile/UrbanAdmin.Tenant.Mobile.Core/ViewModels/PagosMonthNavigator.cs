using UrbanAdmin.Tenant.Mobile.Core.Formatting;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// 013-tenant-pagos-alertas-redesign: the previous/next arrows of the tenant Pagos. One month per step,
// across year boundaries, inside the range the tenant could already reach with the old pickers
// (January of currentYear-3 through December of currentYear+1); the arrows report the ends so the page
// can disable them instead of doing nothing silently (FR-002). The clock is injectable.
public class PagosMonthNavigator
{
    private readonly Func<DateTime> _today;
    private int _index;

    public PagosMonthNavigator(Func<DateTime>? today = null)
    {
        _today = today ?? (() => DateTime.Now);
        var now = _today();
        _index = IndexOf(now.Month, now.Year);
    }

    public int Month => (_index % 12) + 1;
    public int Year => _index / 12;
    public string Label => $"{CarteraFormatting.MonthName(Month)} {Year}";

    public bool CanGoPrevious => _index > MinIndex;
    public bool CanGoNext => _index < MaxIndex;

    public bool Previous()
    {
        if (!CanGoPrevious)
        {
            return false;
        }

        _index--;
        return true;
    }

    public bool Next()
    {
        if (!CanGoNext)
        {
            return false;
        }

        _index++;
        return true;
    }

    // Jumps to a month; one outside the reachable range is clamped to the nearest end.
    public void Set(int month, int year) => _index = Math.Clamp(IndexOf(month, year), MinIndex, MaxIndex);

    private int MinIndex => IndexOf(1, _today().Year - 3);

    private int MaxIndex => IndexOf(12, _today().Year + 1);

    private static int IndexOf(int month, int year) => (year * 12) + (month - 1);
}
