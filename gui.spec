block_cipher = None

a = Analysis(
    ['gui.py'],
    pathex = ['.'],
    hiddenimports = [
        'email.mime.message',
        'email.mime.image',
        'email.mime.text',
        'email.mime.multipart',
        'email.mime.audio',
        'yaml',
        'util',
    ],
    datas = [],
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name = 'gui',
    debug = False,
    strip = None,
    upx = False,
    console = True,
)
