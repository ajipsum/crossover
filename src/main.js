'use strict'
const fs = require( 'fs' )

const path = require( 'path' )
const { app, ipcMain, globalShortcut, BrowserWindow, Menu } = require( 'electron' )
const { autoUpdater } = require( 'electron-updater' )
const { is, showAboutWindow } = require( 'electron-util' )
const unhandled = require( 'electron-unhandled' )
const debug = require( 'electron-debug' )
const { debounce } = require( './util' )
const { config, defaults } = require( './config' )
const menu = require( './menu' )
// Const contextMenu = require('electron-context-menu')
// contextMenu()

unhandled()
debug( {
	showDevTools: false,
	devToolsMode: 'undocked'
} )

try {

	require( 'electron-reloader' )( module )

} catch ( _ ) {}

// Note: Must match `build.appId` in package.json
app.setAppUserModelId( 'com.lacymorrow.crossover' )

// Uncomment this before publishing your first version.
// It's commented out as it throws an error if there are no published versions.
try {

	if ( !is.development && !is.linux ) {

		const FOUR_HOURS = 1000 * 60 * 60 * 4
		setInterval( () => {

			autoUpdater.checkForUpdates()

		}, FOUR_HOURS )

		autoUpdater.checkForUpdates()

	}

} catch ( _ ) {}

// Prevent window from being garbage collected
let mainWindow
let chooserWindow
let windowHidden = false // Maintain hidden state

// __static path
const __static =
	process.env.NODE_ENV === 'development' ?
		'static' :
		path.join( __dirname, '/static' ).replace( /\\/g, '\\\\' )

// Crosshair images
const crosshairsPath = path.join( __static, 'crosshairs' )

const createMainWindow = async () => {

	const win = new BrowserWindow( {
		title: app.name,
		type: 'toolbar',
		titleBarStyle: 'customButtonsOnHover',
		backgroundColor: '#00FFFFFF',
		alwaysOnTop: true,
		frame: false,
		hasShadow: false,
		closable: true,
		fullscreenable: false,
		maximizable: false,
		minimizable: false,
		resizable: false,
		skipTaskbar: false,
		transparent: true,
		show: false,
		width: 200,
		height: 350,
		webPreferences: {
			nodeIntegration: true // We don't absolutely need this, but renderer require's some things

			// preload: path.join( __dirname, 'preload.js' )

			// Sandbox: true,

		}
	} )

	setDockVisible( false )
	win.setVisibleOnAllWorkspaces( true, { visibleOnFullScreen: true } )
	setDockVisible( true )

	win.on( 'ready-to-show', () => {

		win.show()

	} )

	win.on( 'closed', () => {

		// Dereference the window
		// For multiple windows store them in an array
		mainWindow = undefined

	} )

	await win.loadFile( path.join( __dirname, 'index.html' ) )

	return win

}

const createChildWindow = async _ => {

	const win = new BrowserWindow( {
		parent: mainWindow,
		modal: true,
		show: false,
		type: 'toolbar',
		frame: false,
		hasShadow: false,
		fullscreenable: false,
		maximizable: false,
		minimizable: false,
		transparent: true,
		nodeIntegration: false, // Is default value after Electron v5
		webPreferences: {
			preload: path.join( __dirname, 'preload-settings.js' )
		}
	} )

	await win.loadFile( path.join( __dirname, 'settings.html' ) )

	return win

}

// Save position to settings
const saveBounds = debounce( () => {

	const bounds = mainWindow.getBounds()
	config.set( 'positionX', bounds.x )
	config.set( 'positionY', bounds.y )

}, 1000 )

const getCrosshairImages = async () => {

	// How many levels deep to recurse
	const crosshairsObject = await getImages( crosshairsPath, 2 )
	config.set( 'crosshairsObject', crosshairsObject )

	return crosshairsObject

}

const getImages = ( directory, level ) => {

	return new Promise( ( resolve, reject ) => {

		const crosshairs = []
		fs.readdir( directory, async ( err, dir ) => {

			if ( err ) {

				reject( new Error( `Promise Errored: ${err}`, directory ) )

			}

			for ( let i = 0, filepath; ( filepath = dir[i] ); i++ ) {

				const stat = fs.lstatSync( path.join( directory, filepath ) )

				if ( stat.isDirectory() && level > 0 ) {

					const next = await getImages( path.join( directory, filepath ), level - 1 ) // eslint-disable-line no-await-in-loop
					crosshairs.push( next )

				} else if ( stat.isFile() && !/^\..*|.*\.docx$/.test( filepath ) ) {

					const dirpath = directory.replace( crosshairsPath, '' )

					// Filename
					crosshairs.push( path.join( dirpath, filepath ) )

				}

			}

			resolve( crosshairs )

		} )

	} )

}

