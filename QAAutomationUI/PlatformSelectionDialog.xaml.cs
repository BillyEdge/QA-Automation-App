using System.Windows;

namespace QAAutomationUI
{
    public partial class PlatformSelectionDialog : Window
    {
        public string SelectedPlatform { get; private set; } = "web";

        public PlatformSelectionDialog()
        {
            InitializeComponent();
        }

        private void BtnContinue_Click(object sender, RoutedEventArgs e)
        {
            if (rbWeb.IsChecked == true)
                SelectedPlatform = "web";
            else if (rbDesktop.IsChecked == true)
                SelectedPlatform = "desktop";
            else if (rbMobile.IsChecked == true)
                SelectedPlatform = "mobile";
            else if (rbCrossPlatform.IsChecked == true)
                SelectedPlatform = "crossplatform";

            DialogResult = true;
            Close();
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }
    }
}
