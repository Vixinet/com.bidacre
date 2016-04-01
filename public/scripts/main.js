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

var crawl = function() {
	if( running ) {
		Parse.Cloud.run('crawlProperty').then(function(res) {
			$('.log').prepend('<p>'+res+'</p>');
			setTimeout(crawl, 1000);
		}, function(error) {
			$('.log').prepend('<p style="color:red">'+error.message+'</p>');
			setTimeout(crawl, 1000);
		});
	}
}

var xAnimationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
var running = false;

$(document).ready(function() {

	Parse.initialize("XFsoLNm2zemSMMTOyAy7P05aZe28ktAnw1c5rU8p", "4AoDjcYzEWgJMcs5LGfXnKEdo1OXFctCusIEvHC1");

	$('button.run').on('click', function() {
		running = !running;
		crawl();
	})
});