const setColor = color => {

	mainWindow.webContents.send( 'load_color', color )

}

const setOpacity = opacity => {

	mainWindow.webContents.send( 'set_opacity', opacity )

}

const setPosition = ( posX, posY ) => {

	console.log( 'Set XY:', posX, posY )

	config.set( 'positionX', posX )
	config.set( 'positionY', posY )
	mainWindow.setBounds( { x: posX, y: posY } )

}

const setSight = sight => {

	mainWindow.webContents.send( 'set_sight', sight )

}

const setSize = size => {

	mainWindow.webContents.send( 'set_size', size )

}

// Hides the app from the dock and CMD+Tab, necessary for staying on top macOS fullscreen windows
const setDockVisible = visible => {

	if ( is.macos ) {

		if ( visible ) {

			app.dock.show()

		} else {

			app.dock.hide()

		}

	}

}

const centerWindow = () => {

	mainWindow.hide()
	mainWindow.center()
	const bounds = mainWindow.getBounds()

	// Recenter bounds because electron isn't perfect
	if ( is.macos ) {

		mainWindow.setBounds( { x: bounds.x, y: bounds.y + 200 } )

	} else {

		mainWindow.setBounds( { x: bounds.x, y: bounds.y + 130 } )

	}

	mainWindow.show()
	saveBounds()

}

const hideWindow = () => {

	if ( windowHidden ) {

		mainWindow.show()

	} else {

		mainWindow.hide()

	}

	windowHidden = !windowHidden

}

const toggleWindowLock = () => {

	const locked = config.get( 'windowLocked' )
	lockWindow( !locked )

}

// Allows dragging and setting options
const lockWindow = lock => {

	console.log( `Locked: ${lock}` )

	mainWindow.closable = !lock
	mainWindow.setIgnoreMouseEvents( lock )
	mainWindow.webContents.send( 'lock_window', lock )
	if ( !lock ) {

		mainWindow.show()

	}

	config.set( 'windowLocked', lock )

}

const moveWindow = direction => {

	const locked = config.get( 'windowLocked' )
	if ( !locked ) {

		let newBound
		const mainWindow = BrowserWindow.getAllWindows()[0]
		const bounds = mainWindow.getBounds()
		switch ( direction ) {

			case 'up':
				newBound = bounds.y - 1
				mainWindow.setBounds( { y: newBound } )
				config.set( 'positionY', newBound )
				break
			case 'down':
				newBound = bounds.y + 1
				mainWindow.setBounds( { y: newBound } )
				config.set( 'positionY', newBound )

				break
			case 'left':
				newBound = bounds.x - 1
				mainWindow.setBounds( { x: newBound } )
				config.set( 'positionX', newBound )
				break
			case 'right':
				newBound = bounds.x + 1
				mainWindow.setBounds( { x: newBound } )
				config.set( 'positionX', newBound )
				break
			default:
				break

		}

	}

}

const aboutWindow = () => {

	showAboutWindow( {
		icon: path.join( __static, 'Icon.png' ),
		copyright: `CrossOver ${app.getVersion()} | Copyright © Lacy Morrow`,
		text:
			'A crosshair overlay for any screen. Feedback and bug reports welcome. Created by Lacy Morrow. Crosshairs thanks to /u/IrisFlame.'
	} )

}

const resetSettings = () => {

	const keys = Object.keys( defaults )
	for ( const element of keys ) {

		config.set( element, defaults[element] )

	}

	centerWindow()
	setupApp()

}

