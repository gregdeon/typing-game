var $ = require('jquery');

// CSS and HTML sizes may not agree
// This function changes the HTML to match the CSS
// Call like fixCanvasSize("#my-canvas");
function fixCanvasSize(canvas_id)
{
	var canvas_jquery = $(canvas_id);
	var width = canvas_jquery.width();
	var height = canvas_jquery.height();

	var canvas = canvas_jquery[0];
	canvas.width = width;
	canvas.height = height;
}

// Utilities
function getRandomInt(min, max) 
{
    min = Math.ceil(min);
    max = Math.ceil(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

function quoteToWordList(quote)
{
    var quote_no_punc = quote.replace(/[,.!’']/g, "");
    var quote_uppercase = quote_no_punc.toUpperCase();
    var ret = quote_uppercase.split(" ");
    return ret;
}

function TypingGameInterface() {
    // Constants throughout interface
    this.player_colors = [
        "#000000",
        "#FF0000"
    ];

    this.player_letters = [
        // Player 1: left side
        [
            'Q', 'W', 'E', 'R', 'T', 
            'A', 'S', 'D', 'F',
            'Z', 'X', 'C', 'V'
        ],
        
        // Player 2: right side
        [
            'Y', 'U', 'I', 'O', 'P',
            'G', 'H', 'J', 'K', 'L',
            'B', 'N', 'M'
        ]
    ];

	// Main menu constants
	this.game_names = [
    	"Training Round",
    	"Game 1",
    	"Game 2",
    	"Game 3"
	];

	this.button_width = 300;
	this.button_height = 40;
	this.button_spacing = 30;
	this.button_offset = 200;

    // Game screen constants
    this.game_words_size = 20;
    this.game_words_x = 50;
    this.game_words_dx = this.game_words_size;
    this.game_words_y = 200;
    this.game_words_dy = this.game_words_size + 6;
    this.game_words_column = 35;

    // Position of scrolling bar
    this.box_height = 50;
    // Width/height of each letter's box
    this.box_size = 80;


    // Score screen constants
    this.score_header_y = 45;
    this.score_ids_x = 80;
    this.score_words_x = 100;
    this.score_hits_x = 250;
    this.score_bonus_x = 300;
    this.score_value_x = 350;
    this.score_words_y = 65;
    this.score_words_size = 12;
    this.score_words_spacing = 14;
    this.score_num_words_column = 36;

    // Game tuning
    // Slowest scroll speed
    this.min_speed = 0.002;
    // This is the error rate we want to achieve at equilibrium
    this.goal_error_rate = 0.1;
    // This is our base update -- set it so we get good speeds without too much time
    this.ratio_up = 0.015;
    // This is the downward update, based on the two above
    this.ratio_down = (1 - this.goal_error_rate) / (this.goal_error_rate) * this.ratio_up;

    // Game inputs
    this.quotes = [
        "I’ve learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
        "The greater danger for most of us lies not in setting our aim too high and falling short, but in setting our aim too low, and achieving our mark",
        "In science one tries to tell people, in such a way as to be understood by everyone, something that no one ever knew before. But in poetry, it's the exact opposite.",
        "The most difficult thing is the decision to act, the rest is merely tenacity."
    ];
    this.game_quotes = [
        [0, 1],
        [0, 1],
        [0, 1],
        [0, 1]
    ];


	// Canvas and canvas context
	this.canvas = null;
	this.ctx = null;

	// A stack of keys that have been pressed, but not processed yet
	// Entries in this list are ASCII codes (ie: numbers, not strings)
	this.keys_pressed = [];

	// The game that we currently have selected on the main menu
	this.selected_game = 0;

    // Whether the game is running
    this.game_running = false;

    // Flashy notes
    this.note_list = [];
    this.note_speed = -0.05; // px/ms
}

// Set up the page and start running the game
TypingGameInterface.prototype.initialize = function(config)
{
	this.render();
	fixCanvasSize('#game-canvas');
	
	this.addHandlers();

	this.canvas = $('#game-canvas')[0];
	this.ctx = this.canvas.getContext('2d');

	this.mainMenu();
}

// Add a keypress handler to the document
TypingGameInterface.prototype.addHandlers = function()
{
	var that = this;
	$(document).on("keydown", function(e) {
		that.keys_pressed.push(e.keyCode);
	});
}

// Inject our custom HTML into the task container
TypingGameInterface.prototype.render = function()
{
    // Simple HTML -- just need a canvas
	var html_string = '<canvas id="game-canvas"></canvas>'
	var container = $('#task-container');
	container.append(html_string);
}

// Functions that deal with the game state

// This is run at the start of every game
TypingGameInterface.prototype.setupGameState = function(game_num)
{
    // Number of scrolling letters on the screen
    this.num_boxes = this.canvas.width / this.box_size + 1;

    // List of words that we're going to type in the game
    this.word_list = [];
    // Which player is responsible for each letter
    this.word_players = [];
    // How many points we got for each word
    this.word_scores = [];
    // Which words are the starts of each new quote
    this.quote_start_indices = [];
    // Which letters will appear
    this.letters_shuffled = [];
    // Which letters have been typed so far
    this.letters_typed = [];
    // How many letters are left to type
    this.num_letters_left = 0;

    // Split quotes into words
    for(var i = 0; i < this.game_quotes[game_num].length; i++)
    {
        var quote_num = this.game_quotes[game_num][i];
        this.word_list = this.word_list.concat(quoteToWordList(this.quotes[quote_num]));
        this.quote_start_indices.push(this.word_list.length);
    }

    // Process words
    for(var word_idx = 0; word_idx < this.word_list.length; word_idx++)
    {
        this.word_players.push([]);
        this.word_scores.push(0);
        this.letters_typed.push([]);
        for(var char_idx = 0; char_idx < this.word_list[word_idx].length; char_idx++)
        {
            // Add this character to the shuffled list 
            var letter = this.word_list[word_idx][char_idx];
            var player = 0;
            if(this.player_letters[1].indexOf(letter) >= 0)
            {
                player = 1;
            }
            
            this.letters_shuffled.push({
                word_num:word_idx,
                char_num:char_idx,
                player: player
            });
            
            // Make a spot for the typed letter
            this.letters_typed[word_idx].push(false);
            this.word_players[word_idx].push(player);
            this.num_letters_left += 1;
        }
        
        // Push a blank letter between each word
        this.letters_shuffled.push(null);
    }

    // Present letters in reverse order
    this.letters_shuffled = this.letters_shuffled.reverse();
    
    // Screen starts with no letters
    this.letters_on_screen = [];
    while(this.letters_on_screen.length < this.num_boxes)
    {
        this.letters_on_screen.push(null);
    }
    
    // The last time we updated the scrolling bar
    this.last_box_update = null;
    // Current distance from leftmost box edge to left screen edge
    this.box_offset = 0;
    // Current letter speed
    this.box_rate = this.min_speed;
}

// Move the scrolling letters to the left
TypingGameInterface.prototype.updateBoxOffset = function()
{
    var current_time = Date.now();
    
    if(this.last_box_update !== null)
    {
        var time_diff = current_time - this.last_box_update;
        this.box_offset -= this.box_rate * this.box_size * time_diff;
        while (this.box_offset < -this.box_size)
        {
            this.box_offset += this.box_size;
            
            // Remove the left-most letter and update the scroll speed
            if(this.letters_on_screen[0] !== null)
            {
                this.num_letters_left -= 1;
                this.setBoxSpeed(false);
            }
            
            // (pop item 0)
            this.letters_on_screen.splice(0, 1);
            
            // Add a new letter to the right side
            // If there's one left in the shuffled list, use that one
            var new_letter = null;
            if(this.letters_shuffled.length > 0)
            {
                new_letter = this.letters_shuffled.pop();
            }
            this.letters_on_screen.push(new_letter);
        }
    }  
    
    this.last_box_update = current_time;
}
 
// Set the letter scroll speed
// If speed_up = true, increase by factor of 1+ratio_up;
// otherwise, decrease by 1-ratio_down
TypingGameInterface.prototype.setBoxSpeed = function(speed_up)
{
    if(speed_up)
    {
        this.box_rate *= (1+this.ratio_up);
    }
    else
    {
        this.box_rate *= (1-this.ratio_down);
    }
    
    // Clamp so we don't crash the game
    if(this.box_rate < this.min_speed)
    {
        this.box_rate = this.min_speed;
    }
    
    // Debug
    // console.log(this.box_rate);
}

TypingGameInterface.prototype.checkWordFinished = function(word_idx)
{
    for(var i = 0; i < this.word_list[word_idx].length; i++)
    {
        if(!this.letters_typed[word_idx][i])
        {
            return false;
        }
    }
    return true;
}

// Count how many letters each player missed
// Returns [P1 hits, P1 misses, P2 hits, P2 misses]
TypingGameInterface.prototype.getWordHits = function(word_idx)
{
    var ret = [0, 0, 0, 0];
    
    for(var i = 0; i < this.word_list[word_idx].length; i++)
    {
        var player = this.word_players[word_idx][i];
        if(this.letters_typed[word_idx][i])
        {
            ret[2*player] += 1;
        }
        else
        {
            ret[2*player + 1] += 1;
        }
    }
    return ret;
}


// Return how many points the team earned for this word
TypingGameInterface.prototype.getWordScore = function(word_idx)
{
    var score = 0;
    
    // +1 point for each letter
    for(var i = 0; i < this.word_list[word_idx].length; i++)
    {
        if(this.letters_typed[word_idx][i])
        {
            score += 1;
        }
    }
    
    // +5 points for the full word
    if(score == this.word_list[word_idx].length)
    {
        score += 5;
    }
    
    return score;
}

TypingGameInterface.prototype.getTotalScore = function()
{
    var score = 0;
    for(var i = 0; i < this.word_scores.length; i++)
    {
        score += this.word_scores[i];
    }
    return score;
}


// Drawing functions to help main screens

// Display a single set of blanks with some letters filled in
// str is the string to show
// player is an int array (player[i] = 0/1: show character in P1/2 color)
// filled is a bool array (filled[i] = True: show; False: only draw blank
// x, y, size are position and size of string
TypingGameInterface.prototype.displayHangmanWord = function(str, player, filled, x, y, size)
{
    this.ctx.textAlign = "left";
    this.ctx.font = "" + size + "px Arial";
    
    for(var i = 0; i < str.length; i++)
    {
        // Positions
        var text_x = x + i*size;
        var text_y = y;
        var line_x_start = x + i*size;
        var line_x_end   = line_x_start + size*0.9;
        var line_y = text_y + size * 0.1;
        
        // Pick color based on player
        this.ctx.strokeStyle = this.player_colors[player[i]]
        this.ctx.fillStyle = this.player_colors[player[i]]
        
        // Draw line and maybe letter
        this.ctx.beginPath();
        this.ctx.moveTo(line_x_start, line_y);
        this.ctx.lineTo(line_x_end, line_y);
        if(filled[i])
        {
            this.ctx.fillText(str[i], text_x, text_y);
        }
        this.ctx.stroke();
        this.ctx.closePath();
    }
}

// During game, display words at bottom of the screen
TypingGameInterface.prototype.displayWords = function()
{
    var word_ix = 0;
    var word_iy = 0;
    for(var i = 0; i < this.word_list.length; i++)
    {
        var is_new_quote = ((this.quote_start_indices.indexOf(i) >= 0));
        if(is_new_quote || word_ix + this.word_list[i].length >= this.game_words_column)
        {
            word_ix = 0;
            word_iy += 1;
        }
        var word_x = this.game_words_x + this.game_words_dx * word_ix;
        var word_y = this.game_words_y + this.game_words_dy * word_iy;
        
        this.displayHangmanWord(
            this.word_list[i], 
            this.word_players[i], 
            this.letters_typed[i], 
            word_x,
            word_y,
            this.game_words_size
        );
        
        word_ix += (this.word_list[i].length + 1);
    }

}

// Draw the scrolling letters
TypingGameInterface.prototype.drawBoxes = function() 
{
    for(i = 0; i < this.num_boxes; i++)
    {
        var box_x = this.box_offset + i*this.box_size;
        var box_y = this.box_height;
        
        this.ctx.beginPath();
        this.ctx.rect(box_x, box_y, this.box_size, this.box_size);
        this.ctx.strokeStyle = "#000000";
        this.ctx.stroke();
        this.ctx.closePath();
        
        var text_x = box_x + this.box_size/2;
        var text_y = box_y + 0.80*this.box_size;
        
        if (!(this.letters_on_screen[i] === null))
        {        
            var word_num = this.letters_on_screen[i].word_num;
            var char_num = this.letters_on_screen[i].char_num;
            var box_player = this.letters_on_screen[i].player;
            var box_letter = this.word_list[word_num][char_num];
            
            this.ctx.font = "64px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillStyle = this.player_colors[box_player];
            this.ctx.fillText(box_letter, text_x, text_y);
        }
    }
}

// Draw the score during the game
TypingGameInterface.prototype.drawScore = function()
{
    var score = this.getTotalScore();

    this.ctx.beginPath();
    this.ctx.font = "24px Arial";
    this.ctx.fillStyle = "#000000";
    this.ctx.fillText("Score: " + score, 10, 24);
    this.ctx.closePath();
}

// Draw the scoreboard header on the game over screen
TypingGameInterface.prototype.drawScoreHeader = function(base_x)
{
    this.ctx.font = "" + this.score_words_size + "px Arial";
    this.ctx.textAlign = "right";
    this.ctx.fillText("#", this.base_x + this.score_ids_x, this.score_header_y);
    this.ctx.textAlign = "left";
    this.ctx.fillText("Word",  this.base_x + this.score_words_x, this.score_header_y);
    this.ctx.fillText("Hits",  this.base_x + this.score_hits_x,  this.score_header_y);
    this.ctx.fillText("Bonus", this.base_x + this.score_bonus_x, this.score_header_y);
    this.ctx.fillText("Score", this.base_x + this.score_value_x, this.score_header_y);
}


// Functions for flashy notes
TypingGameInterface.prototype.processNotes = function()
{
    var current_time = Date.now();
    for(var i = 0; i < this.note_list.length; i++)
    {
        // Update height
        var dy = (current_time - this.note_list[i].last_time) * this.note_speed;
        this.note_list[i].y += dy;
        
        // Draw note
        this.ctx.beginPath();
        this.ctx.font = "24px Arial";
        this.ctx.fillStyle = this.note_list[i].color;
        this.ctx.fillText(this.note_list[i].message, this.note_list[i].x, this.note_list[i].y);
        this.ctx.closePath();
        
        // Update time
        this.note_list[i].last_time = current_time;
    }
    
    var i = 0; 
    while(i < this.note_list.length)
    {
        if(current_time > this.note_list[i].time_to_remove)
        {
            this.note_list.splice(i, 1);
        }
        else
        {
            i += 1;
        }
    }
}

TypingGameInterface.prototype.addNote = function(x, y, message, color, duration)
{
    var current_time = Date.now();
    this.note_list.push({
        x: x,
        y: y,
        message: message,
        color: color,
        last_time: current_time,
        time_to_remove: current_time + duration
    });
}

// Game screens
// Each of these run repeatedly using requestAnimationFrame

// Display the main menu screen
TypingGameInterface.prototype.mainMenu = function()
{
    // Handle keys to move cursor up/down
    // If returns true, we should start the game
    var start_game = this.handleKeys()
    if(start_game)
    {    
        // Reset scores and letters
        this.setupGameState(this.selected_game);
        this.gameLoop();
        return;
    }
    
    // Background
    // TODO: this is crazy slow!
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Title
    this.ctx.textAlign = "center";
    this.ctx.font = "48px Arial";
    this.ctx.fillStyle = "#000000";
    this.ctx.fillText("Typing Test", this.canvas.width/2, 100);
    
    // Buttons
	var button_width = this.button_width;
	var button_height = this.button_height;
	var button_spacing = this.button_spacing;
	var button_offset = this.button_offset;
    for(i = 0; i < this.game_names.length; i++)
    {
        var button_x = (this.canvas.width - button_width) / 2;
        var button_y = button_offset + (button_height + button_spacing)*i;
        
        this.ctx.beginPath();
        this.ctx.rect(button_x, button_y, button_width, button_height);
        this.ctx.strokeStyle = "#000000";
        this.ctx.fillStyle = "#79d8d5";
        
        // Only fill the selected one
        if(i == this.selected_game)
        {
            this.ctx.fill();
        }
        this.ctx.stroke();
        this.ctx.closePath();
        
        this.ctx.font = "24px Arial";
        this.ctx.fillStyle = "#000000";
        this.ctx.fillText(this.game_names[i], this.canvas.width/2, button_y + button_height*0.7);
    }
    
    requestAnimationFrame(this.mainMenu.bind(this));
}

// Display the current game state
TypingGameInterface.prototype.gameLoop = function()
{
    this.game_running = true;
    
    // Run game until no more letters to type
    if(this.num_letters_left == 0)
    {
        this.scoreScreen();
        return;
    }
    
    this.handleKeys();
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.updateBoxOffset();
    this.drawBoxes();
    this.displayWords();
    this.drawScore();
    this.processNotes();
    
    requestAnimationFrame(this.gameLoop.bind(this));
}

// Display the score screen at the end of the game
TypingGameInterface.prototype.scoreScreen = function()
{
    this.game_running = false;
    
    // Background
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.textAlign = "center";
    this.ctx.font = "24px Arial";
    this.ctx.fillStyle = "#000000";
    this.ctx.fillText("Scoreboard", this.canvas.width/2, 24);
    
    
    var total_score = 0;
    var total_hits = 0;
    
    var total_p1_hits = 0;
    var total_p1_miss = 0;
    var total_p2_hits = 0;
    var total_p2_miss = 0;
    
    var x_offset = 0;
    var word_x = this.score_words_x;
    var word_y;
    
    this.drawScoreHeader(0);
    
    if(this.word_list.length > this.score_num_words_column)
    {
        this.drawScoreHeader(this.canvas.width/2);
    }
    
    for(var i = 0; i < this.word_list.length; i++)
    {
        if(i >= this.score_num_words_column)
        {
            word_y = this.score_words_y + (i-this.score_num_words_column)*this.score_words_spacing;
            x_offset = this.canvas.width/2;
        } 
        else 
        {   
            word_y = this.score_words_y + i*this.score_words_spacing;
            x_offset = 0;
        }
        
        this.ctx.textAlign = "right";
        this.ctx.font = "" + this.score_words_size + "px Arial";
        this.ctx.fillStyle = "#000000";
        this.ctx.fillText("" + (i+1), x_offset + this.score_ids_x, word_y);
        
        this.displayHangmanWord(
            this.word_list[i], 
            this.word_players[i], 
            this.letters_typed[i], 
            x_offset + word_x,
            word_y,
            this.score_words_size
        );
        
        var hits = this.getWordHits(i);
        var score = this.word_scores[i];
        var sum_hits = hits[0] + hits[2];
        total_score += score;
        total_hits += sum_hits;
        total_p1_hits += hits[0];
        total_p1_miss += hits[1];
        total_p2_hits += hits[2];
        total_p2_miss += hits[3];

        this.ctx.fillStyle = "#000000";
        this.ctx.fillText("" + sum_hits, x_offset + this.score_hits_x, word_y);
        this.ctx.fillText("" + score - sum_hits, x_offset + this.score_bonus_x, word_y);
        this.ctx.fillText("" + score, x_offset + this.score_value_x, word_y);
    }
    
    if(this.word_list.length > this.score_num_words_column)
    {
        word_y = this.score_words_y + this.score_num_words_column*this.score_words_spacing
    }
    else 
    {
        word_y += this.score_words_spacing * 1.5;
    }
    
    this.ctx.textAlign = "right";
    this.ctx.fillText("Total:", x_offset + this.score_hits_x - 10, word_y);
    this.ctx.textAlign = "left";
    this.ctx.fillText("" + total_hits, x_offset + this.score_hits_x, word_y);
    this.ctx.fillText("" + total_score - total_hits, x_offset + this.score_bonus_x, word_y);
    this.ctx.fillText("" + total_score, x_offset + this.score_value_x, word_y);
    
    var return_to_menu = this.handleKeys();
    if(return_to_menu)
    {
        this.mainMenu();
        return;
    }
    
    requestAnimationFrame(this.scoreScreen.bind(this));
}

// Key handling

// Someone pressed <letter>, so handle it
TypingGameInterface.prototype.handleSingleLetter = function(letter)
{
    // Don't allow people to type letters on the score screen
    if(!this.game_running)
        return;
    
    
    // Run through the list of letters on screen
    // If this matches one for this player, take it off
    for(i = 0; i < this.num_boxes; i++)
    {
        if(this.letters_on_screen[i] === null)
            continue;
        
        var word_num = this.letters_on_screen[i].word_num;
        var char_num = this.letters_on_screen[i].char_num;
        var box_letter = this.word_list[word_num][char_num];
        
        if(box_letter === letter)
        {
            // If we find a match, also update our counters
            this.addNote(140, 40, '+1', this.player_colors[this.letters_on_screen[i].player], 200);

            this.letters_on_screen[i] = null;
            this.letters_typed[word_num][char_num] = true;
            this.num_letters_typed += 1;
            this.num_letters_left -= 1;

            // Recalculate score for this word
            this.word_scores[word_num] = this.getWordScore(word_num);
            
            // If word finished, draw a bonus
            if(this.checkWordFinished(word_num))
            {
                this.addNote(180, 40, "+5 Bonus!", "#0000FF", 200);
            }
            
            // Update the scroll speed
            this.setBoxSpeed(true);
            
            break;
        }
    }
}

// Handle all of the pending keypress events
TypingGameInterface.prototype.handleKeys = function()
{
    const min_letter_num = 'A'.charCodeAt(0);
    const max_letter_num = 'Z'.charCodeAt(0);
    const key_enter = 13;
    const key_up = 38;
    const key_down = 40;
    
    var ret = false;
    
    while (this.keys_pressed.length > 0)
    {
        var new_key = this.keys_pressed.pop();
        
        // Letters 
        if(new_key >= min_letter_num && new_key <= max_letter_num)
        {
            this.handleSingleLetter(String.fromCharCode(new_key));
        }
        
        // Menu navigation
        else
        {
            // Up
            if(new_key == 38 && this.selected_game > 0)
            {
                this.selected_game -= 1;
            }
            // Down
            else if(new_key == 40 && this.selected_game < this.game_names.length - 1)
            {
                this.selected_game += 1;
            }
            // Enter
            else if(new_key == 13)
            {
                ret = true;
            }
        }
    }
    
    return ret;
}

module.exports = TypingGameInterface;