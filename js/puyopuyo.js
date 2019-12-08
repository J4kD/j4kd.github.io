const canvas = document.getElementById("puyopuyo");
const context = canvas.getContext("2d");
const scoreElement = document.getElementById("score");

const HEIGHT = 20;
const WIDTH = 10;
const SQUARE = 24;
const RADIUS = 10;
const VACANT = "DARKGREY";
const SLOW_TICK = 500;
const FAST_TICK = 100;
const X = 0;
const Y = 1;

// Draw a grid square
function drawSquare(x, y, colour) {
    context.fillStyle = VACANT;
    context.fillRect(x*SQUARE, y*SQUARE, SQUARE, SQUARE);

    context.strokeStyle = "GREY";
    context.strokeRect(x*SQUARE, y*SQUARE, SQUARE, SQUARE);

    if (colour != VACANT) {
        context.beginPath();
        context.arc((x + 0.5)*SQUARE, (y + 0.5) * SQUARE, RADIUS, 0, 2*Math.PI, false);
        context.fillStyle = colour;
        context.fill();
        context.strokeStyle = "BLACK";
        context.stroke();
    }
}

// Initialise the game
let board = [];
for (x = 0; x < WIDTH; x++) {
    board[x] = [];
    for (y = 0; y < HEIGHT; y++) {
        board[x][y] = VACANT;
    }
}

// Draw the board
function drawBoard() {
    for (x = 0; x < WIDTH; x++) {
        for (y = 0; y < HEIGHT; y++) {
            drawSquare(x, y, board[x][y]);
        }
    }
}
drawBoard();

// PuyoPuyo colours
const TYPES = ["red", "green", "yellow", "blue", "purple"];

// Rotations
const ROTATION = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Generate a random piece
function randomPiece() {
    let left = randomN = Math.floor(Math.random() * TYPES.length)
    let right = randomN = Math.floor(Math.random() * TYPES.length)
    return new Piece(TYPES[left], TYPES[right]);
}
var p = randomPiece();

// Add a free Puyo to the board
function addPuyo(x, y, colour) {
    if (y >= 0) {
        board[x][y] = colour;
    } else {
        gameOver = true;
        alert("Game over!");
    }
}

// Update the board
function updateBoard() {
    let still = true;
    for (x = 0; x < WIDTH; x++) {
        for (y = HEIGHT-2; y >= 0; y--) {
            if (board[x][y+1] == VACANT && board[x][y] != VACANT) {
                board[x][y+1] = board[x][y];
                board[x][y] = VACANT;
                still = false;
            }
        }
    }
    if (still) {
        scoreBoard();
    }
}

function findRoot(pointer) {
    let root = pointer;
    while (root.child !== null) {
        root = root.child;
    }
    return root;
}

// Look for scoring areas
function scoreBoard() {
    let regions = [];
    let still = true;
    for (x = 0; x < WIDTH; x++) {
        regions[x] = [];
        for (y = 0; y < HEIGHT; y++) {
            let colour = board[x][y];
            if (colour != VACANT) {
                regions[x][y] = {count: 1, child: null};
                if (y > 0) {
                    if (board[x][y-1] == colour) {
                        regions[x][y] = findRoot(regions[x][y-1]);
                        regions[x][y].count += 1;
                    }
                }
                if (x > 0) {
                    if (board[x-1][y] == colour) {
                        rootA = findRoot(regions[x-1][y]);
                        rootB = findRoot(regions[x][y]);
                        if (rootA !== rootB) {
                            rootB.child = rootA;
                            rootA.count += rootB.count;
                        }
                    }
                }
            } else {
                regions[x][y] = null;
            }
        }
    }
    for (x = 0; x < WIDTH; x++) {
        for (y = 0; y < HEIGHT; y++) {
            if (regions[x][y] !== null) {
                root = findRoot(regions[x][y])
                if (root.count >= 4) {
                    score += 1;
                    board[x][y] = VACANT;
                    still = false;
                }
            }
        }
    }
    if (still) {
        p = randomPiece();
    }
}

