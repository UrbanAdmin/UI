using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 013-tenant-pagos-alertas-redesign T018: the redesigned tenant Pagos view model - month navigator,
// the "Pendiente este mes" summary, the timeline rows and the header kicker. Still strictly read-only.
public class PagosViewModelTimelineTests
{
    // Colombian date 2026-09-16.
    private static readonly Func<DateTime> Clock = () => new DateTime(2026, 9, 16, 10, 0, 0);

    private static PagoModel Row(string utility, decimal? amount, bool paid, string status, DateTime? due = null, DateTime? paidAt = null) =>
        new()
        {
            Utility = utility,
            Amount = amount?.ToString(),
            AmountValue = amount,
            Paid = paid,
            Status = status,
            DueDate = due ?? default,
            PaidAt = paidAt,
        };

    // Administración paid 5 sep; Agua overdue; Energía due in 2 days; Gas pending: 3 concepts, $260.500.
    private static List<PagoModel> September() =>
    [
        Row("Administración", 420000m, true, "paid", new DateTime(2026, 9, 5), new DateTime(2026, 9, 5, 15, 0, 0, DateTimeKind.Utc)),
        Row("Agua", 86400m, false, "overdue", new DateTime(2026, 9, 15)),
        Row("Energía", 132900m, false, "due-soon", new DateTime(2026, 9, 18)),
        Row("Gas", 41200m, false, "not-due", new DateTime(2026, 9, 20)),
    ];

    private static async Task<(PagosViewModel Vm, FakeTenantApiClient Api)> Build(List<PagoModel>? pagos = null, PerfilModel? perfil = null)
    {
        var api = new FakeTenantApiClient
        {
            Pagos = pagos ?? September(),
            Perfil = perfil ?? new PerfilModel { ApartmentNumber = "502", OwnerName = "Laura Gómez" },
        };
        var tokens = new FakeTokenStore();
        await tokens.SaveTokenAsync("jwt");
        return (new PagosViewModel(api, tokens, new FakeCrashDiagnosticsService(), Clock), api);
    }

    // ---- summary ------------------------------------------------------------------------------

    [Fact]
    public async Task Summary_SumsTheUnpaidAmounts_AndCountsTheUnpaidConcepts()
    {
        var (vm, _) = await Build();
        await vm.LoadAsync();

        Assert.Equal(260500m, vm.PendingTotal);
        Assert.Equal("$260.500", vm.PendingTotalDisplay);
        Assert.Equal(3, vm.PendingCount);
        Assert.Equal("3 conceptos por pagar", vm.SummaryHint);
        Assert.False(vm.IsUpToDate);
    }

    [Fact]
    public async Task Summary_SingularForOneConcept()
    {
        var (vm, _) = await Build([Row("Agua", 86400m, false, "overdue", new DateTime(2026, 9, 15))]);
        await vm.LoadAsync();

        Assert.Equal("1 concepto por pagar", vm.SummaryHint);
    }

    [Fact]
    public async Task Summary_ANullAmountAddsZeroButStillCountsAsAConcept()
    {
        var (vm, _) = await Build([Row("Agua", 86400m, false, "overdue"), Row("Gas", null, false, "not-due")]);
        await vm.LoadAsync();

        Assert.Equal(86400m, vm.PendingTotal);
        Assert.Equal(2, vm.PendingCount);
    }

    [Fact]
    public async Task Summary_EverythingPaidShowsZeroAndUpToDate()
    {
        var (vm, _) = await Build([Row("Agua", 86400m, true, "paid"), Row("Gas", 41200m, true, "paid")]);
        await vm.LoadAsync();

        Assert.Equal(0m, vm.PendingTotal);
        Assert.Equal("$0", vm.PendingTotalDisplay);
        Assert.True(vm.IsUpToDate);
        Assert.Equal("Estás al día este mes.", vm.SummaryHint);
    }

    [Fact]
    public async Task Summary_NoChargesAtAllIsAlsoUpToDate_AndEmpty()
    {
        var (vm, _) = await Build([]);
        await vm.LoadAsync();

        Assert.True(vm.IsUpToDate);
        Assert.True(vm.IsEmpty);
        Assert.Equal("Estás al día este mes.", vm.SummaryHint);
    }

    // ---- timeline rows ------------------------------------------------------------------------

