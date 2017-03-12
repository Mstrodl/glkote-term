/*

glkote-dumb: Dumb terminal implementation of GlkOte
===================================================

Copyright (c) 2016 Dannii Willis
MIT licenced
https://github.com/curiousdannii/glkote-term

*/

'use strict'

const os = require( 'os' )

const Dialog = require( './electrofs.js' )
const GlkOte = require( './glkote-term.js' )

const key_replacements = {
	'\x7F': 'delete',
	'\t': 'tab',
}

class DumbGlkOte extends GlkOte
{
	init( iface )
	{
		if ( !iface )
		{
			this.error( 'No game interface object has been provided.' )
		}
		if ( !iface.accept )
		{
			this.error( 'The game interface object must have an accept() function.' )
		}

		// Wrap glk_window_open so that only one window can be opened
		const old_glk_window_open = iface.Glk.glk_window_open
		iface.Glk.glk_window_open = function( splitwin, method, size, wintype, rock )
		{
			if ( splitwin )
			{
				return null
			}
			return old_glk_window_open( splitwin, method, size, wintype, rock )
		}
		
		this.window = null
		this.current_input_type = null
		this.log_cache = ""
		this.discord_send = iface.discord_send

		// Note that this must be called last as it will result in VM.init() being called
		super.init( iface )
	}

	accept_specialinput( data )
	{
		if ( data.type === 'fileref_prompt' )
		{
			const replyfunc = ( ref ) => this.send_response( 'specialresponse', null, 'fileref_prompt', ref )
			try
			{
				( new DumbDialog() ).open( data.filemode !== 'read', data.filetype, data.gameid, replyfunc )
			}
			catch (ex)
			{
				this.log( 'Unable to open file dialog: ' + ex )
				/* Return a failure. But we don't want to call send_response before
				glkote_update has finished, so we defer the reply slightly. */
				setImmediate( () => replyfunc( null ) )
			}
		}
		else
		{
			this.error( 'Request for unknown special input type: ' + data.type )
		}
	}

	cancel_inputs( data )
	{
		if ( data.length === 0 )
		{
			this.current_input_type = null
			this.detach_handlers()
		}
	}

	disable( disable )
	{
		this.disabled = disable
		if ( disable )
		{
			this.detach_handlers()
		}
		else
		{
			this.attach_handlers()
		}
	}

	exit()
	{
		this.detach_handlers()
		super.exit()
	}
	
	handle_line_input( line )
	{
		if ( this.current_input_type === 'line' )
		{
			this.current_input_type = null
			this.send_response( 'line', this.window, line )
		}
	}

	update_content( data )
	{
		data[0][ this.window.type === 'buffer' ? 'text' : 'lines' ].forEach( line =>
		{
			if ( !line.append )
			{
				this.log_cache += "\n";
			}
			const content = line.content
			if ( content )
			{
				for ( let i = 0; i < content.length; i++ )
				{
					if ( typeof content[i] === 'string' )
					{
						i++
						this.log_cache += content[i]
					}
					else
					{
						this.log_cache += content[i].text
					}
				}
			}
		})
	}

	update_inputs( data )
	{
		if ( data.length )
		{
			this.discord_send(this.log_cache)
			this.log_cache = ""
			if ( data[0].type === 'char' )
			{
				this.current_input_type = 'char'
			}

			if ( data[0].type === 'line' )
			{
				this.current_input_type = 'line'
			}
		}
	}

	update_windows( data )
	{
		this.window = data[0]
	}
}

class DumbDialog extends Dialog.Dialog
{
	get_user_path()
	{
		return os.homedir()
	}

	log()
	{}

	open( tosave, usage, gameid, callback )
	{
		stdout.write( '\n' )
		rl.question( 'Please enter a file name (without an extension): ', ( path ) =>
		{
			if ( !path )
			{
				callback( null )
			}
			else
			{
				callback({
					filename: path + '.' +  this.filters_for_usage( usage )[0].extensions[0],
					usage: usage,
				})
			}
		})
	}
}

module.exports = DumbGlkOte
module.exports.Dialog = DumbDialog
