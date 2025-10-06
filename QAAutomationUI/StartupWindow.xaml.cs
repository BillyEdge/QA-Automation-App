using System.IO;
using System.Windows;
using System.Windows.Input;

namespace QAAutomationUI
{
    public partial class StartupWindow : Window
    {
        public string? SelectedSuitePath { get; private set; }

        public StartupWindow()
        {
            InitializeComponent();
            LoadRecentSuites();
        }

        private void LoadRecentSuites()
        {
            try
            {
                string suitesPath = Path.Combine(Directory.GetCurrentDirectory(), "test-suites");
                if (Directory.Exists(suitesPath))
                {
                    // Load suite folders instead of JSON files
                    var suiteFolders = Directory.GetDirectories(suitesPath);
                    foreach (var suiteFolder in suiteFolders)
                    {
                        string name = Path.GetFileName(suiteFolder);
                        lstSuites.Items.Add(name);
                    }
                }

                if (lstSuites.Items.Count == 0)
                {
                    lstSuites.Items.Add("No test suites found - Create your first one!");
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error loading suites: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void BtnNewSuite_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var dialog = new InputDialog("New Test Suite", "Enter suite name:");
                dialog.Owner = this;
                if (dialog.ShowDialog() == true)
                {
                    string suiteName = dialog.ResponseText;
                    if (!string.IsNullOrWhiteSpace(suiteName))
                    {
                        // Show platform selection
                        var platformDialog = new PlatformSelectionDialog();
                        platformDialog.Owner = this;
                        if (platformDialog.ShowDialog() == true)
                        {
                            // Ask for URL or Path based on platform
                            string urlOrPath = "";
                            if (platformDialog.SelectedPlatform == "web")
                            {
                                urlOrPath = ShowInputDialog("Enter URL", "Enter the base URL for web testing (e.g., https://example.com):");
                                if (string.IsNullOrWhiteSpace(urlOrPath))
                                {
                                    MessageBox.Show("URL is required for web testing", "Validation", MessageBoxButton.OK, MessageBoxImage.Warning);
                                    return;
                                }
                            }
                            else if (platformDialog.SelectedPlatform == "desktop")
                            {
                                urlOrPath = ShowInputDialog("Enter Application Path", "Enter the path to the desktop application:");
                                if (string.IsNullOrWhiteSpace(urlOrPath))
                                {
                                    MessageBox.Show("Application path is required for desktop testing", "Validation", MessageBoxButton.OK, MessageBoxImage.Warning);
                                    return;
                                }
                            }
                            else if (platformDialog.SelectedPlatform == "mobile")
                            {
                                urlOrPath = ShowInputDialog("Enter App Package", "Enter the app package name or path:");
                            }

                            // Create suite folder structure: test-suites/{suite-name}/tests/
                            string suitesPath = Path.Combine(Directory.GetCurrentDirectory(), "test-suites");
                            string suiteFolderPath = Path.Combine(suitesPath, suiteName);
                            string testsPath = Path.Combine(suiteFolderPath, "tests");

                            Directory.CreateDirectory(testsPath);

                            // Create suite config file
                            string configPath = Path.Combine(suiteFolderPath, "suite-config.json");
                            var suiteConfig = new
                            {
                                name = suiteName,
                                description = "",
                                platform = platformDialog.SelectedPlatform,
                                urlOrPath = urlOrPath,
                                createdAt = DateTime.Now,
                                updatedAt = DateTime.Now
                            };

                            File.WriteAllText(configPath, System.Text.Json.JsonSerializer.Serialize(suiteConfig, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));

                            SelectedSuitePath = configPath;
                            DialogResult = true;
                            Close();
                        }
                        else
                        {
                            MessageBox.Show("Platform selection was cancelled", "Info", MessageBoxButton.OK, MessageBoxImage.Information);
                        }
                    }
                    else
                    {
                        MessageBox.Show("Suite name cannot be empty", "Validation", MessageBoxButton.OK, MessageBoxImage.Warning);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error creating suite: {ex.Message}\n\nStack: {ex.StackTrace}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void BtnOpenSuite_Click(object sender, RoutedEventArgs e)
        {
            if (lstSuites.SelectedItem != null)
            {
                string suiteName = lstSuites.SelectedItem.ToString()!;
                if (suiteName.Contains("No test suites"))
                {
                    MessageBox.Show("Please create a new test suite first", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                string suitesPath = Path.Combine(Directory.GetCurrentDirectory(), "test-suites");
                string suiteFolder = Path.Combine(suitesPath, suiteName);
                SelectedSuitePath = Path.Combine(suiteFolder, "suite-config.json");

                if (!File.Exists(SelectedSuitePath))
                {
                    MessageBox.Show($"Suite configuration not found: {SelectedSuitePath}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }

                DialogResult = true;
                Close();
            }
            else
            {
                MessageBox.Show("Please select a test suite", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }

        private void BtnContinue_Click(object sender, RoutedEventArgs e)
        {
            SelectedSuitePath = null;
            DialogResult = true;
            Close();
        }

        private void LstSuites_MouseDoubleClick(object sender, MouseButtonEventArgs e)
        {
            if (lstSuites.SelectedItem != null)
            {
                BtnOpenSuite_Click(sender, e);
            }
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnDeleteSuite_Click(object sender, RoutedEventArgs e)
        {
            if (lstSuites.SelectedItem != null)
            {
                string suiteName = lstSuites.SelectedItem.ToString()!;
                if (suiteName.Contains("No test suites"))
                {
                    MessageBox.Show("No suite selected to delete", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                var result = MessageBox.Show(
                    $"Are you sure you want to delete the test suite '{suiteName}'?\n\nThis will delete all test cases inside it.\n\nThis action cannot be undone.",
                    "Confirm Delete",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);

                if (result == MessageBoxResult.Yes)
                {
                    try
                    {
                        string suitesPath = Path.Combine(Directory.GetCurrentDirectory(), "test-suites");
                        string suiteFolder = Path.Combine(suitesPath, suiteName);

                        if (Directory.Exists(suiteFolder))
                        {
                            Directory.Delete(suiteFolder, true); // Delete folder and all contents
                            MessageBox.Show($"Test suite '{suiteName}' and all its test cases have been deleted successfully.", "Deleted", MessageBoxButton.OK, MessageBoxImage.Information);

                            // Refresh the list
                            lstSuites.Items.Clear();
                            LoadRecentSuites();
                        }
                        else
                        {
                            MessageBox.Show($"Test suite folder not found: {suiteFolder}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                        }
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show($"Error deleting suite: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
            }
            else
            {
                MessageBox.Show("Please select a test suite to delete", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }

        private string ShowInputDialog(string title, string prompt)
        {
            var dialog = new InputDialog(title, prompt);
            dialog.Owner = this;
            if (dialog.ShowDialog() == true)
            {
                return dialog.ResponseText;
            }
            return "";
        }
    }

    public class InputDialog : Window
    {
        private System.Windows.Controls.TextBox txtInput;

        public string ResponseText => txtInput.Text;

        public InputDialog(string title, string prompt)
        {
            Title = title;
            Width = 450;
            Height = 180;
            WindowStartupLocation = WindowStartupLocation.CenterOwner;
            ResizeMode = ResizeMode.NoResize;
            Background = System.Windows.Media.Brushes.White;

            var grid = new System.Windows.Controls.Grid();
            grid.Margin = new Thickness(20);
            grid.RowDefinitions.Add(new System.Windows.Controls.RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new System.Windows.Controls.RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new System.Windows.Controls.RowDefinition { Height = GridLength.Auto });

            var lblPrompt = new System.Windows.Controls.TextBlock
            {
                Text = prompt,
                FontSize = 14,
                Foreground = System.Windows.Media.Brushes.Black,
                Margin = new Thickness(0, 0, 0, 15)
            };
            System.Windows.Controls.Grid.SetRow(lblPrompt, 0);

            var border = new System.Windows.Controls.Border
            {
                BorderBrush = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(209, 213, 219)),
                BorderThickness = new Thickness(1),
                CornerRadius = new System.Windows.CornerRadius(6),
                Background = System.Windows.Media.Brushes.White,
                Margin = new Thickness(0, 0, 0, 20)
            };

            txtInput = new System.Windows.Controls.TextBox
            {
                FontSize = 14,
                Padding = new Thickness(10),
                BorderThickness = new Thickness(0),
                Foreground = System.Windows.Media.Brushes.Black,
                Background = System.Windows.Media.Brushes.White,
                CaretBrush = System.Windows.Media.Brushes.Black
            };
            border.Child = txtInput;
            System.Windows.Controls.Grid.SetRow(border, 1);

            var buttonPanel = new System.Windows.Controls.StackPanel
            {
                Orientation = System.Windows.Controls.Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right,
                Margin = new Thickness(0, 15, 0, 0)
            };

            var btnOK = new System.Windows.Controls.Button
            {
                Content = "✓ OK",
                Width = 100,
                Height = 35,
                Margin = new Thickness(0, 0, 10, 0),
                IsDefault = true,
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                Cursor = System.Windows.Input.Cursors.Hand
            };
            btnOK.Style = CreateButtonStyle(System.Windows.Media.Color.FromRgb(37, 99, 235));
            btnOK.Click += (s, e) => { DialogResult = true; Close(); };

            var btnCancel = new System.Windows.Controls.Button
            {
                Content = "✗ Cancel",
                Width = 100,
                Height = 35,
                IsCancel = true,
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                Cursor = System.Windows.Input.Cursors.Hand
            };
            btnCancel.Style = CreateButtonStyle(System.Windows.Media.Color.FromRgb(107, 114, 128));
            btnCancel.Click += (s, e) => { DialogResult = false; Close(); };

            buttonPanel.Children.Add(btnOK);
            buttonPanel.Children.Add(btnCancel);
            System.Windows.Controls.Grid.SetRow(buttonPanel, 2);

            grid.Children.Add(lblPrompt);
            grid.Children.Add(border);
            grid.Children.Add(buttonPanel);

            Content = grid;

            Loaded += (s, e) => txtInput.Focus();
        }

        private System.Windows.Style CreateButtonStyle(System.Windows.Media.Color backgroundColor)
        {
            var style = new System.Windows.Style(typeof(System.Windows.Controls.Button));

            var template = new System.Windows.Controls.ControlTemplate(typeof(System.Windows.Controls.Button));
            var borderFactory = new System.Windows.FrameworkElementFactory(typeof(System.Windows.Controls.Border));
            borderFactory.SetValue(System.Windows.Controls.Border.BackgroundProperty, new System.Windows.Media.SolidColorBrush(backgroundColor));
            borderFactory.SetValue(System.Windows.Controls.Border.CornerRadiusProperty, new System.Windows.CornerRadius(6));
            borderFactory.SetValue(System.Windows.Controls.Border.PaddingProperty, new Thickness(15, 8, 15, 8));

            var contentFactory = new System.Windows.FrameworkElementFactory(typeof(System.Windows.Controls.ContentPresenter));
            contentFactory.SetValue(System.Windows.Controls.ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            contentFactory.SetValue(System.Windows.Controls.ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            borderFactory.AppendChild(contentFactory);

            template.VisualTree = borderFactory;
            style.Setters.Add(new System.Windows.Setter(System.Windows.Controls.Control.TemplateProperty, template));
            style.Setters.Add(new System.Windows.Setter(System.Windows.Controls.Control.ForegroundProperty, System.Windows.Media.Brushes.White));

            return style;
        }
    }
}