// The Piece class
function Piece(colourA, colourB) {
    this.colourA = colourA;
    this.colourB = colourB;
    this.spin = 0;
    this.x = 4;
    this.y = -1;
}

// Draw this piece
Piece.prototype.draw = function() {
    drawSquare(this.x, this.y, this.colourA);
    drawSquare(this.x + ROTATION[this.spin][X], this.y + ROTATION[this.spin][Y], this.colourB);
}

// Un-draw this piece
Piece.prototype.unDraw = function() {
    drawSquare(this.x, this.y, VACANT);
    drawSquare(this.x + ROTATION[this.spin][X], this.y + ROTATION[this.spin][Y], VACANT);
}

// Move this piece down once
Piece.prototype.moveDown = function() {
    if (!this.collision(0, 1, 0)) {
        this.unDraw();
        this.y++;
        this.draw();
    } else {
        // Lock the piece
        this.lock();
        p = null;
    }
}

// Move this piece right
Piece.prototype.moveRight = function() {
    if (!this.collision(1, 0, 0)) {
        this.unDraw();
        this.x++;
        this.draw();
    }
}

// Move this piece left
Piece.prototype.moveLeft = function() {
    if (!this.collision(-1, 0, 0)) {
        this.unDraw();
        this.x--;
        this.draw();
    }
}

// Rotate this piece
Piece.prototype.rotate = function(){
    let kick = 0;
    
    // Check if we need to kick the piece
    if (this.collision(0, 0, 1)) {
        if (this.x > WIDTH/2) {
            // Kick the piece left
            kick = -1;
        } else {
            // Kick the piece right
            kick = 1;
        }
    }
    
    // Try to rotate
    if (!this.collision(kick, 0, 1)) {
        this.unDraw();
        this.x += kick;
        this.spin = (this.spin + 1) % 4;
        this.draw();
    }
}

// Add the piece to the board
Piece.prototype.lock = function() {
    addPuyo(this.x, this.y, this.colourA);
    addPuyo(this.x + ROTATION[this.spin][X], this.y + ROTATION[this.spin][Y], this.colourB);
}

// Check if piece can move/rotate
Piece.prototype.collision = function(dx, dy, dspin) {
    let newX = this.x + dx;
    let newY = this.y + dy;
    let newSpin = (this.spin + dspin) % 4;

    if (newX < 0 || newX >= WIDTH || newY >= HEIGHT || newX + ROTATION[newSpin][X] < 0 || newX + ROTATION[newSpin][X] >= WIDTH || newY + ROTATION[newSpin][Y] >= HEIGHT) {
        return true;
    }
    if (newY >= 0) {    
        if (board[newX][newY] != VACANT) {
            return true;
        }
    }
    if (newY + ROTATION[newSpin][Y] >= 0) {
        if (board[newX + ROTATION[newSpin][X]][newY + ROTATION[newSpin][Y]] != VACANT) {
            return true;
        }
    }
    return false;
}

// Process keyboard inputs
document.addEventListener("keydown", CONTROL);
function CONTROL(event) {
    if (p !== null) {
        if (event.keyCode == 37){
            p.moveLeft();
            dropStart = Date.now();
        } else if (event.keyCode == 38) {
            p.rotate();
            dropStart = Date.now();
        } else if (event.keyCode == 39) {
            p.moveRight();
            dropStart = Date.now();
        } else if (event.keyCode == 40) {
            p.moveDown();
        }
    }
}

// Move the piece down every tick
var score = 0;
var dropStart = Date.now();
var gameOver = false;
function drop() {
    let now = Date.now();
    let delta = now - dropStart;
    if (delta > FAST_TICK && p === null) {
        updateBoard();
        scoreElement.innerHTML = score;
        drawBoard();
        dropStart = Date.now();
    } else if (delta > SLOW_TICK && p !== null) {
        p.moveDown();
        dropStart = Date.now();
    }
    if (!gameOver) {
        requestAnimationFrame(drop);
    }
}

drop();
