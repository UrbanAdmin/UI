using System.Net;
using System.Text;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.Services;

// 013-tenant-pagos-alertas-redesign T011: the tenant client reads the new additive members of
// GET /tenant/pagos and the new GET /tenant/alertas and GET /tenant/perfil routes.
public class TenantApiClientTests
{
    private sealed class StubHandler(string json) : HttpMessageHandler
    {
        public HttpRequestMessage? Last { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Last = request;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            });
        }
    }

    private static (TenantApiClient Client, StubHandler Handler) Build(string json)
    {
        var handler = new StubHandler(json);
        return (new TenantApiClient(new HttpClient(handler) { BaseAddress = new Uri("https://api.test") }), handler);
    }

    [Fact]
    public async Task GetPagosAsync_ReadsTheAdditiveStatusPaidAtAndAmountValue()
    {
        var (client, _) = Build("""
            [{"utility":"Administración","amount":"420000","dueDate":"2026-09-05T00:00:00","paid":true,
              "status":"paid","paidAt":"2026-09-05T15:02:11Z","amountValue":420000.0},
             {"utility":"Gas","amount":null,"dueDate":"0001-01-01T00:00:00","paid":false,
              "status":"not-due","paidAt":null,"amountValue":null}]
            """);

        var pagos = await client.GetPagosAsync("jwt", 9, 2026);

        Assert.Equal(2, pagos.Count);
        Assert.Equal(("paid", 420000m), (pagos[0].Status, pagos[0].AmountValue));
        Assert.Equal(new DateTime(2026, 9, 5, 15, 2, 11, DateTimeKind.Utc), pagos[0].PaidAt);
        Assert.Null(pagos[1].PaidAt);
        Assert.Null(pagos[1].AmountValue);
    }

    [Fact]
    public async Task GetPagosAsync_AnOlderServerWithoutTheNewFieldsStillParses()
    {
        var (client, _) = Build("""[{"utility":"Agua","amount":"86400","dueDate":"2026-09-15T00:00:00","paid":false}]""");

        var pagos = await client.GetPagosAsync("jwt");

        var pago = Assert.Single(pagos);
        Assert.Equal(string.Empty, pago.Status);
        Assert.Null(pago.PaidAt);
        Assert.Null(pago.AmountValue);
    }

    [Fact]
    public async Task GetAlertasAsync_CallsTheAlertasRouteWithTheBearerTokenAndReadsEveryKind()
    {
        var (client, handler) = Build("""
            {"needsActionCount":2,"items":[
              {"kind":"payment","utility":"Energía","month":9,"year":2026,"dueDate":"2026-09-18T00:00:00",
               "amountValue":132900.0,"status":"due-soon","at":"2026-09-16T13:00:00Z"},
              {"kind":"announcement","id":4,"title":"Mantenimiento del ascensor","body":"Sábado de 8:00 a 12:00.",
               "at":"2026-09-15T20:10:00Z"},
              {"kind":"confirmation","utility":"Administración","month":9,"year":2026,"amountValue":null,
               "paidAt":"2026-09-05T15:02:11Z","at":"2026-09-05T15:02:11Z"}]}
            """);

        var result = await client.GetAlertasAsync("jwt");

        Assert.Equal("/tenant/alertas", handler.Last!.RequestUri!.AbsolutePath);
        Assert.Equal(HttpMethod.Get, handler.Last.Method);
        Assert.Equal("Bearer", handler.Last.Headers.Authorization!.Scheme);
        Assert.Equal("jwt", handler.Last.Headers.Authorization.Parameter);
        Assert.Equal(2, result.NeedsActionCount);
        Assert.Equal(["payment", "announcement", "confirmation"], result.Items.Select(i => i.Kind));
        Assert.Equal(("Energía", 9, "due-soon", 132900m), (result.Items[0].Utility, result.Items[0].Month, result.Items[0].Status, result.Items[0].AmountValue));
        Assert.Equal((4L, "Mantenimiento del ascensor"), (result.Items[1].Id, result.Items[1].Title));
        Assert.Null(result.Items[2].AmountValue);
        Assert.NotNull(result.Items[2].PaidAt);
    }

    [Fact]
    public async Task GetPerfilAsync_CallsThePerfilRoute()
    {
        var (client, handler) = Build("""{"apartmentNumber":"502","ownerName":"Laura Gómez"}""");

        var perfil = await client.GetPerfilAsync("jwt");

        Assert.Equal("/tenant/perfil", handler.Last!.RequestUri!.AbsolutePath);
        Assert.Equal(("502", "Laura Gómez"), (perfil.ApartmentNumber, perfil.OwnerName));
    }

    // ---- 015-fix-fingerprint-reopen: only a real rejection means "wrong password" -----------------------------------

    private sealed class StatusHandler(HttpStatusCode status, string body = "{}") : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }

    private static TenantApiClient WithStatus(HttpStatusCode status, string body = "{}") =>
        new(new HttpClient(new StatusHandler(status, body)) { BaseAddress = new Uri("https://api.test") });

    [Fact]
    public async Task LoginAsync_ReturnsTheTokenOnSuccess() =>
        Assert.Equal("jwt-token", await WithStatus(HttpStatusCode.OK, "{\"token\":\"jwt-token\"}").LoginAsync("u", "p"));

    [Theory]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.Unauthorized)]
    public async Task LoginAsync_ReturnsNullWhenTheServerRejectsTheCredentials(HttpStatusCode status) =>
        Assert.Null(await WithStatus(status).LoginAsync("u", "wrong"));

    [Theory]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.BadGateway)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData(HttpStatusCode.GatewayTimeout)]
    public async Task LoginAsync_ThrowsForAnyOtherFailureSoItIsNotReadAsAWrongPassword(HttpStatusCode status) =>
        await Assert.ThrowsAsync<HttpRequestException>(() => WithStatus(status).LoginAsync("u", "p"));
}
