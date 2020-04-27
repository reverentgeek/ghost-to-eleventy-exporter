"use strict";

const lint = require( "markdownlint" );
const lintHelper = require( "markdownlint-rule-helpers" );
const Turndown = require( "turndown" );
const gfmPlugin = require( "turndown-plugin-gfm" );
const turndown = new Turndown( {
	headingStyle: "atx",
	codeBlockStyle: "fenced"
} );
turndown.use( gfmPlugin.gfm );

const containsGhostHtmlMarkdownBlock = html => {
	return html.includes( "<!--kg-card-begin: markdown-->" );
};

const convertHtmlToMarkdown = html => {
	let md = turndown.turndown( html );
	const fixResult = lint.sync( {
		strings: { "md": md },
		config: {
			"no-trailing-punctuation": false
		},
		resultVersion: 3
	} );
	const fixes = fixResult["md"].filter( error => error.fixInfo );
	if ( fixes.length > 0 ) {
		md = lintHelper.applyFixes( md, fixes );
	}
	return md;
};

const convertGhostHtmlMarkdownBlockToMarkdown = html => {
	const mdRegEx = /<!--kg-card-begin: markdown-->(.+?(?=<!--kg-card-end: markdown-->))<!--kg-card-end: markdown-->/gsm;
	const mdBlocks = [ ...html.matchAll( mdRegEx ) ].map( b => b[0] );
	for( const block of mdBlocks ) {
		const md = convertHtmlToMarkdown( block );
		html = html.replace( block, "\n\n" + md + "\n\n" );
	}
	return html;
};

module.exports = {
	containsGhostHtmlMarkdownBlock,
	convertGhostHtmlMarkdownBlockToMarkdown,
	convertHtmlToMarkdown
};
