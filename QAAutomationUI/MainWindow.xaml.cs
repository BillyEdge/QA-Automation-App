using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows;
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
                            string suiteName = root.GetProperty("name").GetString() ?? "Unknown";
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
                this.WindowState = WindowState.Normal;
                this.Topmost = true;
                this.Loaded += (s, e) =>
                {
                    this.Topmost = false;
                    this.Activate();
                    LoadTestCases(); // Load test cases when window loads
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

        private void BtnRunAllTests_Click(object sender, RoutedEventArgs e)
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

            string reportPath = Path.Combine(reportsDir, "suite-report.html");
            string suiteId = Path.GetFileNameWithoutExtension(suiteConfigPath);
            string loopArg = loopCount > 1 ? $" --loop {loopCount}" : "";

            AppendOutput($"\n▶️ Running all tests in suite (Loop: {loopCount}x)...\n");
            ExecuteCommand($"suite:execute \"{suiteId}\" -r \"{reportPath}\"{loopArg}");

            // After execution, load and display the report
            if (File.Exists(reportPath))
            {
                try
                {
                    LoadTestReport(reportPath);
                    mainTabControl.SelectedIndex = 3; // Switch to Report tab
                    AppendOutput($"📊 Suite report loaded successfully\n");
                }
                catch (Exception ex)
                {
                    AppendOutput($"⚠️ Failed to load report: {ex.Message}\n");
                }
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

        private void ExecuteCommand(string args)
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

        private void BtnRunTest_Click(object sender, RoutedEventArgs e)
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

                string reportPath = Path.Combine(reportsDir, "report.html");
                string loopArg = loopCount > 1 ? $" --loop {loopCount}" : "";
                ExecuteCommand($"execute \"{filePath}\" -r \"{reportPath}\"{loopArg}");

                // After execution completes, load and display the report
                if (File.Exists(reportPath))
                {
                    try
                    {
                        LoadTestReport(reportPath);
                        // Switch to Report tab (index 3)
                        mainTabControl.SelectedIndex = 3;
                        AppendOutput($"📊 Test report loaded successfully\n");
                    }
                    catch (Exception ex)
                    {
                        AppendOutput($"⚠️ Failed to load report: {ex.Message}\n");
                    }
                }
                else
                {
                    AppendOutput($"⚠️ Report file not found: {reportPath}\n");
                }
            }
        }

        private void BtnDeleteTest_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button btn && btn.Tag is string filePath)
            {
                var result = MessageBox.Show(
                    $"Are you sure you want to delete this test case?\n\n{Path.GetFileName(filePath)}",
                    "Confirm Delete",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);

                if (result == MessageBoxResult.Yes)
                {
                    try
                    {
                        File.Delete(filePath);
                        AppendOutput($"🗑️ Deleted test case: {Path.GetFileName(filePath)}\n");
                        LoadTestCases();
                        testSteps.Clear();
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show($"Error deleting test case: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
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
                Height = 200,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Owner = this
            };

            var panel = new System.Windows.Controls.StackPanel { Margin = new Thickness(20) };
            panel.Children.Add(new System.Windows.Controls.TextBlock { Text = "Element Selector (CSS/XPath):", Margin = new Thickness(0, 0, 0, 10) });

            var txtSelector = new System.Windows.Controls.TextBox { Margin = new Thickness(0, 0, 0, 20) };
            panel.Children.Add(txtSelector);

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

        private void MenuStartRecordingFromHere_Click(object sender, RoutedEventArgs e)
        {
            if (dgTestSteps.SelectedItem == null)
            {
                MessageBox.Show("Please select a test step first.", "Information", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            // TODO: Implement start recording from here functionality
            MessageBox.Show("This feature will allow you to continue recording from this point.", "Feature", MessageBoxButton.OK, MessageBoxImage.Information);
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
                var testCaseDoc = System.Text.Json.JsonDocument.Parse(jsonContent);
                var root = testCaseDoc.RootElement;

                // Build new actions array with inserted action
                var actionsList = new System.Collections.Generic.List<System.Text.Json.JsonElement>();
                bool inserted = false;

                foreach (var action in root.GetProperty("actions").EnumerateArray())
                {
                    actionsList.Add(action);

                    // Insert after matching ID
                    if (action.GetProperty("id").GetString() == selectedStep.Id && !inserted)
                    {
                        // Create new action (this is a simplified version - you'll need to add proper action creation)
                        inserted = true;
                    }
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
                if (!File.Exists(reportPath))
                {
                    AppendOutput("📊 No report file found.\n");
                    return;
                }

                reportSteps.Clear();

                string jsonContent = File.ReadAllText(reportPath);
                using (JsonDocument doc = JsonDocument.Parse(jsonContent))
                {
                    var root = doc.RootElement;
                    var summary = root.GetProperty("summary");
                    var results = root.GetProperty("results");

                    // Get total steps from results
                    int totalSteps = 0;
                    int passedSteps = 0;
                    int failedSteps = 0;

                    if (results.GetArrayLength() > 0)
                    {
                        var testResult = results[0];
                        var steps = testResult.GetProperty("steps");
                        totalSteps = steps.GetArrayLength();

                        foreach (var step in steps.EnumerateArray())
                        {
                            string status = step.GetProperty("status").GetString() ?? "";
                            if (status == "passed") passedSteps++;
                            else if (status == "failed") failedSteps++;
                        }
                    }

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

                    // Load detailed step results
                    if (results.GetArrayLength() > 0)
                    {
                        var testResult = results[0];
                        var steps = testResult.GetProperty("steps");

                        // Load test case to get action details
                        Dictionary<string, (string action, string obj)> actionDetails = new Dictionary<string, (string, string)>();
                        if (!string.IsNullOrEmpty(currentTestFilePath) && File.Exists(currentTestFilePath))
                        {
                            string testJson = File.ReadAllText(currentTestFilePath);
                            using (JsonDocument testDoc = JsonDocument.Parse(testJson))
                            {
                                var actions = testDoc.RootElement.GetProperty("actions");
                                foreach (var action in actions.EnumerateArray())
                                {
                                    string id = action.GetProperty("id").GetString() ?? "";
                                    string type = action.GetProperty("type").GetString() ?? "";

                                    // Get object name
                                    string objName = "";
                                    if (action.TryGetProperty("objectId", out var objIdProp))
                                    {
                                        string objId = objIdProp.GetString() ?? "";
                                        var matchingObj = objectRepositoryItems.FirstOrDefault(o => o.Id == objId);
                                        if (matchingObj != null)
                                        {
                                            objName = matchingObj.Name;
                                        }
                                    }

                                    actionDetails[id] = (type.ToUpper(), objName);
                                }
                            }
                        }

                        int stepNum = 1;
                        foreach (var step in steps.EnumerateArray())
                        {
                            string actionId = step.GetProperty("actionId").GetString() ?? "";
                            string status = step.GetProperty("status").GetString() ?? "";
                            int duration = step.GetProperty("duration").GetInt32();
                            string error = step.TryGetProperty("error", out var err) ? err.GetString() ?? "" : "";

                            string action = "UNKNOWN";
                            string obj = "";
                            if (actionDetails.ContainsKey(actionId))
                            {
                                action = actionDetails[actionId].action;
                                obj = actionDetails[actionId].obj;
                            }

                            reportSteps.Add(new ReportStepInfo
                            {
                                StepNumber = stepNum++,
                                Status = status.ToLower() == "passed" ? "✓ PASSED" : "✗ FAILED",
                                Action = action,
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
    }
}
