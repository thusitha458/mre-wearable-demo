/**
 * In Heroku if you have a single web dyno, it will automatically turn off 
 * if your server did not get a request within an hour.
 * This prevents that.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fetch = require('node-fetch');

const enabled = true;
const FIFTEEN_MIN_IN_MS = 15 * 60 * 1000;
const HEROKU_URL = "https://hatsdemoforesala.herokuapp.com/";

if (enabled) {
	setInterval(() => {
		// eslint-disable-next-line no-console
		fetch(HEROKU_URL).catch((error: any) => console.error(error));
	}, FIFTEEN_MIN_IN_MS);
}
