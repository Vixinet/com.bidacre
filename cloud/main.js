
// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:

Parse.Cloud.define("crawlListing", function(request, response) {

	Parse.Cloud.useMasterKey();

	var _ = require("underscore");
	var PropertyLinkObject =  Parse.Object.extend("PropertyLink");
	var FetchingQueueObject =  Parse.Object.extend("FetchingQueue");
	var objects = [];
	var url, httpResponse;

	var _findAll = function(str, re) {
		var m, out = [];
		while ( (m = re.exec(str)) !== null) {
			if (m.index === re.lastIndex) {
				re.lastIndex++;
			}
			out.push(m[1]);
		}
		return out;
	}

	var data = {
		baseUrl: "http://www.landsofamerica.com",
		regex: {
			propertyLink : /href=\"(\/property\/[a-zA-Z0-9-._~:\/?#[\]@!$&'()*+,;=]*)\"/gi,
			nextPage: /data-pagenum=\'[\d]*\' href=\"([a-zA-Z0-9-._~:\/?#[\]@!$&'()*+,;=]*)\"><span class=\'glyphicon glyphicon-chevron-right\'>/gi
		}
	};
	
	var query = new Parse.Query(FetchingQueueObject);
	query.limit(1);
	query.descending('createdAt');
	query.find().then(function(queue) {
		url = queue.length !== 0 ? queue[0].get('url') : '/Ohio/all-land/all-land';
		return Parse.Promise.as(url);
	}).then(function(url) {
		return Parse.Cloud.httpRequest({ url: data.baseUrl + url })
	}).then(function(_httpResponse) {

		httpResponse = _httpResponse;
		console.log(_httpResponse.text)
		return Parse.Promise.error('testing')
		var promises = [];

		_.each(_findAll(httpResponse.text, data.regex.propertyLink), function(fullLink) {
			
			var p = new Parse.Promise();
			promises.push(p);

			var query = new Parse.Query(PropertyLinkObject);
			query.equalTo("link", fullLink);
			query.count().then(function(total) {
				if( total === 0 ) {
					objects.push(new PropertyLinkObject({ 
						status: 'creation',
						link: fullLink
					}));
				}
				p.resolve();
			}, function(error) {
				console.error(error)
				p.reject('Count error');
			});
		});

		return Parse.Promise.when(promises)
	}).then(function() {
		return Parse.Object.saveAll(objects);
	}).then(function() {
		var matches = _findAll(httpResponse.text, data.regex.nextPage);
		var nextUrl = matches.length !== 0 ? matches[0] : '/Ohio/all-land/all-land';
		var o = new FetchingQueueObject();
		return o.save({ url: nextUrl });
	}).then(function() {
		response.success(url + " > " + objects.length + " PropertyLink added!");
	}, function(error) {
		response.error(error);
	});

});

Parse.Cloud.define("crawlProperty", function(request, response) {
	
	Parse.Cloud.useMasterKey();

	var _ = require("underscore");
	var PropertyLinkObject =  Parse.Object.extend("PropertyLink");
	var PropertyObject =  Parse.Object.extend("Property");
	var url, httpResponse, property, propertyLink;

	var _findAll = function(str, re) {
		var m, out = [];
		while ( (m = re.exec(str)) !== null) {
			if (m.index === re.lastIndex) {
				re.lastIndex++;
			}
			out.push(m[1]);
		}
		return out;
	}

	var data = {
		baseUrl: "http://www.landsofamerica.com",
		regex: {
			name: /<h1 itemprop=\"name\">[\s]?(.*?)[\s]?<\/h1>/gi,
			address: /<h1 itemprop=\"description\">[\s]?(.*?)[\s]?<\/h1>/gi,
			propertiesBlock: /<table class=\"propertyDetailsTable\">([^]+)<\/table>/gi,
			county: /<td><strong>County:<\/strong>[\s]?(.*?)[\s]?<\/td>/gi,
			zip: /<td><strong>Zip:<\/strong>[\s]?(.*?)[\s]?<\/td>/gi,
			type: /<td><strong>Type:<\/strong>[\s]?(.*?)[\s]?<\/td>/gi,
			city: /<td><strong>City:<\/strong>[\s]?(.*?)[\s]?<\/td>/gi,
			price: /<span itemprop="price">[$]([0-9\,\.]*)[\s]?<\/span>/gi,
			acres: /<td><strong>Acres:<\/strong>[\s]?(.*?)[\s]?<\/td>/gi,
			state: /<td><strong>State:<\/strong>[\s]?(.*?)[\s]?<\/td>/gi,
			status: /<td><strong>Status:<\/strong>[\s]?(.*?)[\s]?<\/td>/gi,
			pid: /<td><strong>Property ID:[\s]<\/strong>[\s]?(.*?)[\s]?<\/td>/gi,
			website: /<div class="externalLink"><a href="(.*?)"/gi,
			description: /<div class=\"description_header\">.*<p>[\s]?(.*?)[\s]?<\/p><\/div>/gi,
			directions: /<div class=\"directions_header\">.*<\/div><p>[\s]?(.*?)[\s]?<\/p><\/div>/gi,
		}
	};
	
	var query = new Parse.Query(PropertyLinkObject);
	query.limit(1);
	query.equalTo('status', 'creation');
	query.find().then(function(_propertyLink) {
		if( _propertyLink.length === 0 ) {
			return Parse.Promise.error("No properties to crawl!");
		}
		propertyLink = _propertyLink[0];
		return Parse.Promise.as(propertyLink.get('link'));
	}).then(function(_url) {
		url = _url;
		// console.log("** URL ** " + data.baseUrl + url);

		return Parse.Cloud.httpRequest({ url: data.baseUrl + url })
	}).then(function(_httpResponse) {

		if( _httpResponse.status == 301) {
			propertyLink.save({
				link: _httpResponse.headers.Location
			});
			return Parse.Promise.error("301 Moved");
		}

		httpResponse = _httpResponse;

		var source = httpResponse.text.replace(/\n/g, '').replace(/\t/g, '').replace(/  /g, ' ');
		var propertiesBlock = data.regex.propertiesBlock.exec(source)[1];
		var objData = {
			name: data.regex.name.exec(source),
			address: data.regex.address.exec(source),
			county: data.regex.county.exec(source),
			zip: data.regex.zip.exec(source),
			type: data.regex.type.exec(source),
			city: data.regex.city.exec(source),
			price: data.regex.price.exec(source),
			acres: data.regex.acres.exec(source),
			state: data.regex.state.exec(source),
			status: data.regex.status.exec(source),
			pid: data.regex.pid.exec(source),
			website: data.regex.website.exec(source),
			description: data.regex.description.exec(source),
			directions: data.regex.directions.exec(source),
		}

		_.each(objData, function(o, k) {
			if( o !== null && o.length === 2 ) {
				objData[k] = o[1];
			}
		})

		_.extend(objData, {
			propertyLink: propertyLink,
			status: 'crawled'
		});

		var property = new PropertyObject(); 
		return property.save(objData);
	}).then(function(property){
		response.success(url + " > Property [" + property.id + "] added!");
	}, function(error) {
		response.error(error);
	});

});

Parse.Cloud.beforeSave("Property", function(request, response) {

	var object = request.object;

	if( object.get('status') === 'crawled' ) {
		object.set('status', 'validation')
	}

	response.success();
});


Parse.Cloud.afterSave("Property", function(request) {

	var object = request.object;

	var propertyLinkSave = object.get('propertyLink').save({
		property: object,
		status: 'complete'
	});

});

