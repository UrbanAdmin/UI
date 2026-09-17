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
}
