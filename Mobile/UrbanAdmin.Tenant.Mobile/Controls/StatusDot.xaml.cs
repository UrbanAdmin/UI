namespace UrbanAdmin.Tenant.Mobile.Controls;

public partial class StatusDot : ContentView
{
    public static readonly BindableProperty KindProperty =
        BindableProperty.Create(nameof(Kind), typeof(string), typeof(StatusDot), string.Empty);

    public static readonly BindableProperty SizeProperty =
        BindableProperty.Create(nameof(Size), typeof(double), typeof(StatusDot), 16.0, propertyChanged: OnSizeChanged);

    public StatusDot()
    {
        InitializeComponent();
        HorizontalOptions = LayoutOptions.Start;
        VerticalOptions = LayoutOptions.Start;
    }

    public string Kind
    {
        get => (string)GetValue(KindProperty);
        set => SetValue(KindProperty, value);
    }

    public double Size
    {
        get => (double)GetValue(SizeProperty);
        set => SetValue(SizeProperty, value);
    }

    private static void OnSizeChanged(BindableObject bindable, object oldValue, object newValue)
    {
        var dot = (StatusDot)bindable;
        var size = (double)newValue;
        dot.Dot.WidthRequest = size;
        dot.Dot.HeightRequest = size;
        dot.Dot.CornerRadius = size / 2;
    }
}
