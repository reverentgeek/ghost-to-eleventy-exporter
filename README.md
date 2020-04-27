# Ghost Exporter for Eleventy

A utility for downloading content and images from a site running [Ghost](https://ghost.org/). Currently designed for the Ghost API version 3. Feel free to download the source code and tweak it to fit your needs.

## Requirements

* [Node.js](https://nodejs.org) version 12.x or higher.

## Configuration

1. Clone or download this repository.
1. Install dependencies using `npm`
	```bash
	npm install
	```
1. Create a `.env` file or copy the `.env.sample` to `.env`.
	```bash
	GHOST_API_URL=https://reverentgeek.com
	GHOST_CONTENT_API_KEY=
	SITE_URL=https://reverentgeek.com
	```
1. Change the `GHOST_API_URL` and `SITE_URL` values to match your Ghost site and your destination site.
1. Login to your Ghost admin panel.
1. Under *Settings*, click **Integrations**.
1. Click **Add custom integration**. 
1. Enter name, such as *Eleventy Export* and click **Create**.
1. Copy the *Content API Key* and update the `GHOST_CONTENT_API_KEY` value in the `.env` file.

## Usage

Run the utility from the command line using Node.js

```bash
node .
```

You should now have a folder named `site` with all the content and images downloaded.
