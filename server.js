'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dns = require('dns');
const url = require('url');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/
// mongoose.connect(process.env.MONGOLAB_URI);
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'this is the connection error: '));
// db.once('open', () => { console.log('connected to the mongoDB Atlas...') });

const Schema = mongoose.Schema;
const urlSchema = new Schema({
	url: { type: String, required: true },
	shortUrl: String,
	addressUrl: String,
	userIP: String,
	userLanguage: String,
	userSoftware: String,
	createdAt: { type: Date, default: Date.now }
});
const urlModel = db.model('urlDatas', urlSchema);

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
app.use(bodyParser.urlencoded({ extended: 'false' }));
app.use(bodyParser.json());

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function (req, res) {
	res.sendFile(process.cwd() + '/views/index.html');
});


// your first API endpoint... 
app.get("/api/hello", function (req, res) {
	res.json({ greeting: 'hello API' });
});

// app.route('*').get((req, res) => {res.status(404).end('404 - page not found')})

app.get('/api/shorturl/:url', (req, res) => {
	const userInput = req.params.url;

	if (isValidShortUrl(userInput) && userInput.length < 15) {
		urlModel.find({ "shortUrl": userInput }, (err, data) => {
			if (err) return err;
			let redirectUrl = data[0].url;

			res.redirect(redirectUrl);
		});
	} else {
		res.send({ "message": "Invalid short url. Please check ..." })
	}
	// res.send({'user input': userInput})
});

app.post('/api/shorturl/new', (req, res, next) => {
	const userInput = (req.body.url).toLowerCase();
	if (isValidUrl(userInput)) {
		const userUrl = new URL(userInput);
		// const options = {
		//   family: 6,
		//   hints: dns.ADDRCONFIG | dns.V4MAPPED,
		// };
		dns.lookup(userUrl.hostname, (err, address, family) => {

			if (err) {
				console.log(err.code, err.errno, err.hostname);
				res.send({ "error": "invalid Host" })
			} else {
				let ips = req.headers['x-forwarded-for'];
				const routerIp = ips.split(',')[0];
				const lang = req.headers['accept-language'];
				const soft = req.headers['user-agent'];
				const userHref = userUrl.href;


				urlModel.find({}, (err, data) => {
					let counter = data.length;
					const newShortUrl = "top.short." + (counter + 1);
					// console.log('db size '+ counter);
					const newUrlData = new urlModel({
						url: userHref,
						shortUrl: newShortUrl,
						addressUrl: address,
						userIP: routerIp,
						userLanguage: lang,
						userSoftware: soft
					});

					newUrlData.save((err, data) => {
						if (err) return next(err);
						if (!data) {
							console.log('Data missing! check code...')
							return next({ missing: "Data missing! check code..." })
						}
						urlModel.findById(data._id, (err, url) => {
							if (err) return next(err);
							res.send({ "url": url.url, "shortUrl": url.shortUrl })
						})
					});
				});

				// console.log('address: %j family: IPv%s', address, family, userHref);

				// console.log({'user input': req.body.url, "userInput":userUrl});
			}
		});
	} else {
		res.send({ "error": "invalid URL" })
	}

});

// Error handler
app.use((err, req, res, next) => {
	if (err) {
		res.status(err.status || 500)
			.type('txt')
			.send(err.message || 'SERVER ERROR');
	}
});

// Unmatched routes handler
app.use((req, res) => {
	res.status(404).type('txt').send('Page Not Found');
});


app.listen(port, function () {
	console.log('Node.js listening on port: ' + port);
});


// https://mongoosejs.com/docs/api.html#Connection

function isValidUrl(url) {
	return (/https?:\/\/.+/).test(url);
}

function isValidShortUrl(string) {
	return (/top.short./).test(string);
}