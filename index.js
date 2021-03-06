var express = require('express'),
	app = express(),
	Fs = require('fs'),
	moment = require('moment'),
	Path = require('path'),
	_ = require('lodash'),
	Config = require('./config.json'),
	glob = require('glob'),
	send = require('send'),
	Url = require('url');

var xmlContentType = 'application/rss+xml,application/rdf+xml,application/atom+xml,application/xml,text/xml';

var cache = require('apicache').options({
	debug: true,
	headers: {
		'Content-Type': xmlContentType
	}
}).middleware;

function FeedItem(source, info) {
	return {
		published: moment(info.upload_date, "YYYYMMDD").toDate(),
		id: info.id,
		path: source.replace(Config.media+'/', ''),
		thumbnail: info.thumbnail,
		title: info.fulltitle,
		stitle: info.stitle,
		desc: info.description,
		duration: info.duration,
		durationFmt: moment(0).add('seconds', info.duration).format('HH:mm:ss')
	};
}

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');


app.get('/rss', cache("2 hours"), function(req, res) {
	var files = glob.sync(Path.join(Config.media, '**', '*.mp3'));
	var dataFiles = glob.sync(Path.join(Config.media, '**', '*.info.json'));

	var items = _(files)
		.map(function(file) {
			var infoFile = _.find(dataFiles, function(f) {
				return Path.basename(f, '.info.json') === Path.basename(file, '.mp3');
			});

			if (!Fs.existsSync(infoFile)) {
				return;
			}
			var info = require(infoFile);

			return new FeedItem(file, info);
		})
		.compact()
		.sortBy('published')
		.reverse()
		.__wrapped__; // render doesn't like the lodash wrapped array

	var data = {
		config: Config,
		items: items
	};

	res.setHeader('Content-Type', xmlContentType);
    res.render('rss', data);

});

app.get('/stream/*', function(req, res) {
	var path = Url.parse(req.url).pathname.replace('/stream','');

	send(req, path)
		.root(Config.media)
		.on('error', function(err) {
			res.statusCode = err.status || 500;
			res.end(err.message);
		})
		.on('directory', function() {
			res.statusCode = 403;
			res.end("Forbidden");
		})
		.pipe(res);

});

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});