    [Fact]
    public async Task Rows_CarryTheDateLineChipAndAmountOfEachCharge_InTheServerOrder()
    {
        var (vm, _) = await Build();
        await vm.LoadAsync();

        Assert.Equal(["Administración", "Agua", "Energía", "Gas"], vm.Rows.Select(r => r.Utility));
        Assert.Equal(["PAGADO EL 5 SEP", "VENCE EL 15 SEP", "VENCE EL 18 SEP", "VENCE EL 20 SEP"], vm.Rows.Select(r => r.DateLine));
        Assert.Equal(["Pagado", "Vencido", "Vence en 2 días", "Pendiente"], vm.Rows.Select(r => r.StatusLabel));
        Assert.Equal(["paid", "overdue", "due-soon", "not-due"], vm.Rows.Select(r => r.StatusKind));
        Assert.Equal(["$420.000", "$86.400", "$132.900", "$41.200"], vm.Rows.Select(r => r.AmountDisplay));
    }

    [Fact]
    public async Task Rows_APaidChargeWithoutADateIsJustPagado_AndOneWithoutAnAmountSaysSinMonto()
    {
        var (vm, _) = await Build([
            Row("Agua", 86400m, true, "paid", new DateTime(2026, 9, 15), null),
            Row("Gas", null, false, "not-due", null),
        ]);
        await vm.LoadAsync();

        Assert.Equal("PAGADO", vm.Rows[0].DateLine);
        Assert.Equal("SIN FECHA LÍMITE", vm.Rows[1].DateLine);
        Assert.Equal("sin monto", vm.Rows[1].AmountDisplay);
        Assert.True(vm.Rows[1].AmountMissing);
        Assert.False(vm.Rows[0].AmountMissing);
    }

    [Fact]
    public async Task Rows_AnOlderServerWithoutStatusStillGetsAChip()
    {
        var (vm, _) = await Build([Row("Agua", 86400m, true, string.Empty), Row("Gas", 41200m, false, string.Empty)]);
        await vm.LoadAsync();

        Assert.Equal(["paid", "not-due"], vm.Rows.Select(r => r.StatusKind));
        Assert.Equal(["Pagado", "Pendiente"], vm.Rows.Select(r => r.StatusLabel));
    }

    // ---- month navigation ------------------------------------------------------------------------

    [Fact]
    public async Task TheMonthLabelAndDefaultPeriodComeFromTheClock()
    {
        var (vm, _) = await Build();

        Assert.Equal("Septiembre 2026", vm.MonthLabel);
        Assert.Equal((9, 2026), (vm.Month, vm.Year));
    }

    [Fact]
    public async Task MovingTheNavigatorAndReloadingAsksTheApiForThatMonth()
    {
        var (vm, api) = await Build();

        vm.Navigator.Previous();
        await vm.LoadAsync();

        Assert.Equal((8, 2026), api.LastGetPagosArgs);
        Assert.Equal("Agosto 2026", vm.MonthLabel);
    }

    // ---- header -------------------------------------------------------------------------------------

    [Fact]
    public async Task TheHeaderKickerComesFromThePerfil_AndIsLoadedOnlyOnce()
    {
        var (vm, api) = await Build();

        await vm.LoadAsync();
        await vm.LoadAsync();

        Assert.Equal("APTO 502 · LAURA GÓMEZ", vm.HeaderKicker);
        Assert.Equal(1, api.GetPerfilCallCount);
    }

    [Fact]
    public async Task AFailingPerfilNeverBreaksThePage_TheKickerIsJustEmpty()
    {
        var (vm, api) = await Build();
        api.ThrowOnPerfil = true;

        await vm.LoadAsync();

        Assert.False(vm.HasError);
        Assert.Equal(string.Empty, vm.HeaderKicker);
        Assert.Equal(4, vm.Rows.Count);
    }

    // ---- states -------------------------------------------------------------------------------------

    [Fact]
    public async Task AFailedLoadKeepsTheSpanishMessages_AndNoStaleRows()
    {
        var (vm, api) = await Build();
        await vm.LoadAsync();

        api.ThrowOnGet = true;
        api.ThrowStatusCode = System.Net.HttpStatusCode.Forbidden;
        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal("Tu cuenta fue desactivada. Contacta a tu administrador.", vm.ErrorMessage);
    }
}
