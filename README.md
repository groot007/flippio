<div align="center">
  <h1>Flippio</h1>
  <p>A modern database viewer for mobile applications</p>
https://github.com/user-attachments/assets/1ab289ee-394d-404d-ab56-6da91b392a95

</div>

## Overview

Flippio is an Electron-based application designed to help developers inspect and modify database files on iOS and Android devices. It provides a streamlined interface for connecting to devices, browsing applications, and exploring their databases.

## Features

- 📱 Connect to iOS simulators and Android devices
- 📦 Browse installed applications on connected devices
- 🗄️ Explore database files (.db, .sqlite, .sqlite3)
- 📋 View and edit database table contents
- 🔄 Push changes back to device
- 🌓 Light and dark theme support

## Installation

### Download

Download the latest version from the [Releases](https://github.com/groot007/flippio/releases) page.

### Building from Source

```bash
# Clone the repository
git clone https://github.com/groot007/flippio.git
cd flippio

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for your platform
npm run build:mac    # For macOS
npm run build:win    # For Windows
npm run build:linux  # For Linux
```

## Requirements

### For iOS Development
- macOS with Xcode installed
- iOS Simulator running
- `xcrun` command line tools

### For Android Development
- Android SDK installed
- `adb` in your PATH
- Android device with USB debugging enabled or emulator running

## Usage

1. **Connect Device**: Start Flippio and select your connected device
2. **Select Application**: Choose an app from the installed applications list
3. **Explore Databases**: Browse available database files for the selected app
4. **Inspect & Edit**: View table structure and edit data as needed
5. **Save Changes**: Push changes back to the device when finished

## Troubleshooting

### Android Device Not Detected
- Ensure USB debugging is enabled on your device
- Check if your device is authorized (accept the USB debugging prompt)
- Verify that `adb devices` shows your device in a terminal

### iOS Simulator Not Detected
- Make sure a simulator is running
- Verify that `xcrun simctl list devices | grep Booted` shows devices in a terminal

### Database Changes Not Saving
- For Android, ensure the app has debugging enabled
- Some system apps or apps with special protections may not allow database modifications

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Electron](https://www.electronjs.org/)
- [React](https://reactjs.org/)
- [Chakra UI](https://chakra-ui.com/)
- [AG Grid](https://www.ag-grid.com/)
