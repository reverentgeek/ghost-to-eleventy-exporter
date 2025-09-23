"use strict";

const axios = require( "axios" );
const fs = require( "fs-extra" );
const path = require( "path" );
const ghostContentAPI = require( "@tryghost/content-api" );
const md = require( "./markdown" );
const excerptHtml = require( "excerpt-html" );
const marked = require( "marked" );
const utils = require( "./utils" );

module.exports = ( { debug, out, skipImages, skipPages, skipPosts, slugs, skipSlugs, ghostUrl, ghostApiKey, siteUrl } ) => {
	const workingDir = out ? path.resolve( out ) : path.resolve( __dirname, "..", "site" );

	// Init Ghost API
	const api = new ghostContentAPI( {
		url: ghostUrl,
		key: ghostApiKey,
		version: "v2"
	} );

	// Strip Ghost domain from urls
	const stripDomain = ( url ) => {
		return url.replace( ghostUrl, "" );
	};

	// Initialize/Clean content folders
	const initializeFolders = async () => {
		await fs.emptyDir( workingDir );
		await fs.ensureDir( workingDir );
		await fs.ensureDir( path.resolve( workingDir, "content", "images" ) );
	};

	// Get all "static" pages
	const getPages = async () => {
		const pages = await api.pages.browse( { include: "authors", limit: "all" } );
		for ( const page of pages ) {
			page.url = stripDomain( page.url );
			page.primary_author.url = stripDomain( page.primary_author.url );

			// Convert publish date
			page.published_at = utils.formatDate( new Date( page.published_at ) );
			// page.published_at = new Date( page.published_at );
			page.tags = "page";
		}
		return pages;
	};

	// Get all blog posts
	const getPosts = async () => {
		const posts = await api.posts.browse( { include: "tags,authors", limit: "all" } );
		for ( const post of posts ) {
			post.url = stripDomain( post.url );
			post.primary_author.url = stripDomain( post.primary_author.url );
			post.tags.map( tag => ( tag.url = stripDomain( tag.url ) ) );

			// Convert publish date
			post.published_at = utils.formatDate( new Date( post.published_at ) );
			// post.published_at = new Date( post.published_at );
			post.tags = "posts";
		}
		return posts;
	};

	const downloadExternalImage = async ( image, slug ) => {
		try {
			const fileName = path.basename( image );
			const filePath = path.resolve( workingDir, "content", "images", slug, fileName );
			if ( !skipImages ) {
				await fs.ensureDir( path.dirname( filePath ) );
				const res = await axios( { url: image, responseType: "stream" } );
				res.data.pipe( fs.createWriteStream( filePath ) );
			}
			return `/content/images/${ slug }/${ fileName }`;
		} catch ( err ) {
			console.log( "Error downloading image" );
			if ( err.config && err.config.url ) {
				console.log( err.config.url );
			}
		}
	};

	const downloadSiteImage = async ( image ) => {
		if ( skipImages ) return;
		try {
			const imgFile = path.resolve( workingDir, "content", "images", image.replace( ghostUrl, "" ).replace( "/content/images/", "" ) );
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
	const exportContent = async ( content, layout ) => {
		const imgRegEx = /(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|png|svg))/gi;
		const useMarkdown = md.containsGhostHtmlMarkdownBlock( content.html ) || slugs.includes( content.slug );
		const ext = useMarkdown ? "md" : "html";
		content.filename = `${ content.slug }.${ ext }`;
		const filename = path.resolve( workingDir, content.filename );

		console.log( `exporting ${ filename }` );

		if ( debug ) {
			await fs.writeJson( path.resolve( workingDir, `${ content.slug }.json` ), content, { spaces: 2 } );
		}

		const images = Array.from( content.html.matchAll( imgRegEx ) ).map( m => m[0] );
		if ( images.length > 0 ) {
			for ( const image of images ) {
				if ( image.startsWith( ghostUrl ) ) {
					await downloadSiteImage( image );
					content.html = content.html.replace( image, stripDomain( image ) );
				} else {
					const localUrl = await downloadExternalImage( image, content.slug );
					content.html = content.html.replace( image, localUrl );
				}
			}
		}

		if ( content.feature_image && content.feature_image.startsWith( ghostUrl ) ) {
			await downloadSiteImage( content.feature_image );
			content.feature_image = stripDomain( content.feature_image );
		}

		// converting to markdown must happen *after* image replacement
		if ( slugs.includes( content.slug ) ) {
			content.html = md.convertHtmlToMarkdown( content.html ).trim();
		}

		if ( md.containsGhostHtmlMarkdownBlock( content.html ) ) {
			content.html = md.convertGhostHtmlMarkdownBlockToMarkdown( content.html );
		}

		md.convertStartingImageToFeaturedImage( content );

		const excerpt = excerptHtml( useMarkdown ? marked( content.html ) : content.html ).replace( /"/g, "\\\"" );

		const data = `---
id: ${ content.id }
title: "${ content.title }"
feature_image: ${ content.feature_image ? content.feature_image : "" }
description: "${ excerpt }"
date: ${ content.published_at }
tags: ${ content.tags }
slug: ${ content.slug }
layout: layouts/${ layout }.njk
---

${ content.html }
`;
		await fs.writeFile( filename, data, { encoding: "utf-8" } );
	};

	const runExport = async ( ) => {
		try {
			console.log( "initializing content folder..." );
			await initializeFolders();

			console.log( "getting site data..." );
			const siteData = await api.settings.browse( { include: "icon,url" } );
			siteData.url = siteUrl;
			await fs.writeJson( path.resolve( workingDir, "site.json" ), siteData, { spaces: 2 } );
			if ( !skipImages ) {
				await downloadSiteImage( siteData.logo );
				await downloadSiteImage( siteData.icon );
				await downloadSiteImage( siteData.cover_image );
			}

			if ( !skipPages ) {
				console.log( "getting pages..." );
				const pages = await getPages();

				console.log( "exporting pages..." );
				for ( const page of pages ) {
					if ( !skipSlugs.includes( page.slug ) ) {
						await exportContent( page, "page" );
					}
				}
			}

			if ( !skipPosts ) {
				console.log( "getting posts..." );
				const posts = await getPosts();

				console.log( "exporting posts..." );
				for ( const post of posts ) {
					if ( !skipSlugs.includes( post.slug ) ) {
						await exportContent( post, "post" );
					}
				}
			}
		} catch ( err ) {
			console.log( err );
		}
	};

	return {
		export: runExport
	};
};
