using System.Net;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.Services;

public class HttpExceptionExtensionsTests
{
    [Fact]
    public void ToApiStatusCode_ReturnsTheStatusCodeFromAnHttpRequestException()
    {
        var ex = new HttpRequestException("boom", null, HttpStatusCode.Forbidden);

        var result = ex.ToApiStatusCode();

        Assert.Equal(403, result);
    }

    [Fact]
    public void ToApiStatusCode_ReturnsNullWhenTheHttpRequestExceptionHasNoStatusCode()
    {
        var ex = new HttpRequestException("boom");

        var result = ex.ToApiStatusCode();

        Assert.Null(result);
    }

    [Fact]
    public void ToApiStatusCode_ReturnsNullForANonHttpException()
    {
        var ex = new InvalidOperationException("boom");

        var result = ex.ToApiStatusCode();

        Assert.Null(result);
    }
}
