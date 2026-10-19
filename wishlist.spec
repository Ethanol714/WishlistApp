# PyInstaller build for the Wishlist desktop app.
#   macOS:   pyinstaller wishlist.spec   ->  dist/Wishlist.app
#   Windows: pyinstaller wishlist.spec   ->  dist/Wishlist.exe
import sys

VERSION = '1.2.0'

a = Analysis(
    ['desktop.py'],
    datas=[('public', 'public'), ('extension', 'extension')],
    hiddenimports=['wishlist.asia', 'wishlist.vendors'],
    excludes=['tkinter'],
)
pyz = PYZ(a.pure)

if sys.platform == 'darwin':
    exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='Wishlist',
              console=False, icon='assets/icon.icns')
    coll = COLLECT(exe, a.binaries, a.datas, name='Wishlist')
    app = BUNDLE(
        coll,
        name='Wishlist.app',
        icon='assets/icon.icns',
        bundle_identifier='com.ethanol714.wishlist',
        version=VERSION,
        info_plist={
            'CFBundleShortVersionString': VERSION,
            'NSHighResolutionCapable': True,
            # The window loads the app's own server on http://127.0.0.1.
            'NSAppTransportSecurity': {'NSAllowsLocalNetworking': True},
        },
    )
else:
    exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name='Wishlist',
              console=False, icon='assets/icon.ico', upx=False)
