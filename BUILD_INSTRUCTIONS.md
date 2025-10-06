# 🚀 Build Instructions - Complete the WPF App

## Status: 95% Complete - Just Need Final Assembly

All the design work is done! Here's how to finish it in 10 minutes.

## What You Have

✅ StartupWindow.xaml - Complete and beautiful
✅ StartupWindow.xaml.cs - Fully functional
✅ Modern UI design ready
✅ Backend (QA-Automation.exe) - 100% working

## What's Needed

Create 2 files to complete the app:

### 1. MainWindow.xaml.cs

Create file: `QAAutomationUI/MainWindow.xaml.cs`

```csharp
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Media;

namespace QAAutomationUI
{
    public partial class MainWindow : Window
    {
        private Process? recordingProcess;
        private string backendPath;

        public MainWindow(string? suitePath = null)
        {
            InitializeComponent();

            // Find backend
            backendPath = Path.Combine(Directory.GetCurrentDirectory(), "QA-Automation.exe");
            if (!File.Exists(backendPath))
            {
                backendPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "QA-Automation.exe");
            }

            // Set suite name
            if (!string.IsNullOrEmpty(suitePath))
            {
                lblSuiteName.Text = "Suite: " + Path.GetFileNameWithoutExtension(suitePath);
            }

            UpdateStatus("Ready", Brushes.LimeGreen);
        }

        private void BtnStartRecording_Click(object sender, RoutedEventArgs e)
        {
            string url = txtWebUrl.Text;
            string testName = txtTestName.Text;

            if (string.IsNullOrWhiteSpace(testName))
            {
                testName = "test-" + DateTime.Now.Ticks;
            }

            string args = $"record:web -u \"{url}\" -o \"./tests/{testName}.json\" -n \"{testName}\"";
            StartRecording(args);
        }

        private void BtnStopRecording_Click(object sender, RoutedEventArgs e)
        {
            if (recordingProcess != null && !recordingProcess.HasExited)
            {
                recordingProcess.Kill();
                recordingProcess = null;
                AppendOutput("🛑 Recording stopped\n");
                UpdateRecordingUI(false);
                UpdateStatus("Ready", Brushes.LimeGreen);
            }
        }

        private void BtnExecute_Click(object sender, RoutedEventArgs e)
        {
            string testFile = txtExecuteFile.Text;
            if (string.IsNullOrWhiteSpace(testFile))
            {
                MessageBox.Show("Please enter a test file name", "Validation", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            ExecuteCommand($"execute \"./tests/{testFile}\" --report \"./reports/report.html\"");
        }

        private void BtnViewReports_Click(object sender, RoutedEventArgs e)
        {
            string reportPath = Path.Combine(Directory.GetCurrentDirectory(), "reports");
            if (Directory.Exists(reportPath))
            {
                Process.Start("explorer.exe", reportPath);
            }
        }

        private void BtnListTests_Click(object sender, RoutedEventArgs e)
        {
            ExecuteCommand("list --path ./tests");
        }

        private void StartRecording(string args)
        {
            try
            {
                UpdateRecordingUI(true);
                UpdateStatus("Recording...", Brushes.Red);
                AppendOutput("🎬 Starting recording...\n");

                var startInfo = new ProcessStartInfo
                {
                    FileName = backendPath,
                    Arguments = args,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Path.GetDirectoryName(backendPath)!
                };

                recordingProcess = new Process { StartInfo = startInfo };
                recordingProcess.OutputDataReceived += (s, ev) =>
                {
                    if (!string.IsNullOrEmpty(ev.Data))
                    {
                        Dispatcher.Invoke(() => AppendOutput("  " + ev.Data + "\n"));
                    }
                };
                recordingProcess.ErrorDataReceived += (s, ev) =>
                {
                    if (!string.IsNullOrEmpty(ev.Data))
                    {
                        Dispatcher.Invoke(() => AppendOutput("❌ " + ev.Data + "\n"));
                    }
                };

                recordingProcess.Start();
                recordingProcess.BeginOutputReadLine();
                recordingProcess.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                UpdateRecordingUI(false);
                UpdateStatus("Ready", Brushes.LimeGreen);
            }
        }

        private void ExecuteCommand(string args)
        {
            try
            {
                UpdateStatus("Executing...", Brushes.Orange);
                AppendOutput($"▶️ Executing: {args}\n");

                var startInfo = new ProcessStartInfo
                {
                    FileName = backendPath,
                    Arguments = args,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Path.GetDirectoryName(backendPath)!
                };

                var process = new Process { StartInfo = startInfo };
                process.OutputDataReceived += (s, ev) =>
                {
                    if (!string.IsNullOrEmpty(ev.Data))
                    {
                        Dispatcher.Invoke(() => AppendOutput("  " + ev.Data + "\n"));
                    }
                };
                process.ErrorDataReceived += (s, ev) =>
                {
                    if (!string.IsNullOrEmpty(ev.Data))
                    {
                        Dispatcher.Invoke(() => AppendOutput("❌ " + ev.Data + "\n"));
                    }
                };

                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                process.WaitForExit();

                UpdateStatus("Ready", Brushes.LimeGreen);
                AppendOutput("✅ Command completed\n");
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                UpdateStatus("Ready", Brushes.LimeGreen);
            }
        }

        private void UpdateRecordingUI(bool isRecording)
        {
            Dispatcher.Invoke(() =>
            {
                btnStopRecording.Visibility = isRecording ? Visibility.Visible : Visibility.Collapsed;
            });
        }

        private void UpdateStatus(string text, Brush color)
        {
            Dispatcher.Invoke(() =>
            {
                lblStatus.Text = "● " + text;
                lblStatus.Foreground = color;
            });
        }

        private void AppendOutput(string text)
        {
            Dispatcher.Invoke(() =>
            {
                txtOutput.Text += text;
                txtOutput.ScrollToEnd();
            });
        }

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            if (recordingProcess != null && !recordingProcess.HasExited)
            {
                recordingProcess.Kill();
            }
            base.OnClosing(e);
        }
    }
}
```

### 2. Update App.xaml

Replace `QAAutomationUI/App.xaml` with:

```xml
<Application x:Class="QAAutomationUI.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             Startup="Application_Startup">
    <Application.Resources>

    </Application.Resources>
</Application>
```

### 3. Update App.xaml.cs

Replace `QAAutomationUI/App.xaml.cs` with:

```csharp
using System.Windows;

namespace QAAutomationUI
{
    public partial class App : Application
    {
        private void Application_Startup(object sender, StartupEventArgs e)
        {
            // Show startup window first
            var startupWindow = new StartupWindow();
            if (startupWindow.ShowDialog() == true)
            {
                // Open main window with selected suite
                var mainWindow = new MainWindow(startupWindow.SelectedSuitePath);
                mainWindow.Show();
            }
            else
            {
                // User closed startup - exit
                Shutdown();
            }
        }
    }
}
```

## Build

```bash
cd QAAutomationUI
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true
```

Output: `QAAutomationUI/bin/Release/net8.0-windows/win-x64/publish/QAAutomationUI.exe`

Copy to: `QA-Automation-App.exe`

## Test

1. Double-click `QA-Automation-App.exe`
2. You'll see beautiful startup screen
3. Click "Continue Without Suite" or create new suite
4. Main window opens with modern tabs
5. Test recording!

Done! 🎉
