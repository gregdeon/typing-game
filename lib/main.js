global.jQuery = require("jquery")
global.$ = require("jquery")
var TypingGameInterface = require('./typing-interface');

// set global UI vars
global.DEV = false;
global.task = window.task || -1;
global.user = window.user || -1;
global.experiment = window.experiment || -1;
var config = window.config || {};

function start(configuration){
	var interface = new TypingGameInterface();
	interface.initialize(configuration);
}

// call start
start(config);