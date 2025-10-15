using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace QAAutomationUI
{
    public enum ModernMessageBoxType
    {
        Info,
        Success,
        Warning,
        Error,
        Question
    }

    public enum ModernMessageBoxButtons
    {
        OK,
        OKCancel,
        YesNo,
        YesNoCancel
    }

    public class ModernMessageBox : Window
    {
        public ModernMessageBoxResult Result { get; private set; } = ModernMessageBoxResult.Cancel;

        public ModernMessageBox(string title, string message, ModernMessageBoxType type = ModernMessageBoxType.Info, ModernMessageBoxButtons buttons = ModernMessageBoxButtons.OK)
        {
            Title = title;
            Width = 500;
            MinHeight = 220;
            MaxHeight = 600;
            WindowStartupLocation = WindowStartupLocation.CenterOwner;
            ResizeMode = ResizeMode.NoResize;
            Background = Brushes.Transparent;
            AllowsTransparency = true;
            WindowStyle = WindowStyle.None;

            var border = new Border
            {
                CornerRadius = new CornerRadius(12),
                Background = Brushes.White
            };
            border.Effect = new System.Windows.Media.Effects.DropShadowEffect
            {
                Color = Colors.Black,
                Opacity = 0.2,
                ShadowDepth = 0,
                BlurRadius = 20
            };

            var mainGrid = new Grid();
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            // Header
            var headerBorder = new Border
            {
                CornerRadius = new CornerRadius(12, 12, 0, 0),
                Padding = new Thickness(25, 20, 25, 20)
            };

            var (headerColor, icon, iconColor) = GetTypeStyles(type);
            headerBorder.Background = new SolidColorBrush(headerColor);

            var headerStack = new StackPanel { Orientation = Orientation.Horizontal };

            var iconText = new TextBlock
            {
                Text = icon,
                FontSize = 28,
                Foreground = new SolidColorBrush(iconColor),
                Margin = new Thickness(0, 0, 15, 0),
                VerticalAlignment = VerticalAlignment.Center
            };

            var titleText = new TextBlock
            {
                Text = title,
                FontSize = 20,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                VerticalAlignment = VerticalAlignment.Center
            };

            headerStack.Children.Add(iconText);
            headerStack.Children.Add(titleText);
            headerBorder.Child = headerStack;
            Grid.SetRow(headerBorder, 0);

            // Message Content
            var scrollViewer = new ScrollViewer
            {
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                Margin = new Thickness(25, 25, 25, 20),
                MaxHeight = 350
            };

            var messageText = new TextBlock
            {
                Text = message,
                FontSize = 14,
                Foreground = new SolidColorBrush(Color.FromRgb(31, 41, 55)),
                TextWrapping = TextWrapping.Wrap,
                LineHeight = 22
            };

            scrollViewer.Content = messageText;
            Grid.SetRow(scrollViewer, 1);

            // Button Panel
            var buttonBorder = new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(249, 250, 251)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(229, 231, 235)),
                BorderThickness = new Thickness(0, 1, 0, 0),
                CornerRadius = new CornerRadius(0, 0, 12, 12),
                Padding = new Thickness(25, 20, 25, 20)
            };

            var buttonPanel = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right
            };

            CreateButtons(buttons, type, buttonPanel);

            buttonBorder.Child = buttonPanel;
            Grid.SetRow(buttonBorder, 2);

            mainGrid.Children.Add(headerBorder);
            mainGrid.Children.Add(scrollViewer);
            mainGrid.Children.Add(buttonBorder);

            border.Child = mainGrid;
            Content = border;

            // Press Escape to close
            KeyDown += (s, e) =>
            {
                if (e.Key == System.Windows.Input.Key.Escape)
                {
                    Result = ModernMessageBoxResult.Cancel;
                    Close();
                }
            };
        }

        private (Color headerColor, string icon, Color iconColor) GetTypeStyles(ModernMessageBoxType type)
        {
            return type switch
            {
                ModernMessageBoxType.Success => (Color.FromRgb(16, 185, 129), "✓", Colors.White),
                ModernMessageBoxType.Warning => (Color.FromRgb(245, 158, 11), "⚠", Colors.White),
                ModernMessageBoxType.Error => (Color.FromRgb(239, 68, 68), "✕", Colors.White),
                ModernMessageBoxType.Question => (Color.FromRgb(59, 130, 246), "?", Colors.White),
                _ => (Color.FromRgb(99, 102, 241), "ℹ", Colors.White)
            };
        }

        private void CreateButtons(ModernMessageBoxButtons buttons, ModernMessageBoxType type, StackPanel panel)
        {
            switch (buttons)
            {
                case ModernMessageBoxButtons.OK:
                    panel.Children.Add(CreateButton("OK", ModernMessageBoxResult.OK, true, type));
                    break;

                case ModernMessageBoxButtons.OKCancel:
                    panel.Children.Add(CreateButton("Cancel", ModernMessageBoxResult.Cancel, false, type));
                    panel.Children.Add(CreateButton("OK", ModernMessageBoxResult.OK, true, type));
                    break;

                case ModernMessageBoxButtons.YesNo:
                    panel.Children.Add(CreateButton("No", ModernMessageBoxResult.No, false, type));
                    panel.Children.Add(CreateButton("Yes", ModernMessageBoxResult.Yes, true, type));
                    break;

                case ModernMessageBoxButtons.YesNoCancel:
                    panel.Children.Add(CreateButton("Cancel", ModernMessageBoxResult.Cancel, false, type));
                    panel.Children.Add(CreateButton("No", ModernMessageBoxResult.No, false, type));
                    panel.Children.Add(CreateButton("Yes", ModernMessageBoxResult.Yes, true, type));
                    break;
            }
        }

        private Button CreateButton(string text, ModernMessageBoxResult result, bool isPrimary, ModernMessageBoxType type)
        {
            var button = new Button
            {
                Content = text,
                Width = 100,
                Height = 38,
                Margin = new Thickness(10, 0, 0, 0),
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                Cursor = System.Windows.Input.Cursors.Hand
            };

            Color backgroundColor;
            Color hoverColor;

            if (isPrimary)
            {
                backgroundColor = type switch
                {
                    ModernMessageBoxType.Success => Color.FromRgb(16, 185, 129),
                    ModernMessageBoxType.Warning => Color.FromRgb(245, 158, 11),
                    ModernMessageBoxType.Error => Color.FromRgb(239, 68, 68),
                    _ => Color.FromRgb(37, 99, 235)
                };
                hoverColor = type switch
                {
                    ModernMessageBoxType.Success => Color.FromRgb(5, 150, 105),
                    ModernMessageBoxType.Warning => Color.FromRgb(217, 119, 6),
                    ModernMessageBoxType.Error => Color.FromRgb(220, 38, 38),
                    _ => Color.FromRgb(29, 78, 216)
                };
            }
            else
            {
                backgroundColor = Color.FromRgb(107, 114, 128);
                hoverColor = Color.FromRgb(75, 85, 99);
            }

            var style = new Style(typeof(Button));
            var template = new ControlTemplate(typeof(Button));
            var borderFactory = new FrameworkElementFactory(typeof(Border));
            borderFactory.SetValue(Border.BackgroundProperty, new SolidColorBrush(backgroundColor));
            borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(6));
            borderFactory.SetValue(Border.PaddingProperty, new Thickness(15, 8, 15, 8));

            var contentFactory = new FrameworkElementFactory(typeof(ContentPresenter));
            contentFactory.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            contentFactory.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            borderFactory.AppendChild(contentFactory);

            template.VisualTree = borderFactory;
            style.Setters.Add(new Setter(TemplateProperty, template));
            style.Setters.Add(new Setter(ForegroundProperty, Brushes.White));

            // Hover effect
            var hoverTrigger = new Trigger { Property = IsMouseOverProperty, Value = true };
            hoverTrigger.Setters.Add(new Setter(TemplateProperty, CreateHoverTemplate(hoverColor)));
            style.Triggers.Add(hoverTrigger);

            button.Style = style;

            button.Click += (s, e) =>
            {
                Result = result;
                DialogResult = result != ModernMessageBoxResult.Cancel;
                Close();
            };

            if (isPrimary)
            {
                button.IsDefault = true;
            }

            return button;
        }

        private ControlTemplate CreateHoverTemplate(Color color)
        {
            var template = new ControlTemplate(typeof(Button));
            var borderFactory = new FrameworkElementFactory(typeof(Border));
            borderFactory.SetValue(Border.BackgroundProperty, new SolidColorBrush(color));
            borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(6));
            borderFactory.SetValue(Border.PaddingProperty, new Thickness(15, 8, 15, 8));

            var contentFactory = new FrameworkElementFactory(typeof(ContentPresenter));
            contentFactory.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            contentFactory.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            borderFactory.AppendChild(contentFactory);

            template.VisualTree = borderFactory;
            return template;
        }

        public static ModernMessageBoxResult Show(string message, string title = "Information", ModernMessageBoxType type = ModernMessageBoxType.Info, ModernMessageBoxButtons buttons = ModernMessageBoxButtons.OK, Window? owner = null)
        {
            var msgBox = new ModernMessageBox(title, message, type, buttons);
            if (owner != null)
            {
                msgBox.Owner = owner;
            }
            msgBox.ShowDialog();
            return msgBox.Result;
        }
    }

    public enum ModernMessageBoxResult
    {
        OK,
        Cancel,
        Yes,
        No
    }
}
