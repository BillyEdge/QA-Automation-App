using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Text.Json;
using System.Collections.ObjectModel;

namespace QAAutomationUI
{
    public class TestCaseInfo
    {
        public string Name { get; set; } = "";
        public string Platform { get; set; } = "";
        public int ActionCount { get; set; }
        public string FilePath { get; set; } = "";
    }

    public class TestStepInfo
    {
        public int StepNumber { get; set; }
        public string Id { get; set; } = "";
        public string Type { get; set; } = "";
        public string ObjectName { get; set; } = "";
        public string Description { get; set; } = "";
        public string Value { get; set; } = "";
    }

    public class ObjectRepositoryItemInfo
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string TagName { get; set; } = "";
        public string ClassName { get; set; } = "";
        public string PrimarySelector { get; set; } = "";
        public string XPath { get; set; } = "";
    }

    public class ReportStepInfo
    {
        public int StepNumber { get; set; }
        public string Status { get; set; } = "";
        public string Action { get; set; } = "";
        public string Object { get; set; } = "";
        public string ExecutionTime { get; set; } = "";
        public string ErrorMessage { get; set; } = "";
    }

    public partial class MainWindow : Window
    {
        private Process? recordingProcess;
        private Process? browserServerProcess;
        private string backendPath;
        private ObservableCollection<TestCaseInfo> testCases = new ObservableCollection<TestCaseInfo>();
        private ObservableCollection<TestStepInfo> testSteps = new ObservableCollection<TestStepInfo>();
        private ObservableCollection<ObjectRepositoryItemInfo> objectRepositoryItems = new ObservableCollection<ObjectRepositoryItemInfo>();
        private ObservableCollection<ReportStepInfo> reportSteps = new ObservableCollection<ReportStepInfo>();
        private string? currentTestFilePath;
        private string? suiteConfigPath;
        private string? suiteFolderPath;
        private string? suiteUrl;
        private string? suitePlatform;
        private string? suiteName;
        private Process? currentExecutionProcess = null;
        private TaskCompletionSource<bool>? currentCompletionSource = null;

        public MainWindow(string? suitePath = null)
        {
            try
            {
                InitializeComponent();

                // Use node to run the backend instead of packaged exe (to avoid pkg bundling issues)
                string nodeExe = "node"; // Assumes node is in PATH
                string distPath = Path.Combine(Directory.GetCurrentDirectory(), "dist", "index.js");

                if (File.Exists(distPath))
                {
                    backendPath = $"{nodeExe} \"{distPath}\"";
                }
                else
                {
                    // Fallback to exe if dist not found
                    backendPath = Path.Combine(Directory.GetCurrentDirectory(), "QA-Automation.exe");
                }

                if (!string.IsNullOrEmpty(suitePath))
                {
                    suiteConfigPath = suitePath;
                    suiteFolderPath = Path.GetDirectoryName(suitePath);

                    // Load suite config
                    try
                    {
                        string jsonContent = File.ReadAllText(suitePath);
                        using (JsonDocument doc = JsonDocument.Parse(jsonContent))
                        {
                            var root = doc.RootElement;
                            suiteName = root.GetProperty("name").GetString() ?? "Unknown";
                            suitePlatform = root.GetProperty("platform").GetString() ?? "web";
                            suiteUrl = root.TryGetProperty("urlOrPath", out var urlProp) ? urlProp.GetString() : "";

                            lblSuiteName.Text = "Suite: " + suiteName;

                            // Display URL in header
                            if (!string.IsNullOrWhiteSpace(suiteUrl))
                            {
                                lblSuiteUrl.Text = "URL: " + suiteUrl;
                            }
                            else
                            {
                                lblSuiteUrl.Text = "URL: Not set";
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        AppendOutput($"⚠️ Error loading suite config: {ex.Message}\n");
                    }

                    // Show success message when window is loaded
                    this.Loaded += (s, e) =>
                    {
                        AppendOutput($"✅ Test suite loaded successfully!\n");
                        AppendOutput($"📁 Path: {suitePath}\n");
                        AppendOutput($"📦 Platform: {suitePlatform}\n");
                        if (!string.IsNullOrWhiteSpace(suiteUrl))
                        {
                            AppendOutput($"🌐 URL/Path: {suiteUrl}\n");
                        }
                        AppendOutput($"\n💡 Ready to start testing! Choose a tab above to begin.\n");
                        AppendOutput($"🔧 Backend: {backendPath}\n");
                        AppendOutput($"🔍 Backend exists: {File.Exists(backendPath)}\n");

                        // Start persistent browser server
                        StartBrowserServer();

                        // DEBUG: Show context menu items on load
                        AppendOutput("\n🐛 DEBUG: Checking context menu items...\n");
                        if (testStepsContextMenu != null)
                        {
                            AppendOutput($"   Menu has {testStepsContextMenu.Items.Count} items:\n");
                            for (int i = 0; i < testStepsContextMenu.Items.Count; i++)
                            {
                                var item = testStepsContextMenu.Items[i];
                                if (item is MenuItem mi)
                                {
                                    AppendOutput($"   [{i}] MenuItem: {mi.Header}\n");
                                }
                                else if (item is Separator)
                                {
                                    AppendOutput($"   [{i}] Separator\n");
                                }
                            }
                        }
                        else
                        {
                            AppendOutput("   ❌ testStepsContextMenu is NULL!\n");
                        }
                    };

                    // Clean up browser server when window closes
                    this.Closing += (s, e) =>
                    {
                        StopBrowserServer();
                    };
                }
                else
                {
                    this.Loaded += (s, e) =>
                    {
                        AppendOutput($"✅ QA Automation Platform ready!\n");
                        AppendOutput($"💡 Choose a tab above to start recording or executing tests.\n");
                        AppendOutput($"🔧 Backend: {backendPath}\n");
                        AppendOutput($"🔍 Backend exists: {File.Exists(backendPath)}\n");

                        // Add Navigate to URL menu item
                        AppendOutput("🔧 About to call AddNavigateToUrlMenuItem() [NO SUITE]...\n");
                        try
                        {
                            AddNavigateToUrlMenuItem();
                            AppendOutput("🔧 Finished calling AddNavigateToUrlMenuItem()\n");
                        }
                        catch (Exception menuEx)
                        {
                            AppendOutput($"❌ Exception in AddNavigateToUrlMenuItem: {menuEx.Message}\n");
                        }
                    };
                }

                UpdateStatus("Ready", Brushes.LimeGreen);

                // Bind DataGrids
                dgTestCases.ItemsSource = testCases;
                dgTestSteps.ItemsSource = testSteps;
                dgObjectRepository.ItemsSource = objectRepositoryItems;
                dgReportSteps.ItemsSource = reportSteps;

                // Load object repository
                LoadObjectRepository();

                // Ensure window is visible
                this.Visibility = Visibility.Visible;
                this.Topmost = true;
                this.Loaded += (s, e) =>
                {
                    this.Topmost = false;
                    this.Activate();
                    LoadTestCases(); // Load test cases when window loads

                    // Start persistent browser server
                    StartBrowserServer();

                    // Add Navigate to URL menu item after window is fully loaded
                    AppendOutput("🔧 Attempting to add Navigate to URL menu item...\n");
                    AddNavigateToUrlMenuItem();
                };

                // Clean up browser server when window closes
                this.Closing += (s, e) =>
                {
                    StopBrowserServer();
                };
            }
            catch (Exception ex)
            {
                MessageBox.Show($"MainWindow constructor error:\n\n{ex.Message}\n\nStack:\n{ex.StackTrace}",
                    "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void LoadTestCases()
        {
            try
            {
                testCases.Clear();

                // Use suite-specific tests folder
                string testsDir;
                if (!string.IsNullOrEmpty(suiteFolderPath))
                {
                    testsDir = Path.Combine(suiteFolderPath, "tests");
                }
                else
                {
                    testsDir = Path.Combine(Directory.GetCurrentDirectory(), "tests");
                }

                if (Directory.Exists(testsDir))
                {
                    var testFiles = Directory.GetFiles(testsDir, "*.json");
                    foreach (var file in testFiles)
                    {
                        try
                        {
                            string jsonContent = File.ReadAllText(file);
                            using (JsonDocument doc = JsonDocument.Parse(jsonContent))
                            {
                                var root = doc.RootElement;
                                string name = root.GetProperty("name").GetString() ?? "Unnamed Test";
                                string platform = root.GetProperty("platform").GetString() ?? "unknown";
                                int actionCount = root.GetProperty("actions").GetArrayLength();

                                testCases.Add(new TestCaseInfo
                                {
                                    Name = name,
                                    Platform = platform.ToUpper(),
                                    ActionCount = actionCount,
                                    FilePath = file
                                });
                            }
                        }
                        catch (Exception ex)
                        {
                            AppendOutput($"⚠️ Error parsing {Path.GetFileName(file)}: {ex.Message}\n");
                        }
                    }
                }
                else
                {
                    Directory.CreateDirectory(testsDir);
                }

                AppendOutput($"📋 Loaded {testCases.Count} test case(s)\n");
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Error loading test cases: {ex.Message}\n");
            }
        }

        private async void BtnOpenBrowser_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                // Check if suite URL is configured
                if (string.IsNullOrWhiteSpace(suiteUrl))
                {
                    MessageBox.Show("No URL configured for this suite. Please edit suite configuration.", "Validation", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                AppendOutput("\n🌐 Opening browser...\n");
                AppendOutput($"📍 Navigating to: {suiteUrl}\n");

                string nodeExe = "node";
                string distPath = Path.Combine(Directory.GetCurrentDirectory(), "dist", "index.js");
                string args = $"\"{distPath}\" open-browser --url \"{suiteUrl}\"";

                var startInfo = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = args,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Directory.GetCurrentDirectory()
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
                        Dispatcher.Invoke(() => AppendOutput("  ❌ " + ev.Data + "\n"));
                    }
                };

                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();

                AppendOutput("💡 Browser opened and navigated to suite URL!\n");
                AppendOutput("💡 You can now start recording actions.\n");
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Failed to open browser: {ex.Message}\n");
            }
        }

        private void BtnStartRecording_Click(object sender, RoutedEventArgs e)
        {
            string testName = txtTestName.Text;

            if (string.IsNullOrWhiteSpace(testName))
            {
                MessageBox.Show("Please enter a test name.", "Validation", MessageBoxButton.OK, MessageBoxImage.Warning);
                txtTestName.Focus();
                return;
            }

            // Check for duplicate test name
            string testsDir = Path.Combine(suiteFolderPath ?? Directory.GetCurrentDirectory(), "tests");
            string sanitizedName = testName.Replace(" ", "-").Replace("/", "-").Replace("\\", "-");
            string testFilePath = Path.Combine(testsDir, $"{sanitizedName}.json");

            if (File.Exists(testFilePath))
            {
                var result = MessageBox.Show(
                    $"A test with the name '{testName}' already exists. Do you want to overwrite it?",
                    "Duplicate Test Name",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);

                if (result == MessageBoxResult.No)
                {
                    txtTestName.Focus();
                    return;
                }
            }

            // Use suite URL
            if (string.IsNullOrWhiteSpace(suiteUrl))
            {
                MessageBox.Show("No URL configured for this suite. Please edit suite configuration.", "Validation", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            // Check if recording is already running
            if (recordingProcess != null && !recordingProcess.HasExited)
            {
                // Restart recording with new test name
                AppendOutput($"\n🔄 Restarting recording with test name: {testName}\n");
                recordingProcess.StandardInput.WriteLine($"restart {testName}");
                recordingProcess.StandardInput.Flush();

                UpdateRecordingUI(true);
                UpdateStatus("Recording...", Brushes.Red);

                // Clear test name for next test
                txtTestName.Clear();
                return;
            }

            // Check if browser has pages open (not just if browser server is running)
            bool needToOpenBrowser = false;
            string nodeExe = "node";
            string distPath = Path.Combine(Directory.GetCurrentDirectory(), "dist", "index.js");

            // Check if browser has any pages
            var checkPagesStartInfo = new ProcessStartInfo
            {
                FileName = nodeExe,
                Arguments = $"\"{distPath}\" check-browser-pages",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                WorkingDirectory = Directory.GetCurrentDirectory()
            };

            var checkProcess = new Process { StartInfo = checkPagesStartInfo };
            checkProcess.Start();
            string checkOutput = checkProcess.StandardOutput.ReadToEnd();
            checkProcess.WaitForExit();

            AppendOutput($"🔍 Checking browser state...\n");
            AppendOutput($"  {checkOutput}\n");

            // Parse the output to see if pages exist
            bool hasPages = checkOutput.Contains("HAS_PAGES:true");

            if (!hasPages)
            {
                AppendOutput("\n🌐 No browser pages detected - opening browser with URL...\n");

                // Call the Open Browser logic (without --wait so it exits after opening)
                string openBrowserArgs = $"\"{distPath}\" open-browser --url \"{suiteUrl}\"";

                var openBrowserStartInfo = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = openBrowserArgs,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Directory.GetCurrentDirectory()
                };

                var openBrowserProcess = new Process { StartInfo = openBrowserStartInfo };
                openBrowserProcess.Start();

                // Read output synchronously (simpler, no deadlock risk)
                string output = openBrowserProcess.StandardOutput.ReadToEnd();
                string errorOutput = openBrowserProcess.StandardError.ReadToEnd();

                openBrowserProcess.WaitForExit(10000); // 10 second timeout

                if (!string.IsNullOrWhiteSpace(output))
                {
                    AppendOutput(output + "\n");
                }

                if (!string.IsNullOrWhiteSpace(errorOutput))
                {
                    AppendOutput("❌ " + errorOutput + "\n");
                }

                AppendOutput("✅ Browser opened and navigated to URL!\n");
                AppendOutput("⏳ Giving browser a moment to stabilize...\n");

                // Give browser a moment to fully load the page
                System.Threading.Thread.Sleep(2000);
            }
            else
            {
                AppendOutput("\n✅ Browser already has pages open - reusing session...\n");
            }

            // Create tests directory using the same path from duplicate check
            Directory.CreateDirectory(testsDir);

            string args = $"record:web --url \"{suiteUrl}\" --output \"{testsDir}\" --name \"{testName}\"";
            StartRecording(args);
        }

        private void BtnStopRecording_Click(object sender, RoutedEventArgs e)
        {
            if (recordingProcess != null && !recordingProcess.HasExited)
            {
                try
                {
                    AppendOutput("\n⏹️ Stopping recording...\n");
                    // Send "stop" command instead of killing process
                    recordingProcess.StandardInput.WriteLine("stop");
                    recordingProcess.StandardInput.Flush();
                    AppendOutput("✅ Recording stopped! Browser kept open for next recording.\n");

                    UpdateRecordingUI(false);
                    UpdateStatus("Ready", Brushes.LimeGreen);

                    // Refresh test list and object repository
                    LoadTestCases();
                    LoadObjectRepository();

                    // Clear test name textbox for next recording
                    txtTestName.Clear();
                }
                catch (Exception ex)
                {
                    AppendOutput($"⚠️ Error stopping recording: {ex.Message}\n");
                    MessageBox.Show($"Could not stop recording gracefully: {ex.Message}\n\nPlease close the browser manually.",
                        "Warning", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
            }
            else
            {
                AppendOutput("ℹ️ No recording in progress\n");
            }
        }

        private async void BtnRunAllTests_Click(object sender, RoutedEventArgs e)
        {
            if (testCases.Count == 0)
            {
                MessageBox.Show("No test cases found. Please record some tests first.",
                    "No Tests", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            // Get loop count from textbox
            int loopCount = 1;
            if (int.TryParse(txtLoopCount.Text, out int parsed) && parsed > 0)
            {
                loopCount = parsed;
            }

            // Get suite config path to run all tests in the suite
            if (string.IsNullOrEmpty(suiteConfigPath))
            {
                MessageBox.Show("No suite configuration found.",
                    "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }

            string reportsDir = Path.Combine(Directory.GetCurrentDirectory(), "reports");
            Directory.CreateDirectory(reportsDir);

            string reportPath = Path.Combine(reportsDir, "suite-report.json");
            string suiteId = suiteName ?? "suite-config";
            string loopArg = loopCount > 1 ? $" --loop {loopCount}" : "";

            AppendOutput($"\n▶️ Running all tests in suite (Loop: {loopCount}x)...\n");
            await ExecuteCommandAsync($"suite:execute \"{suiteId}\" -r \"{reportPath}\"{loopArg}");

            // After execution, load and display the report in app
            // Add small delay to ensure file is fully written
            await Task.Delay(500);

            if (File.Exists(reportPath))
            {
                try
                {
                    Dispatcher.Invoke(() =>
                    {
                        LoadTestReport(reportPath);
                        mainTabControl.SelectedIndex = 3; // Switch to Report tab
                    });
                    AppendOutput($"📊 Suite report loaded successfully\n");
                }
                catch (Exception ex)
                {
                    AppendOutput($"⚠️ Failed to load report: {ex.Message}\n");
                    AppendOutput($"   Error details: {ex.ToString()}\n");
                }
            }
            else
            {
                AppendOutput($"⚠️ Suite report file not found at: {reportPath}\n");
            }
        }

        private void BtnRefreshTests_Click(object sender, RoutedEventArgs e)
        {
            LoadTestCases();
            AppendOutput("🔄 Test cases list refreshed\n");
        }

        private void BtnViewReports_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                string reportPath = Path.Combine(Directory.GetCurrentDirectory(), "reports");
                if (Directory.Exists(reportPath))
                {
                    // Use ProcessStartInfo to properly configure the process
                    var startInfo = new ProcessStartInfo
                    {
                        FileName = reportPath,
                        UseShellExecute = true,
                        Verb = "open"
                    };
                    Process.Start(startInfo);
                    AppendOutput($"📂 Opened reports folder: {reportPath}\n");
                }
                else
                {
                    MessageBox.Show("Reports folder does not exist yet. Execute a test first to generate reports.",
                        "No Reports", MessageBoxButton.OK, MessageBoxImage.Information);
                    AppendOutput("📂 No reports folder found\n");
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error opening reports folder: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                AppendOutput($"❌ Error opening reports: {ex.Message}\n");
            }
        }

        private void StartRecording(string args)
        {
            try
            {
                UpdateRecordingUI(true);
                UpdateStatus("Recording...", Brushes.Red);
                AppendOutput("🎬 Starting recording...\n");

                // Parse backend path - could be "node dist/index.js" or just "QA-Automation.exe"
                string fileName;
                string arguments;

                if (backendPath.StartsWith("node "))
                {
                    fileName = "node";
                    string scriptPath = backendPath.Substring(5).Trim().Trim('"');
                    arguments = $"\"{scriptPath}\" {args}";
                }
                else
                {
                    fileName = backendPath;
                    arguments = args;
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = arguments,
                    UseShellExecute = false,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Directory.GetCurrentDirectory()
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

        private void StartContinueRecording(string args)
        {
            // This is for "Start Recording from Here" - it continues an existing test
            // We use the same recording process as StartRecording, but with --continue flag
            try
            {
                UpdateRecordingUI(true);
                UpdateStatus("Recording...", Brushes.Red);
                AppendOutput("🎬 Continuing recording...\n");

                // Parse backend path - could be "node dist/index.js" or just "QA-Automation.exe"
                string fileName;
                string arguments;

                if (backendPath.StartsWith("node "))
                {
                    fileName = "node";
                    string scriptPath = backendPath.Substring(5).Trim().Trim('"');
                    arguments = $"\"{scriptPath}\" {args}";
                }
                else
                {
                    fileName = backendPath;
                    arguments = args;
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = arguments,
                    UseShellExecute = false,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Directory.GetCurrentDirectory()
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

        private async Task ExecuteCommandAsync(string args)
        {
            try
            {
                UpdateStatus("Executing...", Brushes.Orange);
                AppendOutput($"▶️ Executing: {args}\n");

                // Parse backend path - could be "node dist/index.js" or just "QA-Automation.exe"
                string fileName;
                string arguments;

                if (backendPath.StartsWith("node "))
                {
                    fileName = "node";
                    string scriptPath = backendPath.Substring(5).Trim().Trim('"');
                    arguments = $"\"{scriptPath}\" {args}";
                }
                else
                {
                    fileName = backendPath;
                    arguments = args;
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = arguments,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Directory.GetCurrentDirectory()
                };

                var process = new Process { StartInfo = startInfo };
                currentExecutionProcess = process; // Store for Stop button

                // Use async event handlers
                var outputBuilder = new System.Text.StringBuilder();
                var errorBuilder = new System.Text.StringBuilder();
                var completionSource = new TaskCompletionSource<bool>();
                currentCompletionSource = completionSource; // Store for Stop button
                bool completionSignaled = false;

                process.OutputDataReceived += (s, ev) =>
                {
                    if (!string.IsNullOrEmpty(ev.Data))
                    {
                        outputBuilder.AppendLine(ev.Data);
                        Dispatcher.BeginInvoke(() => AppendOutput("  " + ev.Data + "\n"));

                        // Check for completion signal (only trigger once)
                        // Strip ANSI color codes and trim
                        string cleanData = System.Text.RegularExpressions.Regex.Replace(ev.Data, @"\x1B\[[0-9;]*[a-zA-Z]", "").Trim();

                        // Only consider execution complete when we see the explicit completion signal
                        // Do NOT use "Report generated" as it can trigger prematurely during suite execution
                        bool isComplete = cleanData.Contains("###EXECUTION_COMPLETE###") ||
                                         cleanData.Contains("EXIT_CODE:");

                        if (!completionSignaled && isComplete)
                        {
                            completionSignaled = true;
                            Dispatcher.BeginInvoke(() =>
                            {
                                AppendOutput($"\n🔔 Execution completion detected!\n");
                            });

                            // Use async task to wait a moment then signal completion
                            Task.Run(async () =>
                            {
                                await Task.Delay(2000); // Wait 2 seconds for remaining output
                                completionSource.TrySetResult(true);
                            });
                        }
                    }
                };
                process.ErrorDataReceived += (s, ev) =>
                {
                    if (!string.IsNullOrEmpty(ev.Data))
                    {
                        errorBuilder.AppendLine(ev.Data);
                        Dispatcher.BeginInvoke(() => AppendOutput("❌ " + ev.Data + "\n"));

                        // Also check for completion signal in error stream
                        if (!completionSignaled && ev.Data.Contains("###EXECUTION_COMPLETE###"))
                        {
                            completionSignaled = true;
                            Dispatcher.BeginInvoke(() => AppendOutput("🔔 Detected execution completion signal (from error stream)\n"));
                            Task.Run(async () =>
                            {
                                await Task.Delay(1500);
                                completionSource.TrySetResult(true);
                            });
                        }
                    }
                };

                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();

                // Wait for completion signal (don't exit early on process exit)
                var completionTask = completionSource.Task;
                await completionTask;

                AppendOutput("✅ Execution completed via signal\n");

                // Give extra time for report file to be fully written to disk
                await Task.Delay(1500);

                // Clear completion source to indicate execution is done
                currentCompletionSource = null;

                UpdateStatus("Ready", Brushes.LimeGreen);
                AppendOutput("✅ Command completed\n");

                // DON'T kill the process - let it stay alive to keep browser server running
                // The process will exit naturally or stay idle for next command
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                currentCompletionSource = null;
                UpdateStatus("Ready", Brushes.LimeGreen);
            }
        }

        private async void ExecuteCommand(string args)
        {
            await ExecuteCommandAsync(args);
        }

        private void UpdateRecordingUI(bool isRecording)
        {
            Dispatcher.Invoke(() =>
            {
                btnStopRecording.Visibility = isRecording ? Visibility.Visible : Visibility.Collapsed;
                btnStopRecordingMain.Visibility = isRecording ? Visibility.Visible : Visibility.Collapsed;
            });
        }

        private void StartBrowserServer()
        {
            try
            {
                // Check if browser server is already running
                if (browserServerProcess != null && !browserServerProcess.HasExited)
                {
                    AppendOutput("💡 Browser server already running - skipping start\n");
                    return;
                }

                AppendOutput("\n🌐 Starting persistent browser server...\n");

                string nodeExe = "node";
                string browserServerPath = Path.Combine(Directory.GetCurrentDirectory(), "dist", "browser", "browserServer.js");

                if (!File.Exists(browserServerPath))
                {
                    AppendOutput($"⚠️ Browser server not found at: {browserServerPath}\n");
                    AppendOutput("⚠️ Browser reuse features may not work correctly\n");
                    return;
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = $"\"{browserServerPath}\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Directory.GetCurrentDirectory()
                };

                browserServerProcess = new Process { StartInfo = startInfo };

                browserServerProcess.OutputDataReceived += (s, ev) =>
                {
                    if (!string.IsNullOrEmpty(ev.Data))
                    {
                        Dispatcher.Invoke(() => AppendOutput("  [Browser] " + ev.Data + "\n"));
                    }
                };

                browserServerProcess.ErrorDataReceived += (s, ev) =>
                {
                    if (!string.IsNullOrEmpty(ev.Data))
                    {
                        Dispatcher.Invoke(() => AppendOutput("  [Browser Error] " + ev.Data + "\n"));
                    }
                };

                browserServerProcess.Start();
                browserServerProcess.BeginOutputReadLine();
                browserServerProcess.BeginErrorReadLine();

                AppendOutput("✅ Browser server started successfully!\n");
                AppendOutput("💡 Tests and recordings will now reuse the same browser\n\n");
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Failed to start browser server: {ex.Message}\n");
                AppendOutput("⚠️ Will fall back to opening individual browsers\n");
            }
        }

        private void StopBrowserServer()
        {
            if (browserServerProcess != null && !browserServerProcess.HasExited)
            {
                try
                {
                    AppendOutput("\n🛑 Stopping browser server...\n");
                    browserServerProcess.Kill(true); // Kill process tree
                    browserServerProcess.WaitForExit(2000);
                    AppendOutput("✅ Browser server stopped\n");
                }
                catch (Exception ex)
                {
                    AppendOutput($"⚠️ Error stopping browser server: {ex.Message}\n");
                }
                finally
                {
                    browserServerProcess?.Dispose();
                    browserServerProcess = null;
                }
            }
        }

        private void UpdateStatus(string text, Brush color)
        {
            Dispatcher.Invoke(() =>
            {
                lblStatus.Text = "● " + text;
                lblStatus.Foreground = color;

                // Show Stop buttons when executing, hide when ready
                bool isExecuting = text == "Executing...";
                btnStopExecution.Visibility = isExecuting ? Visibility.Visible : Visibility.Collapsed;
                btnStopExecutionMain.Visibility = isExecuting ? Visibility.Visible : Visibility.Collapsed;
            });
        }

        private void BtnStopExecution_Click(object sender, RoutedEventArgs e)
        {
            if (currentCompletionSource != null)
            {
                AppendOutput("\n⏹️ Execution stopped by user\n");
                AppendOutput("🌐 Browser will remain open for next recording...\n");
                currentCompletionSource.TrySetResult(true);
                currentCompletionSource = null;
            }

            // Don't kill the process - let it end gracefully to keep browser alive
            // Just wait a moment for it to finish
            if (currentExecutionProcess != null && !currentExecutionProcess.HasExited)
            {
                Task.Run(async () =>
                {
                    // Give process 5 seconds to exit gracefully
                    for (int i = 0; i < 50; i++)
                    {
                        if (currentExecutionProcess.HasExited)
                            break;
                        await Task.Delay(100);
                    }

                    // NEVER kill the process - just let it run to keep browser alive
                    if (!currentExecutionProcess.HasExited)
                    {
                        Dispatcher.Invoke(() => AppendOutput("⚠️ Process still running - leaving it alive to preserve browser session\n"));
                        // Don't call Kill() - this would close the browser!
                    }
                    currentExecutionProcess = null;
                });
            }

            UpdateStatus("Ready", Brushes.LimeGreen);
        }

        private void AppendOutput(string text)
        {
            Dispatcher.Invoke(() =>
            {
                txtOutput.Text += text;
                txtOutput.ScrollToEnd();
            });
        }

        // DataGrid Selection Changed
        private void DgTestCases_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
        {
            if (dgTestCases.SelectedItem is TestCaseInfo selectedTest)
            {
                LoadTestSteps(selectedTest.FilePath);
            }
        }

        private void LoadTestSteps(string filePath)
        {
            try
            {
                testSteps.Clear();
                currentTestFilePath = filePath;

                string jsonContent = File.ReadAllText(filePath);
                using (JsonDocument doc = JsonDocument.Parse(jsonContent))
                {
                    var root = doc.RootElement;
                    var actions = root.GetProperty("actions");

                    int stepNum = 1;
                    foreach (var action in actions.EnumerateArray())
                    {
                        string id = action.GetProperty("id").GetString() ?? "";
                        string type = action.GetProperty("type").GetString() ?? "";
                        string description = action.GetProperty("description").GetString() ?? "";
                        string value = action.TryGetProperty("value", out var val) ? val.ToString() : "";

                        // Get object name from objectId or fallback to target selector
                        string objectName = "";
                        if (action.TryGetProperty("objectId", out var objectIdProp))
                        {
                            string objectId = objectIdProp.GetString() ?? "";
                            var matchingObject = objectRepositoryItems.FirstOrDefault(o => o.Id == objectId);
                            if (matchingObject != null)
                            {
                                objectName = matchingObject.Name;
                            }
                        }

                        // Fallback: Extract object name from target selector if objectId not found
                        if (string.IsNullOrEmpty(objectName) && action.TryGetProperty("target", out var targetProp))
                        {
                            if (targetProp.TryGetProperty("value", out var selectorValue))
                            {
                                string selector = selectorValue.GetString() ?? "";
                                // Extract friendly name from selector (e.g., [placeholder="Enter Username"] -> Enter Username)
                                if (selector.Contains("placeholder=\""))
                                {
                                    int start = selector.IndexOf("placeholder=\"") + 13;
                                    int end = selector.IndexOf("\"", start);
                                    if (end > start)
                                    {
                                        objectName = selector.Substring(start, end - start);
                                    }
                                }
                                else if (selector.Contains("[name=\""))
                                {
                                    int start = selector.IndexOf("[name=\"") + 7;
                                    int end = selector.IndexOf("\"", start);
                                    if (end > start)
                                    {
                                        objectName = selector.Substring(start, end - start);
                                    }
                                }
                                else if (selector.StartsWith("#"))
                                {
                                    objectName = selector.Substring(1); // Remove # from ID selector
                                }
                                else
                                {
                                    objectName = selector.Length > 30 ? selector.Substring(0, 27) + "..." : selector;
                                }
                            }
                        }

                        testSteps.Add(new TestStepInfo
                        {
                            StepNumber = stepNum++,
                            Id = id,
                            Type = type.ToUpper(),
                            ObjectName = objectName,
                            Description = description,
                            Value = value.Length > 50 ? value.Substring(0, 47) + "..." : value
                        });
                    }
                }

                AppendOutput($"📖 Loaded {testSteps.Count} test steps from {Path.GetFileName(filePath)}\n");
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Error loading test steps: {ex.Message}\n");
            }
        }

        private void LoadObjectRepository()
        {
            try
            {
                objectRepositoryItems.Clear();

                // Find object repository file in suite folder
                if (string.IsNullOrEmpty(suiteFolderPath))
                {
                    return;
                }

                string objectRepoPath = Path.Combine(suiteFolderPath, "objects", "object-repository.json");

                if (!File.Exists(objectRepoPath))
                {
                    AppendOutput("📦 No object repository found yet. Objects will appear after recording.\n");
                    return;
                }

                string jsonContent = File.ReadAllText(objectRepoPath);
                using (JsonDocument doc = JsonDocument.Parse(jsonContent))
                {
                    var objectsArray = doc.RootElement;

                    foreach (var obj in objectsArray.EnumerateArray())
                    {
                        string id = obj.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "" : "";
                        string name = obj.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "";
                        string tagName = obj.TryGetProperty("tagName", out var tagProp) ? tagProp.GetString() ?? "" : "";

                        string className = "";
                        if (obj.TryGetProperty("attributes", out var attrs) && attrs.TryGetProperty("class", out var classProp))
                        {
                            className = classProp.GetString() ?? "";
                        }

                        // Get primary selector and xpath
                        string primarySelector = "";
                        string xpath = "";
                        if (obj.TryGetProperty("selectors", out var selectors))
                        {
                            if (selectors.TryGetProperty("id", out var selectorId) && !string.IsNullOrEmpty(selectorId.GetString()))
                            {
                                primarySelector = "#" + selectorId.GetString();
                            }
                            else if (selectors.TryGetProperty("css", out var css) && !string.IsNullOrEmpty(css.GetString()))
                            {
                                primarySelector = css.GetString() ?? "";
                            }

                            if (selectors.TryGetProperty("xpath", out var xpathProp))
                            {
                                xpath = xpathProp.GetString() ?? "";
                            }
                        }

                        objectRepositoryItems.Add(new ObjectRepositoryItemInfo
                        {
                            Id = id,
                            Name = name,
                            TagName = tagName,
                            ClassName = className,
                            PrimarySelector = primarySelector,
                            XPath = xpath
                        });
                    }
                }

                AppendOutput($"📦 Loaded {objectRepositoryItems.Count} objects from repository\n");
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Error loading object repository: {ex.Message}\n");
            }
        }

        // Test Case Operations
        private void BtnOpenTest_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button btn && btn.Tag is string filePath)
            {
                // Load object repository first so we can lookup object names
                LoadObjectRepository();
                LoadTestSteps(filePath);
                AppendOutput($"📂 Opened test case: {Path.GetFileName(filePath)}\n");
            }
        }

        private async void BtnRunTest_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button btn && btn.Tag is string filePath)
            {
                string reportsDir = Path.Combine(Directory.GetCurrentDirectory(), "reports");
                Directory.CreateDirectory(reportsDir);

                // Get loop count from textbox
                int loopCount = 1;
                if (int.TryParse(txtLoopCount.Text, out int parsed) && parsed > 0)
                {
                    loopCount = parsed;
                }

                string reportPath = Path.Combine(reportsDir, "report.json");
                string loopArg = loopCount > 1 ? $" --loop {loopCount}" : "";
                await ExecuteCommandAsync($"execute \"{filePath}\" -r \"{reportPath}\"{loopArg}");

                // After execution completes, load and display the report
                // Add small delay to ensure file is fully written
                await Task.Delay(500);

                if (File.Exists(reportPath))
                {
                    try
                    {
                        Dispatcher.Invoke(() =>
                        {
                            LoadTestReport(reportPath);
                            mainTabControl.SelectedIndex = 3; // Switch to Report tab
                        });
                        AppendOutput($"📊 Test report loaded successfully\n");
                    }
                    catch (Exception ex)
                    {
                        AppendOutput($"⚠️ Failed to load report: {ex.Message}\n");
                        AppendOutput($"   Error details: {ex.ToString()}\n");
                    }
                }
                else
                {
                    AppendOutput($"⚠️ Report file not found at: {reportPath}\n");
                }
            }
        }

        private void BtnDeleteTest_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button btn && btn.Tag is string filePath)
            {
                var result = ModernMessageBox.Show(
                    $"Are you sure you want to delete this test case?\n\n{Path.GetFileName(filePath)}",
                    "Confirm Delete",
                    ModernMessageBoxType.Warning,
                    ModernMessageBoxButtons.YesNo,
                    this);

                if (result == ModernMessageBoxResult.Yes)
                {
                    try
                    {
                        File.Delete(filePath);
                        AppendOutput($"🗑️ Deleted test case: {Path.GetFileName(filePath)}\n");
                        LoadTestCases();
                        testSteps.Clear();
                        ModernMessageBox.Show(
                            $"Test case '{Path.GetFileName(filePath)}' has been deleted successfully.",
                            "Deleted",
                            ModernMessageBoxType.Success,
                            ModernMessageBoxButtons.OK,
                            this);
                    }
                    catch (Exception ex)
                    {
                        ModernMessageBox.Show($"Error deleting test case: {ex.Message}", "Error", ModernMessageBoxType.Error, ModernMessageBoxButtons.OK, this);
                    }
                }
            }
        }

        // Test Step Operations
        private void BtnEditStep_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button btn && btn.Tag is string stepId)
            {
                if (string.IsNullOrEmpty(currentTestFilePath))
                {
                    MessageBox.Show("No test case is currently loaded.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }

                try
                {
                    // Read the current test case
                    string jsonContent = File.ReadAllText(currentTestFilePath);
                    using (JsonDocument doc = JsonDocument.Parse(jsonContent))
                    {
                        var root = doc.RootElement;
                        var actions = root.GetProperty("actions");

                        // Find the step
                        JsonElement? targetAction = null;
                        foreach (var action in actions.EnumerateArray())
                        {
                            if (action.GetProperty("id").GetString() == stepId)
                            {
                                targetAction = action;
                                break;
                            }
                        }

                        if (targetAction.HasValue)
                        {
                            string currentDesc = targetAction.Value.GetProperty("description").GetString() ?? "";
                            string currentValue = targetAction.Value.TryGetProperty("value", out var val) ? val.ToString() : "";

                            // Show edit dialog
                            var editDialog = new Window
                            {
                                Title = "Edit Test Step",
                                Width = 500,
                                Height = 300,
                                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                                Owner = this,
                                Background = new SolidColorBrush(Color.FromRgb(249, 250, 251))
                            };

                            var panel = new System.Windows.Controls.StackPanel { Margin = new Thickness(20) };

                            var lblDesc = new System.Windows.Controls.TextBlock { Text = "Description:", FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 0, 0, 5) };
                            var txtDesc = new System.Windows.Controls.TextBox { Text = currentDesc, Height = 60, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 15) };

                            var lblValue = new System.Windows.Controls.TextBlock { Text = "Value:", FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 0, 0, 5) };
                            var txtValue = new System.Windows.Controls.TextBox { Text = currentValue, Height = 60, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 15) };

                            var btnPanel = new System.Windows.Controls.StackPanel { Orientation = System.Windows.Controls.Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
                            var btnSave = new System.Windows.Controls.Button { Content = "💾 Save", Width = 80, Height = 35, Margin = new Thickness(0, 0, 10, 0) };
                            var btnCancel = new System.Windows.Controls.Button { Content = "❌ Cancel", Width = 80, Height = 35 };

                            btnSave.Click += (s, args) =>
                            {
                                // Update the JSON
                                var options = new JsonSerializerOptions { WriteIndented = true };
                                var jsonObj = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonContent);
                                if (jsonObj != null && jsonObj.ContainsKey("actions"))
                                {
                                    var actionsList = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(jsonObj["actions"].ToString()!);
                                    if (actionsList != null)
                                    {
                                        foreach (var act in actionsList)
                                        {
                                            if (act["id"].ToString() == stepId)
                                            {
                                                act["description"] = txtDesc.Text;
                                                if (!string.IsNullOrWhiteSpace(txtValue.Text))
                                                {
                                                    act["value"] = txtValue.Text;
                                                }
                                                break;
                                            }
                                        }
                                        jsonObj["actions"] = actionsList;
                                    }
                                }

                                File.WriteAllText(currentTestFilePath, JsonSerializer.Serialize(jsonObj, options));
                                LoadTestSteps(currentTestFilePath);
                                AppendOutput($"✏️ Updated test step\n");
                                editDialog.Close();
                            };

                            btnCancel.Click += (s, args) => editDialog.Close();

                            btnPanel.Children.Add(btnSave);
                            btnPanel.Children.Add(btnCancel);

                            panel.Children.Add(lblDesc);
                            panel.Children.Add(txtDesc);
                            panel.Children.Add(lblValue);
                            panel.Children.Add(txtValue);
                            panel.Children.Add(btnPanel);

                            editDialog.Content = panel;
                            editDialog.ShowDialog();
                        }
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Error editing step: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private void BtnDeleteStep_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button btn && btn.Tag is string stepId)
            {
                if (string.IsNullOrEmpty(currentTestFilePath))
                {
                    MessageBox.Show("No test case is currently loaded.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }

                var result = MessageBox.Show(
                    "Are you sure you want to delete this test step?",
                    "Confirm Delete",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);

                if (result == MessageBoxResult.Yes)
                {
                    try
                    {
                        string jsonContent = File.ReadAllText(currentTestFilePath);
                        var options = new JsonSerializerOptions { WriteIndented = true };
                        var jsonObj = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonContent);

                        if (jsonObj != null && jsonObj.ContainsKey("actions"))
                        {
                            var actionsList = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(jsonObj["actions"].ToString()!);
                            if (actionsList != null)
                            {
                                actionsList.RemoveAll(act => act["id"].ToString() == stepId);
                                jsonObj["actions"] = actionsList;
                            }
                        }

                        File.WriteAllText(currentTestFilePath, JsonSerializer.Serialize(jsonObj, options));
                        LoadTestSteps(currentTestFilePath);
                        LoadTestCases(); // Refresh action count
                        AppendOutput($"🗑️ Deleted test step\n");
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show($"Error deleting step: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
            }
        }

        private void BtnEditConfig_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrEmpty(suiteConfigPath))
            {
                MessageBox.Show("No suite loaded to edit", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            try
            {
                // Show dialog to edit URL
                var dialog = new Window
                {
                    Title = "Edit Suite Configuration",
                    Width = 500,
                    Height = 200,
                    WindowStartupLocation = WindowStartupLocation.CenterOwner,
                    Owner = this,
                    Background = new SolidColorBrush(Color.FromRgb(249, 250, 251))
                };

                var panel = new System.Windows.Controls.StackPanel { Margin = new Thickness(20) };

                var lblUrl = new System.Windows.Controls.TextBlock
                {
                    Text = suitePlatform == "web" ? "Base URL:" : "Application Path:",
                    FontWeight = FontWeights.SemiBold,
                    Margin = new Thickness(0, 0, 0, 8),
                    FontSize = 14
                };

                var txtUrl = new System.Windows.Controls.TextBox
                {
                    Text = suiteUrl,
                    FontSize = 14,
                    Padding = new Thickness(10),
                    Height = 40,
                    Margin = new Thickness(0, 0, 0, 20)
                };

                var btnPanel = new System.Windows.Controls.StackPanel
                {
                    Orientation = System.Windows.Controls.Orientation.Horizontal,
                    HorizontalAlignment = HorizontalAlignment.Right
                };

                var btnSave = new System.Windows.Controls.Button { Content = "💾 Save", Width = 100, Height = 35, Margin = new Thickness(0, 0, 10, 0) };
                var btnCancel = new System.Windows.Controls.Button { Content = "❌ Cancel", Width = 100, Height = 35 };

                btnSave.Click += (s, args) =>
                {
                    try
                    {
                        // Update suite config
                        string jsonContent = File.ReadAllText(suiteConfigPath!);
                        var options = new JsonSerializerOptions { WriteIndented = true };
                        var config = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonContent);

                        if (config != null)
                        {
                            config["urlOrPath"] = txtUrl.Text;
                            config["updatedAt"] = DateTime.Now;
                        }

                        File.WriteAllText(suiteConfigPath, JsonSerializer.Serialize(config, options));

                        // Update UI
                        suiteUrl = txtUrl.Text;
                        lblSuiteUrl.Text = "URL: " + suiteUrl;

                        AppendOutput($"✅ Suite configuration updated!\n");
                        MessageBox.Show("Suite configuration updated successfully!", "Success", MessageBoxButton.OK, MessageBoxImage.Information);
                        dialog.Close();
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show($"Error saving configuration: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                };

                btnCancel.Click += (s, args) => dialog.Close();

                btnPanel.Children.Add(btnSave);
                btnPanel.Children.Add(btnCancel);

                panel.Children.Add(lblUrl);
                panel.Children.Add(txtUrl);
                panel.Children.Add(btnPanel);

                dialog.Content = panel;
                dialog.ShowDialog();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error opening configuration: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // Context Menu Handlers for Test Steps
        private void DgTestSteps_MouseRightButtonUp(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            // Context menu will show automatically
        }

        private void TestStepsContextMenu_Opened(object sender, RoutedEventArgs e)
        {
            AppendOutput("\n=== DEBUG: Context Menu Opening ===\n");
            var menu = testStepsContextMenu;
            if (menu != null)
            {
                AppendOutput($"Menu Items Count: {menu.Items.Count}\n");
                for (int i = 0; i < menu.Items.Count; i++)
                {
                    var item = menu.Items[i];
                    if (item is MenuItem mi)
                    {
                        AppendOutput($"  [{i}] MenuItem: '{mi.Header}'\n");
                        if (mi.Items.Count > 0)
                        {
                            AppendOutput($"      (has {mi.Items.Count} sub-items)\n");
                        }
                    }
                    else if (item is Separator)
                    {
                        AppendOutput($"  [{i}] Separator\n");
                    }
                    else
                    {
                        AppendOutput($"  [{i}] {item.GetType().Name}\n");
                    }
                }
            }
            else
            {
                AppendOutput("Menu is NULL!\n");
            }
            AppendOutput("=================================\n\n");
        }

        private void AddNavigateToUrlMenuItem()
        {
            AppendOutput("🔧 AddNavigateToUrlMenuItem() called\n");
            try
            {
                var contextMenu = testStepsContextMenu;
                AppendOutput($"🔧 testStepsContextMenu = {(contextMenu == null ? "NULL" : "NOT NULL")}\n");
                if (contextMenu == null)
                {
                    AppendOutput("⚠️ testStepsContextMenu is null\n");
                    return;
                }

                AppendOutput($"🔧 Context menu has {contextMenu.Items.Count} items\n");

                // Check if already exists
                bool alreadyExists = false;
                foreach (var item in contextMenu.Items)
                {
                    if (item is MenuItem mi && mi.Header?.ToString()?.Contains("Navigate to URL") == true)
                    {
                        alreadyExists = true;
                        break;
                    }
                }

                if (!alreadyExists)
                {
                    // Find "Continue if Fail" menu item
                    int continueIfFailIndex = -1;
                    for (int i = 0; i < contextMenu.Items.Count; i++)
                    {
                        if (contextMenu.Items[i] is MenuItem menuItem &&
                            menuItem.Header?.ToString()?.Contains("Continue if Fail") == true)
                        {
                            continueIfFailIndex = i;
                            break;
                        }
                    }

                    if (continueIfFailIndex >= 0)
                    {
                        // Add separator after "Continue if Fail"
                        var separator = new Separator();
                        contextMenu.Items.Insert(continueIfFailIndex + 1, separator);

                        // Add "Navigate to URL" menu item as main menu item
                        var navigateMenuItem = new MenuItem
                        {
                            Header = "🔗 Navigate to URL"
                        };
                        navigateMenuItem.Click += MenuAddNavigateToUrl_Click;
                        contextMenu.Items.Insert(continueIfFailIndex + 2, navigateMenuItem);

                        AppendOutput("✅ Added 'Navigate to URL' menu item!\n");
                    }
                    else
                    {
                        AppendOutput("⚠️ Could not find 'Continue if Fail' menu item\n");
                    }
                }
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Error adding Navigate menu: {ex.Message}\n");
            }
        }

        private void MenuAddOpenBrowser_Click(object sender, RoutedEventArgs e)
        {
            if (dgTestSteps.SelectedItem == null)
            {
                MessageBox.Show("Please select a test step first.", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            // Prompt user for URL (optional)
            var urlDialog = new Window
            {
                Title = "Start Browser",
                Width = 500,
                Height = 200,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Owner = this,
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F1F5F9"))
            };

            var grid = new Grid { Margin = new Thickness(20) };
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            var label = new TextBlock
            {
                Text = "Enter URL to navigate (optional):",
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(0, 0, 0, 10)
            };
            Grid.SetRow(label, 0);
            grid.Children.Add(label);

            var urlTextBox = new TextBox
            {
                Text = "https://",
                FontSize = 14,
                Padding = new Thickness(10),
                VerticalContentAlignment = VerticalAlignment.Center,
                Style = (Style)FindResource("ModernTextBox")
            };
            Grid.SetRow(urlTextBox, 1);
            grid.Children.Add(urlTextBox);

            var buttonPanel = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right,
                Margin = new Thickness(0, 15, 0, 0)
            };
            Grid.SetRow(buttonPanel, 2);

            var okButton = new Button
            {
                Content = "OK",
                Width = 80,
                Margin = new Thickness(0, 0, 10, 0),
                Style = (Style)FindResource("SuccessButton")
            };
            okButton.Click += (s, args) =>
            {
                urlDialog.DialogResult = true;
                urlDialog.Close();
            };
            buttonPanel.Children.Add(okButton);

            var cancelButton = new Button
            {
                Content = "Cancel",
                Width = 80,
                Style = (Style)FindResource("SecondaryButton")
            };
            cancelButton.Click += (s, args) =>
            {
                urlDialog.DialogResult = false;
                urlDialog.Close();
            };
            buttonPanel.Children.Add(cancelButton);

            grid.Children.Add(buttonPanel);
            urlDialog.Content = grid;

            // Show dialog
            if (urlDialog.ShowDialog() == true)
            {
                string url = urlTextBox.Text.Trim();

                // If URL is empty or just "https://", use "start_browser" value
                // Otherwise use the URL as value
                string actionValue = (string.IsNullOrEmpty(url) || url == "https://")
                    ? "start_browser"
                    : url;

                InsertActionAfterSelected("custom", "🌐 Start Browser - Open Chromium", actionValue);
                AppendOutput($"🌐 Added 'Open Browser' action{(actionValue != "start_browser" ? $" with URL: {actionValue}" : "")}\n");
            }
        }

        private void MenuAddCloseBrowser_Click(object sender, RoutedEventArgs e)
        {
            if (dgTestSteps.SelectedItem == null)
            {
                MessageBox.Show("Please select a test step first.", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            InsertActionAfterSelected("custom", "🔴 Close Browser", "close_browser");
            AppendOutput("🔴 Added 'Close Browser' action\n");
        }

        private void BtnAddNavigate_Click(object sender, RoutedEventArgs e)
        {
            // Show dialog to input URL
            var inputDialog = new Window
            {
                Title = "Add Navigate to URL",
                Width = 500,
                Height = 180,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Owner = this
            };

            var panel = new StackPanel { Margin = new Thickness(20) };
            panel.Children.Add(new TextBlock
            {
                Text = "Enter URL to navigate to:",
                Margin = new Thickness(0, 0, 0, 10),
                FontWeight = FontWeights.SemiBold
            });

            var txtUrl = new TextBox
            {
                Text = suiteUrl ?? "https://",
                Margin = new Thickness(0, 0, 0, 20),
                Padding = new Thickness(8),
                FontSize = 14
            };
            panel.Children.Add(txtUrl);

            var btnPanel = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right
            };

            var btnOk = new Button
            {
                Content = "Add",
                Width = 80,
                Height = 32,
                Background = new SolidColorBrush(Color.FromRgb(59, 130, 246)),
                Foreground = Brushes.White,
                FontWeight = FontWeights.SemiBold
            };
            btnOk.Click += (s, args) => {
                if (string.IsNullOrWhiteSpace(txtUrl.Text))
                {
                    MessageBox.Show("Please enter a valid URL.", "Validation", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }
                inputDialog.DialogResult = true;
                inputDialog.Close();
            };
            btnPanel.Children.Add(btnOk);

            panel.Children.Add(btnPanel);
            inputDialog.Content = panel;

            if (inputDialog.ShowDialog() == true)
            {
                string url = txtUrl.Text.Trim();

                if (dgTestSteps.SelectedItem != null)
                {
                    InsertActionAfterSelected("navigate", $"🔗 Navigate to {url}", url);
                }
                else
                {
                    // No selection - add at end
                    var newAction = new TestStepInfo
                    {
                        Id = Guid.NewGuid().ToString(),
                        StepNumber = testSteps.Count + 1,
                        Type = "NAVIGATE",
                        ObjectName = "",
                        Description = $"Navigate to {url}",
                        Value = url
                    };
                    testSteps.Add(newAction);
                    SaveTestStepsOrder();
                }

                AppendOutput($"✅ Added Navigate to URL: {url}\n");
            }
        }

        private void MenuAddNavigateToUrl_Click(object sender, RoutedEventArgs e)
        {
            if (dgTestSteps.SelectedItem == null)
            {
                MessageBox.Show("Please select a test step first.", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            // Show dialog to enter URL
            var urlDialog = new Window
            {
                Title = "Navigate to URL",
                Width = 500,
                Height = 180,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Owner = this
            };

            var panel = new System.Windows.Controls.StackPanel { Margin = new Thickness(20) };
            panel.Children.Add(new System.Windows.Controls.TextBlock
            {
                Text = "Enter URL:",
                Margin = new Thickness(0, 0, 0, 10),
                FontWeight = FontWeights.SemiBold
            });

            var txtUrl = new System.Windows.Controls.TextBox
            {
                Text = suiteUrl ?? "https://",
                Margin = new Thickness(0, 0, 0, 20),
                Padding = new Thickness(8),
                FontSize = 14
            };
            panel.Children.Add(txtUrl);

            var btnPanel = new System.Windows.Controls.StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right
            };

            var btnCancel = new System.Windows.Controls.Button
            {
                Content = "Cancel",
                Width = 80,
                Height = 32,
                Margin = new Thickness(0, 0, 10, 0)
            };
            btnCancel.Click += (s, args) => {
                urlDialog.DialogResult = false;
                urlDialog.Close();
            };
            btnPanel.Children.Add(btnCancel);

            var btnOk = new System.Windows.Controls.Button
            {
                Content = "Add",
                Width = 80,
                Height = 32,
                Background = new SolidColorBrush(Color.FromRgb(59, 130, 246)),
                Foreground = Brushes.White,
                FontWeight = FontWeights.SemiBold
            };
            btnOk.Click += (s, args) => {
                if (string.IsNullOrWhiteSpace(txtUrl.Text))
                {
                    MessageBox.Show("Please enter a valid URL.", "Validation", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }
                urlDialog.DialogResult = true;
                urlDialog.Close();
            };
            btnPanel.Children.Add(btnOk);

            panel.Children.Add(btnPanel);

            urlDialog.Content = panel;

            if (urlDialog.ShowDialog() == true)
            {
                string url = txtUrl.Text.Trim();
                InsertActionAfterSelected("navigate", $"🔗 Navigate to {url}", url);
                AppendOutput($"🔗 Added 'Navigate to URL' action: {url}\n");
            }
        }

        private void MenuAddDelay_Click(object sender, RoutedEventArgs e)
        {
            if (dgTestSteps.SelectedItem == null)
            {
                MessageBox.Show("Please select a test step first.", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            // Show dialog to enter delay duration
            var delayDialog = new Window
            {
                Title = "Add Delay",
                Width = 400,
                Height = 200,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Owner = this
            };

            var panel = new System.Windows.Controls.StackPanel { Margin = new Thickness(20) };
            panel.Children.Add(new System.Windows.Controls.TextBlock { Text = "Delay Duration (milliseconds):", Margin = new Thickness(0, 0, 0, 10) });

            var txtDelay = new System.Windows.Controls.TextBox { Text = "1000", Margin = new Thickness(0, 0, 0, 20) };
            panel.Children.Add(txtDelay);

            var btnOk = new System.Windows.Controls.Button { Content = "Add Delay", Width = 100, Height = 30 };
            btnOk.Click += (s, args) => {
                delayDialog.DialogResult = true;
                delayDialog.Close();
            };
            panel.Children.Add(btnOk);

            delayDialog.Content = panel;

            if (delayDialog.ShowDialog() == true)
            {
                int delayMs = int.Parse(txtDelay.Text);
                InsertActionAfterSelected("wait", $"Wait for {delayMs}ms", delayMs.ToString());
            }
        }

        private void MenuAddPressKey_Click(object sender, RoutedEventArgs e)
        {
            if (dgTestSteps.SelectedItem == null)
            {
                MessageBox.Show("Please select a test step first.", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            // Show dialog to select key
            var keyDialog = new Window
            {
                Title = "Press Key",
                Width = 400,
                Height = 220,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Owner = this
            };

            var panel = new System.Windows.Controls.StackPanel { Margin = new Thickness(20) };
            panel.Children.Add(new System.Windows.Controls.TextBlock { Text = "Select Key to Press:", Margin = new Thickness(0, 0, 0, 10), FontWeight = FontWeights.SemiBold });

            var comboKey = new System.Windows.Controls.ComboBox { Margin = new Thickness(0, 0, 0, 20) };
            comboKey.Items.Add("Enter");
            comboKey.Items.Add("Tab");
            comboKey.Items.Add("Escape");
            comboKey.Items.Add("ArrowUp");
            comboKey.Items.Add("ArrowDown");
            comboKey.Items.Add("ArrowLeft");
            comboKey.Items.Add("ArrowRight");
            comboKey.Items.Add("F1");
            comboKey.Items.Add("F2");
            comboKey.Items.Add("F3");
            comboKey.Items.Add("F4");
            comboKey.Items.Add("F5");
            comboKey.Items.Add("F12");
            comboKey.SelectedIndex = 0; // Default to Enter
            panel.Children.Add(comboKey);

            var btnOk = new System.Windows.Controls.Button
            {
                Content = "Add",
                Width = 100,
                Height = 30,
                Background = new SolidColorBrush(Color.FromRgb(59, 130, 246)),
                Foreground = Brushes.White,
                FontWeight = FontWeights.SemiBold
            };
            btnOk.Click += (s, args) => {
                keyDialog.DialogResult = true;
                keyDialog.Close();
            };
            panel.Children.Add(btnOk);

            keyDialog.Content = panel;

            if (keyDialog.ShowDialog() == true)
            {
                string key = comboKey.SelectedItem?.ToString() ?? "Enter";
                InsertActionAfterSelected("press_key", $"Press {key} key", key);
                AppendOutput($"⌨️ Added 'Press Key' action: {key}\n");
            }
        }

        private void MenuAddWaitFor_Click(object sender, RoutedEventArgs e)
        {
            if (dgTestSteps.SelectedItem == null)
            {
                MessageBox.Show("Please select a test step first.", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            // Show dialog to enter element selector
            var waitDialog = new Window
            {
                Title = "Add Wait For Element",
                Width = 500,
                Height = 250,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Owner = this
            };

            var panel = new System.Windows.Controls.StackPanel { Margin = new Thickness(20) };
            panel.Children.Add(new System.Windows.Controls.TextBlock { Text = "Element Selector (CSS/XPath):", Margin = new Thickness(0, 0, 0, 10) });

            var txtSelector = new System.Windows.Controls.TextBox { Margin = new Thickness(0, 0, 0, 10) };
            panel.Children.Add(txtSelector);

            var btnPick = new System.Windows.Controls.Button { Content = "🎯 Pick Element from Browser", Width = 200, Height = 30, Margin = new Thickness(0, 0, 0, 20) };
            btnPick.Click += async (s, args) => {
                try
                {
                    btnPick.IsEnabled = false;
                    btnPick.Content = "Picking element...";

                    // Call the pick-element command
                    var pickProcess = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "node",
                        Arguments = "dist/index.js pick-element",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true,
                        WorkingDirectory = Directory.GetCurrentDirectory()
                    };

                    var process = System.Diagnostics.Process.Start(pickProcess);
                    var output = await process.StandardOutput.ReadToEndAsync();
                    var errorOutput = await process.StandardError.ReadToEndAsync();
                    await process.WaitForExitAsync();

                    // Log all output for debugging
                    if (!string.IsNullOrWhiteSpace(output))
                    {
                        Console.WriteLine("=== PICK ELEMENT OUTPUT ===");
                        Console.WriteLine(output);
                        Console.WriteLine("===========================");
                    }

                    if (!string.IsNullOrWhiteSpace(errorOutput))
                    {
                        Console.WriteLine("=== PICK ELEMENT ERRORS ===");
                        Console.WriteLine(errorOutput);
                        Console.WriteLine("===========================");
                    }

                    // Parse the output to get the selector
                    var lines = output.Split('\n');
                    foreach (var line in lines)
                    {
                        if (line.StartsWith("SELECTED_ELEMENT:"))
                        {
                            txtSelector.Text = line.Substring("SELECTED_ELEMENT:".Length).Trim();
                            break;
                        }
                    }

                    btnPick.Content = "🎯 Pick Element from Browser";
                    btnPick.IsEnabled = true;
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Error picking element: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    btnPick.Content = "🎯 Pick Element from Browser";
                    btnPick.IsEnabled = true;
                }
            };
            panel.Children.Add(btnPick);

            var btnOk = new System.Windows.Controls.Button { Content = "Add Wait", Width = 100, Height = 30 };
            btnOk.Click += (s, args) => {
                waitDialog.DialogResult = true;
                waitDialog.Close();
            };
            panel.Children.Add(btnOk);

            waitDialog.Content = panel;

            if (waitDialog.ShowDialog() == true)
            {
                InsertActionAfterSelected("wait_for_element", $"Wait for element: {txtSelector.Text}", txtSelector.Text);
            }
        }

        private void MenuContinueIfFail_Click(object sender, RoutedEventArgs e)
        {
            if (dgTestSteps.SelectedItem == null)
            {
                MessageBox.Show("Please select a test step first.", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            // TODO: Toggle continue-on-failure flag for the selected step
            MessageBox.Show("Continue if Fail flag will be toggled for this step.", "Feature", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private async void MenuStartRecordingFromHere_Click(object sender, RoutedEventArgs e)
        {
            if (dgTestSteps.SelectedItem == null)
            {
                MessageBox.Show("Please select a test step first.", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            if (string.IsNullOrEmpty(currentTestFilePath))
            {
                MessageBox.Show("No test case loaded.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }

            // Stop any running execution first
            if (currentCompletionSource != null)
            {
                AppendOutput("\n⏹️ Stopping current execution before starting recording...\n");
                currentCompletionSource.TrySetResult(true);
                currentCompletionSource = null;
                await Task.Delay(500); // Give executor time to stop
            }

            // Stop any existing recording first
            if (recordingProcess != null && !recordingProcess.HasExited)
            {
                AppendOutput("\n⏹️ Stopping existing recording before starting new one...\n");
                try
                {
                    recordingProcess.StandardInput.WriteLine("stop");
                    recordingProcess.StandardInput.Flush();
                    await Task.Delay(1000); // Give recorder time to stop
                }
                catch (Exception ex)
                {
                    AppendOutput($"⚠️ Error stopping existing recording: {ex.Message}\n");
                }
                UpdateRecordingUI(false);
            }

            var selectedStep = (TestStepInfo)dgTestSteps.SelectedItem;

            // Ask user if they want auto-setup or manual
            var result = ModernMessageBox.Show(
                $"Do you want to automatically execute steps 1-{selectedStep.StepNumber} before recording?\n\n" +
                "• YES - Auto-execute previous steps to reach the correct state\n" +
                "• NO - Recording starts immediately (use current browser state)\n\n" +
                "Note: The existing browser will be reused for recording.",
                "Start Recording from Here",
                ModernMessageBoxType.Question,
                ModernMessageBoxButtons.YesNoCancel,
                this);

            if (result == ModernMessageBoxResult.Cancel)
                return;

            try
            {
                if (result == ModernMessageBoxResult.Yes)
                {
                    // Execute all steps up to the selected one to get to that state
                    AppendOutput($"\n🎬 Auto-executing steps 1-{selectedStep.StepNumber} to reach recording point...\n");

                    // Create a temporary test case with only the steps up to the selected one
                    string testJson = File.ReadAllText(currentTestFilePath);
                    using (JsonDocument doc = JsonDocument.Parse(testJson))
                    {
                        var root = doc.RootElement;
                        var actions = root.GetProperty("actions").EnumerateArray().Take(selectedStep.StepNumber).ToList();

                        // Create temp test file
                        var tempTest = new
                        {
                            id = "temp-" + Guid.NewGuid().ToString(),
                            name = "Temp Setup",
                            description = "Setup for recording continuation",
                            platform = root.GetProperty("platform").GetString(),
                            actions = actions.Select(a => JsonSerializer.Deserialize<object>(a.GetRawText())).ToList(),
                            createdAt = DateTimeOffset.Now.ToUnixTimeMilliseconds(),
                            updatedAt = DateTimeOffset.Now.ToUnixTimeMilliseconds()
                        };

                        string tempPath = Path.Combine(Path.GetTempPath(), "qa-temp-setup.json");
                        File.WriteAllText(tempPath, JsonSerializer.Serialize(tempTest, new JsonSerializerOptions { WriteIndented = true }));

                        // Execute the temp test to get to the desired state
                        await ExecuteCommandAsync($"execute \"{tempPath}\"");

                        // Clean up temp file
                        File.Delete(tempPath);
                    }

                    AppendOutput($"✅ Auto-setup complete. Now starting recorder...\n");
                }
                else if (result == ModernMessageBoxResult.No)
                {
                    AppendOutput($"✅ Manual navigation selected.\n");
                    AppendOutput($"📝 Recorder will open a new browser. Please manually navigate to the correct state before recording.\n");
                }

                // Start web recorder with the CURRENT test file (not a new test)
                // Get the current test info
                string currentTestJson = File.ReadAllText(currentTestFilePath);
                using (JsonDocument currentDoc = JsonDocument.Parse(currentTestJson))
                {
                    var currentRoot = currentDoc.RootElement;
                    string currentTestName = currentRoot.GetProperty("name").GetString() ?? "Untitled";

                    AppendOutput($"🎥 Continuing recording for test: {currentTestName}\n");
                    AppendOutput($"📝 New steps will be appended after step {selectedStep.StepNumber}\n");

                    // Start the recorder - it will append to the existing test file
                    string startUrl = suiteUrl ?? "https://example.com";
                    string recordArgs = $"record:web -n \"{currentTestName}\" -u \"{startUrl}\" -o \"{Path.GetDirectoryName(currentTestFilePath)}\" --continue";

                    // Use a separate method for continuing recording (don't interfere with normal Start Recording)
                    StartContinueRecording(recordArgs);
                }
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Error: {ex.Message}\n");
                MessageBox.Show($"Failed to start recording from this point: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void InsertActionAfterSelected(string actionType, string description, string value)
        {
            if (string.IsNullOrEmpty(currentTestFilePath) || dgTestSteps.SelectedItem == null)
            {
                return;
            }

            try
            {
                var selectedStep = (TestStepInfo)dgTestSteps.SelectedItem;

                // Read current test case
                string jsonContent = File.ReadAllText(currentTestFilePath);
                using (JsonDocument testCaseDoc = JsonDocument.Parse(jsonContent))
                {
                    var root = testCaseDoc.RootElement;

                    // Build new JSON with inserted action
                    var actionsArray = new System.Collections.Generic.List<object>();
                    bool inserted = false;

                    foreach (var action in root.GetProperty("actions").EnumerateArray())
                    {
                        // Copy existing action as dictionary
                        var actionDict = new System.Collections.Generic.Dictionary<string, object>();
                        foreach (var prop in action.EnumerateObject())
                        {
                            actionDict[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText());
                        }
                        actionsArray.Add(actionDict);

                        // Insert after matching ID
                        if (action.GetProperty("id").GetString() == selectedStep.Id && !inserted)
                        {
                            // Create new action
                            var newAction = new System.Collections.Generic.Dictionary<string, object>
                            {
                                ["id"] = Guid.NewGuid().ToString(),
                                ["timestamp"] = DateTimeOffset.Now.ToUnixTimeMilliseconds(),
                                ["platform"] = "web",
                                ["type"] = actionType,
                                ["value"] = value,
                                ["description"] = description,
                                ["metadata"] = new System.Collections.Generic.Dictionary<string, object>()
                            };
                            actionsArray.Add(newAction);
                            inserted = true;
                        }
                    }

                    // Create updated test case
                    var updatedTestCase = new System.Collections.Generic.Dictionary<string, object>
                    {
                        ["id"] = root.GetProperty("id").GetString(),
                        ["name"] = root.GetProperty("name").GetString(),
                        ["description"] = root.GetProperty("description").GetString(),
                        ["platform"] = root.GetProperty("platform").GetString(),
                        ["actions"] = actionsArray,
                        ["createdAt"] = root.GetProperty("createdAt").GetInt64(),
                        ["updatedAt"] = DateTimeOffset.Now.ToUnixTimeMilliseconds()
                    };

                    // Save updated test case
                    var options = new JsonSerializerOptions { WriteIndented = true };
                    string updatedJson = JsonSerializer.Serialize(updatedTestCase, options);
                    File.WriteAllText(currentTestFilePath, updatedJson);
                }

                // Reload test steps to show the change
                LoadObjectRepository();
                LoadTestSteps(currentTestFilePath);

                AppendOutput($"✅ Added {actionType} action after step {selectedStep.StepNumber}\n");
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Error inserting action: {ex.Message}\n");
            }
        }

        private void LoadTestReport(string reportPath)
        {
            try
            {
                AppendOutput($"📄 Loading report from: {reportPath}\n");

                if (!File.Exists(reportPath))
                {
                    AppendOutput($"❌ Report file not found: {reportPath}\n");
                    return;
                }

                reportSteps.Clear();

                string jsonContent = File.ReadAllText(reportPath);
                AppendOutput($"📄 Report file size: {jsonContent.Length} characters\n");
                using (JsonDocument doc = JsonDocument.Parse(jsonContent))
                {
                    var root = doc.RootElement;
                    var summary = root.GetProperty("summary");
                    var results = root.GetProperty("results");

                    // Get total steps from results (loop through ALL test cases in suite)
                    int totalSteps = 0;
                    int passedSteps = 0;
                    int failedSteps = 0;

                    int testCaseCount = results.GetArrayLength();
                    AppendOutput($"📊 Loading report with {testCaseCount} test case(s)\n");

                    foreach (var testResult in results.EnumerateArray())
                    {
                        string testCaseId = testResult.GetProperty("testCaseId").GetString() ?? "Unknown";
                        var steps = testResult.GetProperty("steps");
                        int stepCount = steps.GetArrayLength();
                        totalSteps += stepCount;

                        AppendOutput($"   ✓ {testCaseId}: {stepCount} steps\n");

                        foreach (var step in steps.EnumerateArray())
                        {
                            string status = step.GetProperty("status").GetString() ?? "";
                            if (status == "passed") passedSteps++;
                            else if (status == "failed") failedSteps++;
                        }
                    }

                    AppendOutput($"📊 Total: {totalSteps} steps, {passedSteps} passed, {failedSteps} failed\n");

                    int totalDuration = summary.GetProperty("totalDuration").GetInt32();

                    // Update summary labels
                    lblTotalSteps.Text = totalSteps.ToString();
                    lblPassedSteps.Text = passedSteps.ToString();
                    lblFailedSteps.Text = failedSteps.ToString();
                    lblSuccessRate.Text = totalSteps > 0 ? $"{(passedSteps * 100.0 / totalSteps):F1}%" : "0%";
                    lblTotalTime.Text = $"{totalDuration}ms ({totalDuration / 1000.0:F2}s)";
                    lblReportDate.Text = $"Report generated: {DateTime.Now:yyyy-MM-dd HH:mm:ss}";

                    // Draw pie chart
                    DrawPieChart(passedSteps, failedSteps);

                    // Load detailed step results from ALL test cases
                    int stepNum = 1;
                    foreach (var testResult in results.EnumerateArray())
                    {
                        var steps = testResult.GetProperty("steps");

                        foreach (var step in steps.EnumerateArray())
                        {
                            string actionId = step.GetProperty("actionId").GetString() ?? "";
                            string status = step.GetProperty("status").GetString() ?? "";
                            int duration = step.GetProperty("duration").GetInt32();
                            string error = step.TryGetProperty("error", out var err) ? err.GetString() ?? "" : "";

                            // Get action and object from step directly (suite report includes them)
                            string action = step.TryGetProperty("action", out var actProp) ? actProp.GetString() ?? "UNKNOWN" : "UNKNOWN";
                            string obj = step.TryGetProperty("object", out var objProp) ? objProp.GetString() ?? "" : "";

                            reportSteps.Add(new ReportStepInfo
                            {
                                StepNumber = stepNum++,
                                Status = status.ToLower() == "passed" ? "✓ PASSED" : "✗ FAILED",
                                Action = action.ToUpper(),
                                Object = obj,
                                ExecutionTime = duration.ToString(),
                                ErrorMessage = error.Length > 100 ? error.Substring(0, 97) + "..." : error
                            });
                        }
                    }

                    AppendOutput($"📊 Report loaded: {passedSteps} passed, {failedSteps} failed, {totalDuration}ms total\n");
                }
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Error loading report: {ex.Message}\n");
            }
        }

        private void DrawPieChart(int passed, int failed)
        {
            pieChart.Children.Clear();

            int total = passed + failed;
            if (total == 0) return;

            double centerX = 90;
            double centerY = 90;
            double radius = 80;

            // If 100% passed, draw a full green circle
            if (failed == 0)
            {
                var fullCircle = new System.Windows.Shapes.Ellipse
                {
                    Width = radius * 2,
                    Height = radius * 2,
                    Fill = new SolidColorBrush(Color.FromRgb(16, 185, 129)) // Green
                };
                System.Windows.Controls.Canvas.SetLeft(fullCircle, centerX - radius);
                System.Windows.Controls.Canvas.SetTop(fullCircle, centerY - radius);
                pieChart.Children.Add(fullCircle);
            }
            else
            {
                double passedAngle = (passed * 360.0) / total;
                double failedAngle = (failed * 360.0) / total;

                // Draw passed slice (green)
                if (passed > 0)
                {
                    var passedPath = CreatePieSlice(centerX, centerY, radius, 0, passedAngle, Color.FromRgb(16, 185, 129));
                    pieChart.Children.Add(passedPath);
                }

                // Draw failed slice (red)
                if (failed > 0)
                {
                    var failedPath = CreatePieSlice(centerX, centerY, radius, passedAngle, passedAngle + failedAngle, Color.FromRgb(239, 68, 68));
                    pieChart.Children.Add(failedPath);
                }
            }

            // Add center circle (dark background)
            var centerCircle = new System.Windows.Shapes.Ellipse
            {
                Width = radius * 0.6,
                Height = radius * 0.6,
                Fill = new SolidColorBrush(Color.FromRgb(15, 23, 42))
            };
            System.Windows.Controls.Canvas.SetLeft(centerCircle, centerX - radius * 0.3);
            System.Windows.Controls.Canvas.SetTop(centerCircle, centerY - radius * 0.3);
            pieChart.Children.Add(centerCircle);

            // Add percentage text
            var percentText = new System.Windows.Controls.TextBlock
            {
                Text = $"{(passed * 100.0 / total):F0}%",
                FontSize = 24,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                TextAlignment = System.Windows.TextAlignment.Center
            };
            System.Windows.Controls.Canvas.SetLeft(percentText, centerX - 30);
            System.Windows.Controls.Canvas.SetTop(percentText, centerY - 12);
            pieChart.Children.Add(percentText);
        }

        private System.Windows.Shapes.Path CreatePieSlice(double centerX, double centerY, double radius, double startAngle, double endAngle, Color color)
        {
            double startRad = startAngle * Math.PI / 180.0;
            double endRad = endAngle * Math.PI / 180.0;

            double x1 = centerX + radius * Math.Cos(startRad - Math.PI / 2);
            double y1 = centerY + radius * Math.Sin(startRad - Math.PI / 2);
            double x2 = centerX + radius * Math.Cos(endRad - Math.PI / 2);
            double y2 = centerY + radius * Math.Sin(endRad - Math.PI / 2);

            bool largeArc = (endAngle - startAngle) > 180;

            var path = new System.Windows.Shapes.Path
            {
                Fill = new SolidColorBrush(color),
                Data = System.Windows.Media.Geometry.Parse(
                    $"M {centerX},{centerY} L {x1},{y1} A {radius},{radius} 0 {(largeArc ? 1 : 0)} 1 {x2},{y2} Z"
                )
            };

            return path;
        }

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            if (recordingProcess != null && !recordingProcess.HasExited)
            {
                recordingProcess.Kill();
            }
            base.OnClosing(e);
        }

        // Drag-and-drop for Test Steps
        private TestStepInfo? draggedStep;

        private void DgTestSteps_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.OriginalSource is FrameworkElement element)
            {
                // Don't start drag if clicking on a button or other interactive element
                if (element is Button || FindParent<Button>(element) != null)
                {
                    return;
                }

                var row = FindParent<DataGridRow>(element);
                if (row != null && row.Item is TestStepInfo step)
                {
                    draggedStep = step;
                    DragDrop.DoDragDrop(dgTestSteps, step, DragDropEffects.Move);
                }
            }
        }

        private void DgTestSteps_Drop(object sender, DragEventArgs e)
        {
            if (draggedStep != null && e.Data.GetDataPresent(typeof(TestStepInfo)))
            {
                var target = GetDataGridRowAtPoint(dgTestSteps, e.GetPosition(dgTestSteps));
                if (target != null && target.Item is TestStepInfo targetStep && draggedStep != targetStep)
                {
                    int draggedIndex = testSteps.IndexOf(draggedStep);
                    int targetIndex = testSteps.IndexOf(targetStep);

                    if (draggedIndex >= 0 && targetIndex >= 0)
                    {
                        // Reorder in the collection
                        testSteps.RemoveAt(draggedIndex);
                        testSteps.Insert(targetIndex, draggedStep);

                        // Renumber steps
                        for (int i = 0; i < testSteps.Count; i++)
                        {
                            testSteps[i].StepNumber = i + 1;
                        }

                        // Save to file
                        SaveTestStepsOrder();
                        AppendOutput($"📝 Reordered step {draggedIndex + 1} to position {targetIndex + 1}\n");
                    }
                }
            }
            draggedStep = null;
        }

        // Drag-and-drop for Test Cases
        private TestCaseInfo? draggedTestCase;

        private void DgTestCases_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.OriginalSource is FrameworkElement element)
            {
                // Don't start drag if clicking on a button or other interactive element
                if (element is Button || FindParent<Button>(element) != null)
                {
                    return;
                }

                var row = FindParent<DataGridRow>(element);
                if (row != null && row.Item is TestCaseInfo testCase)
                {
                    draggedTestCase = testCase;
                    DragDrop.DoDragDrop(dgTestCases, testCase, DragDropEffects.Move);
                }
            }
        }

        private void DgTestCases_Drop(object sender, DragEventArgs e)
        {
            if (draggedTestCase != null && e.Data.GetDataPresent(typeof(TestCaseInfo)))
            {
                var target = GetDataGridRowAtPoint(dgTestCases, e.GetPosition(dgTestCases));
                if (target != null && target.Item is TestCaseInfo targetCase && draggedTestCase != targetCase)
                {
                    int draggedIndex = testCases.IndexOf(draggedTestCase);
                    int targetIndex = testCases.IndexOf(targetCase);

                    if (draggedIndex >= 0 && targetIndex >= 0)
                    {
                        // Reorder in the collection
                        testCases.RemoveAt(draggedIndex);
                        testCases.Insert(targetIndex, draggedTestCase);

                        // Save to suite config
                        SaveTestCasesOrder();
                        AppendOutput($"📝 Reordered test case from position {draggedIndex + 1} to {targetIndex + 1}\n");
                    }
                }
            }
            draggedTestCase = null;
        }

        // Helper methods
        private T? FindParent<T>(DependencyObject child) where T : DependencyObject
        {
            DependencyObject? parentObject = VisualTreeHelper.GetParent(child);
            if (parentObject == null) return null;
            if (parentObject is T parent) return parent;
            return FindParent<T>(parentObject);
        }

        private DataGridRow? GetDataGridRowAtPoint(DataGrid grid, Point point)
        {
            var element = grid.InputHitTest(point) as UIElement;
            if (element != null)
            {
                return FindParent<DataGridRow>(element);
            }
            return null;
        }

        private void SaveTestStepsOrder()
        {
            if (string.IsNullOrEmpty(currentTestFilePath))
                return;

            try
            {
                // Read current test case
                string jsonContent = File.ReadAllText(currentTestFilePath);
                using (JsonDocument testCaseDoc = JsonDocument.Parse(jsonContent))
                {
                    var root = testCaseDoc.RootElement;

                    // Get actions in current UI order, WITH UPDATED VALUES FROM UI
                    var actionsArray = new System.Collections.Generic.List<object>();
                    foreach (var step in testSteps)
                    {
                        // Find the action by ID
                        foreach (var action in root.GetProperty("actions").EnumerateArray())
                        {
                            if (action.GetProperty("id").GetString() == step.Id)
                            {
                                var actionDict = new System.Collections.Generic.Dictionary<string, object>();
                                foreach (var prop in action.EnumerateObject())
                                {
                                    actionDict[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText());
                                }

                                // Update with values from UI (if changed)
                                actionDict["type"] = step.Type.ToLower().Replace(" ", "_");
                                actionDict["description"] = step.Description;

                                // Update target object path if it exists
                                if (actionDict.ContainsKey("target") && actionDict["target"] is JsonElement targetElement)
                                {
                                    var targetDict = JsonSerializer.Deserialize<System.Collections.Generic.Dictionary<string, object>>(targetElement.GetRawText());
                                    if (targetDict != null && targetDict.ContainsKey("value"))
                                    {
                                        targetDict["value"] = step.ObjectName;
                                        actionDict["target"] = targetDict;
                                    }
                                }
                                else if (!string.IsNullOrEmpty(step.ObjectName))
                                {
                                    // For actions like TYPE, update the value field
                                    actionDict["value"] = step.ObjectName;
                                }

                                actionsArray.Add(actionDict);
                                break;
                            }
                        }
                    }

                    // Create updated test case
                    var updatedTestCase = new System.Collections.Generic.Dictionary<string, object>
                    {
                        ["id"] = root.GetProperty("id").GetString(),
                        ["name"] = root.GetProperty("name").GetString(),
                        ["description"] = root.GetProperty("description").GetString(),
                        ["platform"] = root.GetProperty("platform").GetString(),
                        ["actions"] = actionsArray,
                        ["createdAt"] = root.GetProperty("createdAt").GetInt64(),
                        ["updatedAt"] = DateTimeOffset.Now.ToUnixTimeMilliseconds()
                    };

                    // Save updated test case
                    var options = new JsonSerializerOptions { WriteIndented = true };
                    string updatedJson = JsonSerializer.Serialize(updatedTestCase, options);
                    File.WriteAllText(currentTestFilePath, updatedJson);
                }
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Error saving test steps: {ex.Message}\n");
            }
        }

        private void DgTestSteps_CellEditEnding(object sender, DataGridCellEditEndingEventArgs e)
        {
            // Save changes when user finishes editing a cell
            Dispatcher.BeginInvoke(new Action(() =>
            {
                SaveTestStepsOrder();
                AppendOutput($"💾 Saved changes to test step\n");
            }), System.Windows.Threading.DispatcherPriority.Background);
        }

        private void SaveTestCasesOrder()
        {
            if (string.IsNullOrEmpty(suiteConfigPath))
                return;

            try
            {
                // Read current suite config
                string jsonContent = File.ReadAllText(suiteConfigPath);
                using (JsonDocument doc = JsonDocument.Parse(jsonContent))
                {
                    var root = doc.RootElement;

                    // Get test cases in current UI order
                    var testCasesList = new System.Collections.Generic.List<string>();
                    foreach (var testCase in testCases)
                    {
                        testCasesList.Add(testCase.FilePath);
                    }

                    // Create updated suite config
                    var updatedConfig = new System.Collections.Generic.Dictionary<string, object>
                    {
                        ["name"] = root.GetProperty("name").GetString(),
                        ["description"] = root.GetProperty("description").GetString(),
                        ["platform"] = root.GetProperty("platform").GetString(),
                        ["tests"] = testCasesList,
                        ["createdAt"] = root.GetProperty("createdAt").GetString(),
                        ["updatedAt"] = DateTime.Now.ToString("o")
                    };

                    // Add optional properties if they exist
                    if (root.TryGetProperty("urlOrPath", out var urlProp))
                    {
                        updatedConfig["urlOrPath"] = urlProp.GetString();
                    }

                    // Save updated suite config
                    var options = new JsonSerializerOptions { WriteIndented = true };
                    string updatedJson = JsonSerializer.Serialize(updatedConfig, options);
                    File.WriteAllText(suiteConfigPath, updatedJson);
                }
            }
            catch (Exception ex)
            {
                AppendOutput($"❌ Error saving test cases order: {ex.Message}\n");
            }
        }
    }
}
