( () => {

	// DOM elements
	const chooserElement = document.querySelector( '#crosshair-chooser' )

	// Crosshair Images -> <select> input
	const loadCrosshairs = crosshairsObject => {

		const { crosshairs, current } = crosshairsObject

		// Create "No crosshair" option

		for ( const element of crosshairs ) {

			if ( typeof element === 'string' ) {

				const img = createImage( element, current )
				chooserElement.append( img )

			} else if ( typeof element === 'object' ) {

				createGroup( element, current )

			}

		}

	}

	// Title Case and spacing
	function prettyFilename( string ) {

		// Remove path and extension
		string = window.crossover.path.parse( string ).name

		string = string
			.split( '-' )
			.map( w => w[0].toUpperCase() + w.slice( 1 ).toLowerCase() )
			.join( ' ' )

		return string

	}

	// Create option elements
	const createImage = ( file, current ) => {

		const name = prettyFilename( file )
		const div = document.createElement( 'DIV' )
		const p = document.createElement( 'P' )
		const img = document.createElement( 'IMG' )

		div.classList.add( 'crosshair-option' )
		p.textContent = name

		img.alt = name
		img.draggable = false
		img.src = window.crossover.path.join( 'static/crosshairs/', file )

		if ( current === file ) {

			img.classList = 'current'

		}

		img.addEventListener( 'click', event => {

			setCrosshair( file )

			// Set 'selected' border color
			const current = document.querySelector( '.current' )
			if ( current ) {

				current.classList.remove( 'current' )

			}

			event.target.classList.add( 'current' )

		} )

		div.append( img, p )

		return div

	}

	// Setup optgroup elements
	const createGroup = ( files, current ) => {

		const group = document.createElement( 'DIV' )
		const title = document.createElement( 'P' )

		// Split path into name and remove slashes
		let label = window.crossover.path.dirname( files[0] )
		label = window.crossover.path.parse( label ).name

		for ( const element of files ) {

			if ( typeof element === 'string' ) {

				const img = createImage( element, current )
				group.append( img )

			}

		}

		title.classList.add( 'group-label' )
		title.textContent = label

		chooserElement.append( title )
		chooserElement.append( group )

	}

	const setCrosshair = crosshair => {

		window.crossover.send( 'save_crosshair', crosshair )

	}

	window.crossover.receive( 'load_crosshairs', data => {

		console.log( `Loaded crosshairsObject: ${JSON.stringify( data )}` )
		loadCrosshairs( data )

	} )

} )()
