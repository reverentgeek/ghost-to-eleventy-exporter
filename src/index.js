"use strict";

const axios = require( "axios" );
const fs = require( "fs-extra" );
const path = require( "path" );
const ghostContentAPI = require( "@tryghost/content-api" );
const md = require( "./markdown" );
const forceMarkdownSlugList = [
	"create-branded-screenshots-with-snagit",
	"how-to-be-a-superhuman-communicator",
	"my-most-embarrassing-mistakes-as-a-programmer",
	"presentations",
	"respect-for-people"
];
const downloadImages = true;

require( "dotenv" ).config();

// Init Ghost API
const api = new ghostContentAPI( {
	url: process.env.GHOST_API_URL,
	key: process.env.GHOST_CONTENT_API_KEY,
	version: "v2"
} );

// Strip Ghost domain from urls
const stripDomain = url => {
	return url.replace( process.env.GHOST_API_URL, "" );
};

const zeroPad = ( number ) => {
	const l = number.toString().length;
	if ( l < 2 ) {
		return "0" + number.toString();
	}
	return number + "";
};

const formatDate = dt => {
	return `${ dt.getFullYear() }-${ zeroPad( dt.getMonth() + 1 ) }-${ zeroPad( dt.getDate() ) }`;
};

// Initialize/Clean content folders
const initializeFolders = async ( workingDir ) => {
	await fs.emptyDir( workingDir );
	await fs.ensureDir( workingDir );
	await fs.ensureDir( path.resolve( workingDir, "content", "images" ) );
};

// Get all "static" pages
const getPages = async () => {
	const pages = await api.pages.browse( { include: "authors", limit: "all" } );
	for( const page of pages ){
		page.url = stripDomain( page.url );
		page.primary_author.url = stripDomain( page.primary_author.url );

		// Convert publish date
		page.published_at = formatDate( new Date( page.published_at ) );
		// page.published_at = new Date( page.published_at );
		page.tags = "page";
	}
	return pages;
};

// Get all blog posts
const getPosts = async () => {
	const posts = await api.posts.browse( { include: "tags,authors", limit: "all" } );
	for( const post of posts ){
		post.url = stripDomain( post.url );
		post.primary_author.url = stripDomain( post.primary_author.url );
		post.tags.map( tag => ( tag.url = stripDomain( tag.url ) ) );

		// Convert publish date
		post.published_at = formatDate( new Date( post.published_at ) );
		// post.published_at = new Date( post.published_at );
		post.tags = "posts";
	}
	return posts;
};

const downloadExternalImage = async ( image, slug ) => {
	if ( !downloadImages ) return;
	try {
		const fileName = path.basename( image );
		const filePath = path.resolve( __dirname, "..", "site", "content", "images", slug, fileName );
		console.log( filePath );
		await fs.ensureDir( path.dirname( filePath ) );
		const res = await axios( { url: image, responseType: "stream" } );
		res.data.pipe( fs.createWriteStream( filePath ) );
		return `/content/images/${ slug }/${ fileName }`;
	} catch ( err ) {
		console.log( "Error downloading image" );
		if ( err.config && err.config.url ) {
			console.log( err.config.url );
		}
	}
};

const downloadSiteImage = async ( image ) => {
	if ( !downloadImages ) return;
	try {
		const imgFile = path.resolve( __dirname, "..", "site", "content", "images", image.replace( process.env.GHOST_API_URL, "" ).replace( "/content/images/", "" ) );
		await fs.ensureDir( path.dirname( imgFile ) );
		const res = await axios( { url: image, responseType: "stream" } );
		res.data.pipe( fs.createWriteStream( imgFile ) );
	} catch ( err ) {
		console.log( "Error downloading image" );
		if ( err.config && err.config.url ) {
			console.log( err.config.url );
		}
	}
};

// Export content
// Note: description could be content.excerpt, but choosing not to use it
const exportContent = async ( folder, content, layout ) => {
	const imgRegEx = /(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|png|svg))/gi;
	const useMarkdown = md.containsGhostHtmlMarkdownBlock( content.html ) || forceMarkdownSlugList.includes( content.slug );
	const ext = useMarkdown ? "md" : "html";
	const filename =  path.resolve( folder, `${ content.slug }.${ ext }` );

	console.log( `exporting ${ filename }` );

	const images = Array.from( content.html.matchAll( imgRegEx ) ).map( m => m[0] );
	if ( images.length > 0 ) {
		for( const image of images ) {
			if ( image.startsWith( process.env.GHOST_API_URL ) ) {
				await downloadSiteImage( image );
				content.html = content.html.replace( image, stripDomain( image ) );
			} else {
				const localUrl = await downloadExternalImage( image, content.slug );
				content.html = content.html.replace( image, localUrl );
			}
		}
	}

	if ( content.feature_image && content.feature_image.startsWith( process.env.GHOST_API_URL ) ) {
		await downloadSiteImage( content.feature_image );
		content.feature_image = stripDomain( content.feature_image );
	}

	// must happen *after* image replacement
	if ( md.containsGhostHtmlMarkdownBlock( content.html ) ) {
		content.html = md.convertGhostHtmlMarkdownBlockToMarkdown( content.html );
	} else if ( forceMarkdownSlugList.includes( content.slug ) ) {
		content.html = md.convertHtmlToMarkdown( content.html );
	}

	const data = `---
title: "${ content.title }"
featured_image: ${ content.feature_image ? content.feature_image : "" }
description: ""
date: ${ content.published_at }
tags: ${ content.tags }
slug: ${ content.slug }
layout: layouts/${ layout }.njk
---

${ content.html }
`;
	fs.writeFile( filename, data, { encoding: "utf-8" } );
};

( async () => {
	try {
		const workingDir = path.resolve( __dirname, "..", "site" );

		console.log( "initializing content folder..." );
		await initializeFolders( workingDir );

		console.log( "getting site data..." );
		const siteData = await api.settings.browse( { include: "icon,url" } );
		if ( process.env.SITE_URL ) siteData.url = process.env.SITE_URL;
		fs.writeJson( path.resolve( workingDir, "site.json" ), siteData, { spaces: 2 } );
		await downloadSiteImage( siteData.logo );
		await downloadSiteImage( siteData.icon );
		await downloadSiteImage( siteData.cover_image );

		console.log( "getting pages..." );
		const pages = await getPages();

		console.log( "exporting pages..." );
		for( const page of pages ){
			await exportContent( workingDir, page, "page" );
		}

		console.log( "getting posts..." );
		const posts = await getPosts();

		console.log( "exporting posts..." );
		for( const post of posts ){
			await exportContent( workingDir, post, "post" );
		}
		// const post = posts[0];
		// console.log( post );

	} catch ( err ) {
		console.log( err );
	}
} )();
