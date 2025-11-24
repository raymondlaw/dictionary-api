const fs = require("fs");
const http = require("http");
const https = require("https");

// --- Configuration ---
const port = process.env.PORT || 3000;
const dictionary_api_base = "https://api.dictionaryapi.dev/api/v2/entries/en_US";
const global_headers = {"Content-Type": "text/html"};

// --- Server Setup ---
const server = http.createServer();
server.on("request", request_handler);
server.on("listening", listen_handler);
server.listen(port);

// --- Handlers ---
function listen_handler() {
    console.log(`Now Listening on Port ${port}`);
}
function request_handler(req, res) {
    console.log(`Received request for: ${req.url}`);
    if (req.url === "/") {
        const form = fs.createReadStream("html/index.html");
        res.writeHead(200, global_headers);
        form.pipe(res);
    }
    else if (req.url.startsWith("/search")) {
        const user_input = new URL(req.url, `http://${req.headers.host}`).searchParams;
        console.log(`Received: ${user_input.toString()}`);
        const word = user_input.get("word");
        if (word === null || word === "") {
            send_results("", "", 400, res);

        }
        else {
            call_dictionary_service(word, res);
        }
    }
    else {
        res.writeHead(404, global_headers);
        res.end("<h1>Not Found</h1>");
    }
}

// --- Dictionary Service ---

function call_dictionary_service(word, res) {
    const dictionary_url = `${dictionary_api_base}/${encodeURIComponent(word)}`;
    const dictionary_api = https.request(dictionary_url);
    dictionary_api.once("response", (dictionary_res) => process_http_stream(dictionary_res, parse_results, res));
    dictionary_api.once("error", (err) => send_results("", "", 500, res));
    dictionary_api.setTimeout(5000, function () {
        console.log("Request timed out!");
        dictionary_api.destroy(); // aborts the request
        send_results("", "", 504, res);
    });
    dictionary_api.end();
}

// --- Utility Function ---

function process_http_stream(stream, callback, ...args) {
    const {statusCode: status_code} = stream;
    let body = "";
    stream.on("data", function (chunk) {
        body += chunk;
    });
    stream.on("end", () => callback(body, status_code, ...args));
}

// --- Parse Results ---

function parse_results(data, status_code, res) {
    let word = "";
    let definition = "";
    let response_code = status_code;
    if(status_code.toString().startsWith("2")) {
        try {
            const lookup = JSON.parse(data);
            word = lookup?.[0]?.word || "Unknown";
            definition = lookup?.[0]?.meanings?.[0]?.definitions?.[0]?.definition || "No definition available";
            response_code = 200;
        }
        catch (err) {
            response_code = 500;
        }
    }
    else if (status_code === 404) {
        response_code = 404;
    }
    else {
        response_code = 500;
    }
    send_results(word, definition, response_code, res);
}

// --- Send Results ---
function send_results(word, definition, response_code, res) {
    let results_html = "";
    switch (response_code) {
    case 200:
        results_html = `<h1>Results: ${word}</h1><p>${definition}</p>`;
        break;
    case 400:
        results_html = "<h1>Bad Request</h1><p>Missing input. Please provide a word.</p>";
        break;
    case 404:
        results_html = "<h1>No Results Found</h1>";
        break;
    case 504:
        results_html = "<h1>API Error, Gateway Timeout</h1>";
        break;
    default:
        results_html = `<h1>API Error (${response_code})</h1>`;
    }
    res.writeHead(response_code, global_headers);
    res.end(results_html);
}
