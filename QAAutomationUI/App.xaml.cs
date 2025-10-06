using System;
using System.Windows;

namespace QAAutomationUI
{
    public partial class App : Application
    {
        private void Application_Startup(object sender, StartupEventArgs e)
        {
            try
            {
                // Set shutdown mode to explicit - don't shut down when startup window closes
                this.ShutdownMode = ShutdownMode.OnExplicitShutdown;

                // Show startup window first
                var startupWindow = new StartupWindow();
                bool? result = startupWindow.ShowDialog();

                if (result == true)
                {
                    // Create and show main window
                    var mainWindow = new MainWindow(startupWindow.SelectedSuitePath);

                    // Change shutdown mode to close when main window closes
                    this.ShutdownMode = ShutdownMode.OnMainWindowClose;
                    this.MainWindow = mainWindow;

                    mainWindow.Show();
                }
                else
                {
                    // User cancelled - exit
                    Shutdown();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Application startup error:\n\n{ex.Message}\n\nStack Trace:\n{ex.StackTrace}",
                    "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                Shutdown();
            }
        }

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            // Global exception handler
            AppDomain.CurrentDomain.UnhandledException += (s, args) =>
            {
                Exception ex = (Exception)args.ExceptionObject;
                MessageBox.Show($"Unhandled exception:\n\n{ex.Message}\n\nStack Trace:\n{ex.StackTrace}",
                    "Critical Error", MessageBoxButton.OK, MessageBoxImage.Error);
            };

            DispatcherUnhandledException += (s, args) =>
            {
                MessageBox.Show($"UI Exception:\n\n{args.Exception.Message}\n\nStack Trace:\n{args.Exception.StackTrace}",
                    "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                args.Handled = true;
            };
        }
    }
}

