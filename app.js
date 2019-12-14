const request = require('request')
const fs = require('fs')
const Snooper = require('reddit-snooper')
const Twit = require('twit')
const chokidar = require('chokidar')

require('dotenv').config()

const snooper = new Snooper({
    username: process.env.REDDIT_USER_NAME,
    password: process.env.REDDIT_PASSWORD,
    app_id: process.env.REDDIT_APP_ID,
    api_secret: process.env.REDDIT_API_SECRET,
    user_agent: process.env.REDDIT_USER_AGENT
})

const twit = new Twit({
    consumer_key:         process.env.TWITTER_CONSUMER_KEY,
    consumer_secret:      process.env.TWITTER_CONSUMER_SECRET,
    access_token:         process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET,
    timeout_ms:           60*1000,
    strictSSL:            true
})
  

// Set global vars
let author
let title
let permalink

// Event listener to watch for new posts on subreddit and download them
snooper.watcher.getPostWatcher('Amoledbackgrounds')
	.on('post', function(newPost) {

		let urlMatch = newPost.data.url.match('\.([a-zA-Z]+$)')
		// Check to make sure the post is not stickied, that it's an image post, and that it contains a link
		if (!newPost.data.stickied && newPost.kind === 't3' && urlMatch) {

			// Grab the author, title, and URL
			author = newPost.data.author
			title = newPost.data.title
			permalink = newPost.data.permalink
			
			// Download the new post
			console.log('New post detected')
			request(newPost.data.url).pipe(fs.createWriteStream("./pics/newestPost.jpg"))
		}
	})
	.on('error', console.error)

	// event listener to watch for new files in pics dir
	chokidar.watch('./pics/newestPost.jpg', {
		ignored: /(^|[\/\\])\../,
		usepolling: true,
		interval: 10000,
		awaitWriteFinish: {
			stabilityThreshold: 60000,
			pollInterval: 10000
		}}).on('change', (event, path) => {
		console.log(event);

		// read the media
		var b64content = fs.readFileSync('./pics/newestPost.jpg', { encoding: 'base64' })

		// first we must post the media to Twitter
		twit.post('media/upload', { media_data: b64content }, function (err, data, response) {
			// now we can assign alt text to the media, for use by screen readers and
			// other text-based presentations and interpreters
			var mediaIdStr = data.media_id_string
			var altText = "New Amoled background by: /u/" + author + " titled: " + title + '. Upvote the post here: reddit.com' + permalink + ' #Amoled #Wallpapers #Backgrounds'
			var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } }
		
			twit.post('media/metadata/create', meta_params, function (err, data, response) {
			if (!err) {
				// now we can reference the media and post a tweet (media will attach to the tweet)
				var params = { status: 'New Post From /r/AmoledBackrounds by: /u/' +
				author + ' titled: "' + title + '". Upvote the post here: reddit.com' + permalink + ' #Amoled #Wallpapers #Backgrounds', media_ids: [mediaIdStr] }
		
				twit.post('statuses/update', params, function (err, data, response) {
				console.log(data)
				})
			} else {
				console.log(err)
			}
		})
	})
});