const setupApp = async () => {

	// Set to previously selected crosshair
	const currentCrosshair = config.get( 'crosshair' )
	if ( currentCrosshair ) {

		mainWindow.webContents.send( 'set_crosshair', currentCrosshair )

	}

	// Setup crosshair chooser, must come before the check below
	chooserWindow.webContents.send( 'load_crosshairs', {
		crosshairs: await getCrosshairImages(),
		current: currentCrosshair
	} )

	setColor( config.get( 'color' ) )
	setOpacity( config.get( 'opacity' ) )
	setSight( config.get( 'sight' ) )
	setSize( config.get( 'size' ) )

	// Center app by default - set position if config exists
	if ( config.get( 'positionX' ) > -1 ) {

		setPosition( config.get( 'positionX' ), config.get( 'positionY' ) )

	}

	// Set lock state
	lockWindow( config.get( 'windowLocked' ) )

}

// Prevent multiple instances of the app
if ( !app.requestSingleInstanceLock() ) {

	app.quit()

}

// Opening 2nd instance focuses app
app.on( 'second-instance', () => {

	if ( mainWindow ) {

		if ( mainWindow.isMinimized() ) {

			mainWindow.restore()

		}

		mainWindow.show()

	}

} )

app.on( 'window-all-closed', () => {

	app.quit()

} )

app.on( 'activate', async () => {

	if ( !mainWindow ) {

		mainWindow = await createMainWindow()

	}

} )

app.on( 'ready', () => {

	/* IP Communication */
	ipcMain.on( 'open_chooser', ( ..._ ) => {

		if ( chooserWindow && !config.get( 'windowLocked' ) ) {

			chooserWindow.show()
			globalShortcut.register( 'Escape', () => {

				chooserWindow.hide()
				globalShortcut.unregister( 'Escape' )

			} )

		}

	} )

	ipcMain.on( 'save_color', ( event, arg ) => {

		console.log( `Set color: ${arg}` )
		config.set( 'color', arg )

	} )

	ipcMain.on( 'save_crosshair', ( event, arg ) => {

		if ( arg ) {

			console.log( `Set crosshair: ${arg}` )
			mainWindow.webContents.send( 'set_crosshair', arg ) // Pass to renderer
			config.set( 'crosshair', arg )
			if ( chooserWindow ) {

				chooserWindow.hide()

			}

		} else {

			console.log( 'Not setting null crosshair.' )

		}

	} )

	ipcMain.on( 'save_opacity', ( event, arg ) => {

		console.log( `Set opacity: ${arg}` )
		config.set( 'opacity', arg )

	} )

	ipcMain.on( 'save_sight', ( event, arg ) => {

		console.log( `Set sight: ${arg}` )
		config.set( 'sight', arg )

	} )

	ipcMain.on( 'save_size', ( event, arg ) => {

		console.log( `Set size: ${arg}` )
		config.set( 'size', arg )

	} )

	ipcMain.on( 'center_window', () => {

		console.log( 'Center window' )
		centerWindow()

	} )

	ipcMain.on( 'quit', () => {

		app.quit()

	} )

	/* Global KeyListners */

	// Toggle CrossOver
	globalShortcut.register( 'Control+Shift+Alt+X', () => {

		toggleWindowLock()

	} )

	// Hide CrossOver
	globalShortcut.register( 'Control+Shift+Alt+E', () => {

		hideWindow()

	} )

	// Reset CrossOver
	globalShortcut.register( 'Control+Shift+Alt+R', () => {

		resetSettings()

	} )

	// About CrossOver
	globalShortcut.register( 'Control+Shift+Alt+A', () => {

		aboutWindow()

	} )

	// Single pixel movement
	globalShortcut.register( 'Control+Shift+Alt+Up', () => {

		moveWindow( 'up' )

	} )

	globalShortcut.register( 'Control+Shift+Alt+Down', () => {

		moveWindow( 'down' )

	} )

	globalShortcut.register( 'Control+Shift+Alt+Left', () => {

		moveWindow( 'left' )

	} )

	globalShortcut.register( 'Control+Shift+Alt+Right', () => {

		moveWindow( 'right' )

	} )

} )

module.exports = async () => {

	await app.whenReady()
	Menu.setApplicationMenu( menu )
	mainWindow = await createMainWindow()
	chooserWindow = await createChildWindow( mainWindow )
	mainWindow.setAlwaysOnTop( true, 'screen-saver' )

	chooserWindow.setAlwaysOnTop( true, 'screen-saver' )

	mainWindow.on( 'move', () => {

		saveBounds()

	} )

	mainWindow.crossover = {
		config,
		moveWindow,
		setColor
	}

	setupApp()

}
