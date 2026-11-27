<?php
/**
 * Usagi Video Player block.
 *
 * A video block with custom controls (play, seek bar, timestamp, mute,
 * resolution switcher, fullscreen). Videos are hosted on catbox.moe:
 * the editor uploads the file to this site's REST endpoint, which
 * forwards it to the catbox.moe API and returns the files.catbox.moe link.
 *
 * Optional: to tie uploads to your catbox account, add this line to
 * wp-config.php (never commit it to the theme):
 *     define( 'USAGIBLOG_CATBOX_USERHASH', 'your-userhash' );
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'USAGIBLOG_VIDEO_VERSION', '1.0.0' );

function usagiblog_video_player_register() {
	$dir = get_template_directory_uri() . '/blocks/video-player';

	wp_register_script(
		'usagiblog-video-editor',
		$dir . '/editor.js',
		array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
		USAGIBLOG_VIDEO_VERSION,
		true
	);
	wp_localize_script(
		'usagiblog-video-editor',
		'usagiblogVideo',
		array(
			'uploadUrl' => esc_url_raw( rest_url( 'usagiblog/v1/catbox' ) ),
			'nonce'     => wp_create_nonce( 'wp_rest' ),
			'maxUpload' => (int) min( wp_max_upload_size(), 200 * MB_IN_BYTES ),
		)
	);
	wp_register_style( 'usagiblog-video-editor', $dir . '/editor.css', array(), USAGIBLOG_VIDEO_VERSION );

	wp_register_script( 'usagiblog-video-player', $dir . '/player.js', array(), USAGIBLOG_VIDEO_VERSION, true );
	wp_register_style( 'usagiblog-video-player', $dir . '/player.css', array(), USAGIBLOG_VIDEO_VERSION );

	register_block_type(
		'usagiblog/video-player',
		array(
			'api_version'     => 2,
			'editor_script'   => 'usagiblog-video-editor',
			'editor_style'    => 'usagiblog-video-editor',
			'style'           => 'usagiblog-video-player',
			'render_callback' => 'usagiblog_video_player_render',
			'attributes'      => array(
				'sources'      => array(
					'type'    => 'array',
					'default' => array(),
				),
				'defaultIndex' => array(
					'type'    => 'number',
					'default' => 0,
				),
				'poster'       => array(
					'type'    => 'string',
					'default' => '',
				),
			),
		)
	);
}
add_action( 'init', 'usagiblog_video_player_register' );

/**
 * Keep only sources with a http(s) URL; labels are plain text.
 */
function usagiblog_video_player_clean_sources( $sources ) {
	$clean = array();
	if ( ! is_array( $sources ) ) {
		return $clean;
	}
	foreach ( $sources as $source ) {
		if ( ! is_array( $source ) || empty( $source['url'] ) ) {
			continue;
		}
		$url = esc_url_raw( $source['url'], array( 'http', 'https' ) );
		if ( ! $url ) {
			continue;
		}
		$label   = isset( $source['label'] ) ? sanitize_text_field( $source['label'] ) : '';
		$clean[] = array(
			'url'   => $url,
			'label' => '' !== $label ? $label : 'Source ' . ( count( $clean ) + 1 ),
		);
	}
	return $clean;
}

function usagiblog_video_player_icon( $name ) {
	$paths = array(
		'play'       => '<path d="M8 5v14l11-7z"/>',
		'pause'      => '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
		'volume'     => '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23z"/>',
		'muted'      => '<path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12a9 9 0 0 0-7-8.77v2.06A7 7 0 0 1 19 12zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a9 9 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>',
		'fullscreen' => '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>',
		'exitfs'     => '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>',
		'gear'       => '<path d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.69 8.48a.5.5 0 0 0 .12.61l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.49.42h3.84c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>',
	);
	return '<svg class="usagi-video__icon usagi-video__icon--' . esc_attr( $name ) . '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' . $paths[ $name ] . '</svg>';
}

function usagiblog_video_player_render( $attributes ) {
	$sources = usagiblog_video_player_clean_sources( isset( $attributes['sources'] ) ? $attributes['sources'] : array() );
	if ( empty( $sources ) ) {
		return '';
	}

	$default = isset( $attributes['defaultIndex'] ) ? (int) $attributes['defaultIndex'] : 0;
	if ( $default < 0 || $default >= count( $sources ) ) {
		$default = 0;
	}
	$poster = ! empty( $attributes['poster'] ) ? esc_url( $attributes['poster'] ) : '';

	wp_enqueue_script( 'usagiblog-video-player' );
	wp_enqueue_style( 'usagiblog-video-player' );

	$i = 'usagiblog_video_player_icon';

	ob_start();
	?>
	<figure class="usagi-video" tabindex="0"
		data-sources="<?php echo esc_attr( wp_json_encode( $sources ) ); ?>"
		data-default="<?php echo esc_attr( $default ); ?>">
		<div class="usagi-video__frame">
			<video class="usagi-video__media" controls playsinline preload="metadata"
				src="<?php echo esc_url( $sources[ $default ]['url'] ); ?>"
				<?php echo $poster ? 'poster="' . $poster . '"' : ''; ?>></video>

			<button type="button" class="usagi-video__bigplay" aria-label="Play"><?php echo $i( 'play' ); ?></button>
			<div class="usagi-video__spinner" aria-hidden="true"></div>

			<div class="usagi-video__controls">
				<input type="range" class="usagi-video__seek" min="0" max="0" step="0.1" value="0" aria-label="Seek">
				<div class="usagi-video__bar">
					<button type="button" class="usagi-video__btn usagi-video__play" aria-label="Play">
						<?php echo $i( 'play' ) . $i( 'pause' ); ?>
					</button>
					<button type="button" class="usagi-video__btn usagi-video__mute" aria-label="Mute">
						<?php echo $i( 'volume' ) . $i( 'muted' ); ?>
					</button>
					<span class="usagi-video__time">
						<span class="usagi-video__current">0:00</span> / <span class="usagi-video__duration">0:00</span>
					</span>
					<span class="usagi-video__spacer"></span>
					<div class="usagi-video__quality">
						<button type="button" class="usagi-video__btn usagi-video__quality-btn" aria-label="Resolution" aria-haspopup="true" aria-expanded="false">
							<?php echo $i( 'gear' ); ?>
							<span class="usagi-video__quality-label"><?php echo esc_html( $sources[ $default ]['label'] ); ?></span>
						</button>
						<ul class="usagi-video__menu" role="menu" hidden></ul>
					</div>
					<button type="button" class="usagi-video__btn usagi-video__fs" aria-label="Fullscreen">
						<?php echo $i( 'fullscreen' ) . $i( 'exitfs' ); ?>
					</button>
				</div>
			</div>
		</div>
	</figure>
	<?php
	return ob_get_clean();
}

