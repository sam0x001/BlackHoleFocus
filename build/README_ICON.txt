Put icon.ico HERE (required for Windows .exe icon):

  build/icon.ico

Requirements:
- Real .ico format (not renamed .png)
- Include sizes: 16, 32, 48, 256
- Recommended tool: https://icoconvert.com/

Then:
  rmdir /s /q dist-electron
  npm run build

Output exe:
  dist-electron\win-unpacked\BlackHoleFocus.exe
