using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.Services;

public class JwtClaimsReaderTests
{
    // A real JWT has three base64url segments separated by '.'; only the payload
    // (middle segment) matters here since GetUserId only ever reads that segment.
    private static string MakeToken(string payloadJson)
    {
        var payload = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(payloadJson))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return $"header.{payload}.signature";
    }

    [Fact]
    public void GetUserId_ReturnsTheSubClaim()
    {
        var token = MakeToken("""{"sub":"42","name":"owner101"}""");

        var userId = JwtClaimsReader.GetUserId(token);

        Assert.Equal("42", userId);
    }

    [Fact]
    public void GetUserId_ReturnsNullWhenSubClaimIsMissing()
    {
        var token = MakeToken("""{"name":"owner101"}""");

        var userId = JwtClaimsReader.GetUserId(token);

        Assert.Null(userId);
    }

    [Fact]
    public void GetUserId_ReturnsNullForAMalformedToken()
    {
        var userId = JwtClaimsReader.GetUserId("not-a-jwt");

        Assert.Null(userId);
    }

    // The Backend's JwtTokenGenerator uses JsonWebTokenHandler, which (unlike the older
    // JwtSecurityTokenHandler) writes claims using their .NET Claim.Type string as-is -
    // no automatic short-name mapping. ClaimTypes.Role's actual JSON key is therefore the
    // full long URI, confirmed against Angular's own working client-side decode
    // (auth.service.ts's ROLE_CLAIM constant), not a short "role" string.
    [Fact]
    public void GetRole_ReturnsTheRoleClaim()
    {
        var token = MakeToken("""{"sub":"42","http://schemas.microsoft.com/ws/2008/06/identity/claims/role":"Admin"}""");

        var role = JwtClaimsReader.GetRole(token);

        Assert.Equal("Admin", role);
    }

    [Fact]
    public void GetRole_ReturnsNullWhenRoleClaimIsMissing()
    {
        var token = MakeToken("""{"sub":"42"}""");

        var role = JwtClaimsReader.GetRole(token);

        Assert.Null(role);
    }

    [Fact]
    public void GetRole_ReturnsNullForAMalformedToken()
    {
        var role = JwtClaimsReader.GetRole("not-a-jwt");

        Assert.Null(role);
    }
}