/**
 * Upload proxy: catbox.moe sends no CORS headers, so the editor can't
 * call its API from the browser. The editor posts the file here instead.
 */
function usagiblog_video_player_rest() {
	register_rest_route(
		'usagiblog/v1',
		'/catbox',
		array(
			'methods'             => 'POST',
			'callback'            => 'usagiblog_video_player_upload',
			'permission_callback' => function () {
				return current_user_can( 'upload_files' );
			},
		)
	);
}
add_action( 'rest_api_init', 'usagiblog_video_player_rest' );

function usagiblog_video_player_upload( WP_REST_Request $request ) {
	$files = $request->get_file_params();
	if ( empty( $files['file'] ) || ! is_array( $files['file'] ) ) {
		return new WP_Error( 'usagiblog_no_file', 'No file received. It may be larger than the server upload limit.', array( 'status' => 400 ) );
	}
	$file = $files['file'];

	if ( UPLOAD_ERR_OK !== (int) $file['error'] ) {
		$too_big = in_array( (int) $file['error'], array( UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE ), true );
		return new WP_Error(
			'usagiblog_upload_error',
			$too_big ? 'The file is larger than the server upload limit.' : 'The upload to this server failed (error ' . (int) $file['error'] . ').',
			array( 'status' => 400 )
		);
	}
	if ( ! is_uploaded_file( $file['tmp_name'] ) ) {
		return new WP_Error( 'usagiblog_bad_file', 'Invalid upload.', array( 'status' => 400 ) );
	}
	if ( $file['size'] > 200 * MB_IN_BYTES ) {
		return new WP_Error( 'usagiblog_too_big', 'catbox.moe accepts files up to 200 MB.', array( 'status' => 400 ) );
	}

	// Videos for the player, images for the poster.
	$check = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] );
	$type  = $check['type'] ? $check['type'] : '';
	if ( 0 !== strpos( $type, 'video/' ) && 0 !== strpos( $type, 'image/' ) ) {
		return new WP_Error( 'usagiblog_bad_type', 'Only video and image files can be uploaded.', array( 'status' => 400 ) );
	}
	if ( ! function_exists( 'curl_init' ) ) {
		return new WP_Error( 'usagiblog_no_curl', 'The PHP cURL extension is not available on this server.', array( 'status' => 500 ) );
	}

	$name   = sanitize_file_name( $file['name'] );
	$fields = array(
		'reqtype'      => 'fileupload',
		'fileToUpload' => new CURLFile( $file['tmp_name'], $type, $name ),
	);
	if ( defined( 'USAGIBLOG_CATBOX_USERHASH' ) && USAGIBLOG_CATBOX_USERHASH ) {
		$fields['userhash'] = USAGIBLOG_CATBOX_USERHASH;
	}

	if ( function_exists( 'set_time_limit' ) ) {
		@set_time_limit( 0 );
	}

	$ch = curl_init( 'https://catbox.moe/user/api.php' );
	curl_setopt_array(
		$ch,
		array(
			CURLOPT_POST           => true,
			CURLOPT_POSTFIELDS     => $fields,
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_CONNECTTIMEOUT => 30,
			CURLOPT_TIMEOUT        => 0,
			CURLOPT_USERAGENT      => 'WordPress video block',
		)
	);
	$body   = curl_exec( $ch );
	$status = (int) curl_getinfo( $ch, CURLINFO_HTTP_CODE );
	$error  = curl_error( $ch );
	curl_close( $ch );

	$body = is_string( $body ) ? trim( $body ) : '';
	if ( '' !== $error || 200 !== $status || ! preg_match( '#^https://files\.catbox\.moe/[A-Za-z0-9._-]+$#', $body ) ) {
		$detail = '' !== $error ? $error : ( '' !== $body ? wp_strip_all_tags( substr( $body, 0, 200 ) ) : 'HTTP ' . $status );
		return new WP_Error( 'usagiblog_catbox_failed', 'catbox.moe upload failed: ' . $detail, array( 'status' => 502 ) );
	}

	return array( 'url' => $body );
}
