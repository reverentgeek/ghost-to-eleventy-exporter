"use strict";

const { program } = require( "commander" );
const exporter = require( "./exporter" );

require( "dotenv" ).config();

const slugs = ( value ) => {
	return value.split( "," );
};

const envSkipSlugs = ( value ) => {
	const slugs = process.env.FILTER_SLUGS;
	if ( !slugs ) return [];
	return slugs.split( "," );
};

const envSlugs = () => {
	const slugs = process.env.MD_SLUGS;
	if ( !slugs ) return [];
	return slugs.split( "," );
};

program
	.option( "--debug", "Write unprocessed original content to out folder" )
	.option( "--ghost-url <apiUrl>", "Ghost site url" )
	.option( "--ghost-api-key <apiKey>", "Ghost API key" )
	.option( "--site-url <siteUrl>", "Destination site url, if different than Ghost site url" )
	.option( "-o, --out <folder>", "directory to write exported content (defaults to 'site' in the current folder)" )
	.option( "--skip-images", "skip downloading images" )
	.option( "--skip-pages", "skip exporting pages" )
	.option( "--skip-posts", "skip exporting posts" )
	.option( "--slugs [slugs]", "comma-separated list of content slug to convert explicitly from html to markdown", slugs )
	.option( "--filter [slugs]", "comma-separated list of content slugs to skip conversion", slugs );

program.parse( process.argv );

const options = {
	debug: !!program.debug,
	ghostUrl: program.ghostUrl || process.env.GHOST_API_URL,
	ghostApiKey: program.ghostApiKey || process.env.GHOST_CONTENT_API_KEY,
	siteUrl: program.siteUrl || program.ghostUrl || process.env.SITE_URL || process.GHOST_API_URL,
	out: program.out,
	skipImages: !!program.skipImages,
	skipPosts: !!program.skipPosts,
	skipPages: !!program.skipPages,
	slugs: program.slugs || envSlugs(),
	skipSlugs: program.filter || envSkipSlugs()
};

if ( options.debug ) {
	console.log( options );
}
exporter( options ).export().then( ()=>{
	console.log( "finished" );
} );
