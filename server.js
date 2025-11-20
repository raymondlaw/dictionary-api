const fs = require('fs');
const http = require('http');
const https = require('https');

// --- Configuration ---
const port = process.env.PORT || 3000
const dictionary_api_base = 'https://api.dictionaryapi.dev/api/v2/entries/en_US';
const html_headers = { "Content-Type": "text/html" };

// --- Server Setup ---
const server = http.createServer();
server.on("request", request_handler);
server.on("listening", listen_handler);
server.listen(port);

// --- Handlers ---
function listen_handler(){
	console.log(`Now Listening on Port ${port}`);
}
function request_handler(req, res){
console.log(`Received request for: ${req.url}`);
    if(req.url === "/"){
        const form = fs.createReadStream("html/index.html");
		res.writeHead(200, html_headers)
		form.pipe(res);
    }
    else if(req.url.startsWith("/search")){
        const user_input = new URL(req.url, `https://${req.headers.host}`).searchParams;
        console.log(`Received: ${user_input}`);
        const word = user_input.get('word');
        if(word == null || word == ""){
            res.writeHead(404, html_headers);
            res.end("<h1>Missing Input</h1>");        
        }
        else{
			const dictionary_url = `${dictionary_api_base}/${encodeURIComponent(word)}`;
            const dictionary_api = https.request(dictionary_url, dictionary_res => process_http_stream(dictionary_res, parse_results, res));
            dictionary_api.end();
        }
    }
    else{
        res.writeHead(400, html_headers); 
		res.end("<h1>Missing Input. Please provide a word.</h1>");  
    }
}

function process_http_stream (stream, callback , ...args){
	const {statusCode:status_code} = stream;
	let body = "";
	stream.on("data", chunk => body += chunk);
	stream.on("end", () => callback(body, status_code, ...args));
}

function parse_results(data, status_code, res){
	let results_html = "";
    if(status_code === 200){
		const lookup = JSON.parse(data);
		const word = lookup[0]?.word
		const first_definition = lookup[0]?.meanings[0]?.definitions[0]?.definition;
        results_html = `<h1>Results:${word}</h1><p>${first_definition}</p>`;
    }
	else if(status_code === 404){
		results_html = "<h1>No Results Found</h1>"
	}
	else{
		results_html = `<h1>API Error (${status_code})</h1><p>The dictionary service returned an error.</p>`;
	}
	
    res.writeHead(200, html_headers)
	res.end(results_html);
}
