using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 013 slice C (T056, FR-012, FR-015): the administrator's announcements list.
public class ComunicadosViewModelTests
{
    private static async Task<(FakeAdminApiClient Api, ComunicadosViewModel Vm)> Build(bool signedIn = true)
    {
        var api = new FakeAdminApiClient();
        var tokens = new FakeTokenStore();
        if (signedIn)
        {
            await tokens.SaveTokenAsync("admin-jwt");
        }

        return (api, new ComunicadosViewModel(api, tokens, new FakeCrashDiagnosticsService()));
    }

    [Fact]
    public async Task LoadAsync_ShowsTheAnnouncementsInTheOrderTheServerSent()
    {
        var (api, vm) = await Build();
        api.Comunicados =
        [
            new ComunicadoModel { Id = 2, Title = "Nueva", Body = "b", CreatedAt = new DateTime(2026, 9, 20) },
            new ComunicadoModel { Id = 1, Title = "Vieja", Body = "a", CreatedAt = new DateTime(2026, 9, 2) },
        ];

        await vm.LoadAsync();

        Assert.Equal(["Nueva", "Vieja"], vm.Items.Select(i => i.Title));
        Assert.False(vm.IsEmpty);
        Assert.False(vm.HasError);
        Assert.False(vm.IsBusy);
    }

    [Fact]
    public async Task LoadAsync_WithNoAnnouncements_IsEmpty()
    {
        var (_, vm) = await Build();

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_WhenTheApiFails_ShowsTheSpanishErrorAndIsNotEmpty()
    {
        var (api, vm) = await Build();
        api.ThrowOnGetComunicados = true;

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal("No se pudieron cargar los comunicados. Verifica tu conexión e intenta de nuevo.", vm.ErrorMessage);
        Assert.False(vm.IsEmpty);
        Assert.False(vm.IsBusy);
    }

    [Fact]
    public async Task LoadAsync_WithoutASession_IsAnError()
    {
        var (_, vm) = await Build(signedIn: false);

        await vm.LoadAsync();

        Assert.True(vm.HasError);
    }

    [Fact]
    public async Task LoadAsync_ARetryAfterAFailureClearsTheError()
    {
        var (api, vm) = await Build();
        api.ThrowOnGetComunicados = true;
        await vm.LoadAsync();
        api.ThrowOnGetComunicados = false;
        api.Comunicados = [new ComunicadoModel { Id = 1, Title = "Aviso", Body = "x" }];

        await vm.LoadAsync();

        Assert.False(vm.HasError);
        Assert.Single(vm.Items);
    }
}
