const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());

const MAX_ROUNDS = 10;
const TURN_TIMEOUT = 20000; // 20 seconds in milliseconds
const rooms = new Map();

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateCode() {
    let digits = new Set();
    while (digits.size < 4) {
        digits.add(Math.floor(Math.random() * 10));
    }
    return Array.from(digits).join("");
}

function createNewGame() {
    const code = generateCode();
    console.log("Generated secret code:", code);
    return {
        code,
        players: [],
        currentTurn: 0,
        round: 1,
        gameOver: false,
        winner: null,
        turnStartTime: Date.now(),
        turnTimer: null,
        finalRound: false,
        started: false,
        adminId: null
    };
}

function sanitizeGameState(game) {
    const playerHasGuessed = (playerId) => {
        const player = game.players.find(p => p.id === playerId);
        return player?.guesses?.length > 0;
    };

    return {
        ...game,
        players: game.players.map(player => ({
            id: player.id,
            username: player.username,
            guesses: player.guesses || []
        })),
        turnStartTime: game.turnStartTime,
        // Only include code if game is over and player has guessed
        code: game.gameOver ? game.code : undefined,
        turnTimer: undefined,
        ws: undefined,
        finalRound: game.finalRound
    };
}

function startTurnTimer(roomCode) {
    const game = rooms.get(roomCode);
    if (!game || game.gameOver) return;

    if (game.turnTimer) {
        clearTimeout(game.turnTimer);
    }

    // Send TIMER_START event to all players
    game.players.forEach(player => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify({ 
                action: 'TIMER_START',
                currentTurn: game.currentTurn
            }));
        }
    });

    const timerId = setTimeout(() => {
        const currentGame = rooms.get(roomCode);
        if (!currentGame || currentGame.gameOver) return;

        console.log(`Turn timeout in room ${roomCode}`);
        currentGame.currentTurn = (currentGame.currentTurn + 1) % currentGame.players.length;
        
        if (currentGame.currentTurn === 0) {
            currentGame.round++;
            if (currentGame.round > MAX_ROUNDS) {
                currentGame.gameOver = true;
                console.log("Game over - max rounds reached");
            }
        }

        broadcastToRoom(roomCode);
        
        if (!currentGame.gameOver) {
            startTurnTimer(roomCode);
        }
    }, TURN_TIMEOUT);

    game.turnTimer = timerId;
}

function broadcastToRoom(roomCode) {
    const game = rooms.get(roomCode);
    if (!game) return;

    const sanitizedState = {
        gameState: sanitizeGameState(game),
        roomCode
    };

    // Safe to log now
    console.log('Broadcasting state:', JSON.stringify(sanitizedState, null, 2));

    game.players.forEach(player => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(sanitizedState));
        }
    });
}

function evaluateGuess(guess, code) {
    let correctPosition = 0;
    let correctNumber = 0;
    let wrong = 0;
    
    const codeArray = code.split('');
    const guessArray = guess.split('');
    const usedIndices = new Set();
    
    // First pass: Check correct positions
    for (let i = 0; i < 4; i++) {
        if (guessArray[i] === codeArray[i]) {
            correctPosition++;
            usedIndices.add(i);
        }
    }
    
    // Second pass: Check correct numbers in wrong positions
    for (let i = 0; i < 4; i++) {
        if (!usedIndices.has(i)) {
            const digit = guessArray[i];
            const indexInCode = codeArray.findIndex((num, idx) => !usedIndices.has(idx) && num === digit);
            
            if (indexInCode !== -1) {
                correctNumber++;
                usedIndices.add(indexInCode);
            } else {
                wrong++;
            }
        }
    }
    
    return { correctPosition, correctNumber, wrong };
}

function broadcastNotification(game, message) {
    game.players.forEach(player => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify({ 
                action: 'NOTIFICATION',
                message
            }));
        }
    });
}

wss.on("connection", (ws) => {
    console.log("New client connected");
    let clientPlayerId = null;

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            console.log("Received message:", data);

            switch (data.action) {
                case "requestPlayerId": {
                    clientPlayerId = `Player${Math.random().toString(36).substr(2, 9)}`;
                    ws.send(JSON.stringify({ playerId: clientPlayerId }));
                    break;
                }

                case "createRoom": {
                    const roomCode = generateRoomCode();
                    const newGame = createNewGame();
                    const player = {
                        id: data.playerId,
                        username: data.username || 'Anonymous',
                        ws,
                        guesses: []
                    };
                    newGame.players.push(player);
                    newGame.adminId = data.playerId;
                    rooms.set(roomCode, newGame);
                    
                    const response = {
                        roomCode,
                        gameState: sanitizeGameState(newGame)
                    };
                    
                    console.log(`Room ${roomCode} created by ${player.username} (${data.playerId}) with code ${newGame.code}`);
                    ws.send(JSON.stringify(response));
                    break;
                }

                case "joinRoom": {
                    const game = rooms.get(data.roomCode);
                    if (!game) {
                        ws.send(JSON.stringify({ error: "Room not found" }));
                        return;
                    }
                    if (game.players.length >= 4) {
                        ws.send(JSON.stringify({ error: "Room is full" }));
                        return;
                    }
                    if (game.started) {
                        ws.send(JSON.stringify({ error: "Game already in progress" }));
                        return;
                    }
                    
                    const player = {
                        id: data.playerId,
                        username: data.username || 'Anonymous',
                        ws,
                        guesses: []
                    };
                    game.players.push(player);
                    
                    // Send notification to other players
                    broadcastNotification(game, `${player.username} joined the game`);
                    
                    const response = {
                        roomCode: data.roomCode,
                        gameState: sanitizeGameState(game)
                    };
                    
                    console.log(`Player ${player.username} (${data.playerId}) joined room ${data.roomCode}`);
                    ws.send(JSON.stringify(response));
                    broadcastToRoom(data.roomCode);
                    break;
                }

                case "guess": {
                    const game = rooms.get(data.roomCode);
                    if (!game) return;

                    const playerIndex = game.players.findIndex(p => p.id === data.playerId);
                    if (playerIndex === game.currentTurn && !game.gameOver && game.started) {
                        const result = evaluateGuess(data.guess, game.code);
                        console.log(`Player ${data.playerId} guessed ${data.guess}, result:`, result);
                        
                        if (!game.players[playerIndex].guesses) {
                            game.players[playerIndex].guesses = [];
                        }
                        
                        game.players[playerIndex].guesses.push({
                            guess: data.guess,
                            result
                        });

                        if (result.correctPosition === 4) {
                            game.winner = data.playerId;
                            game.finalRound = true; // Start final round
                            console.log(`Player ${data.playerId} won! Starting final round.`);
                        }

                        game.currentTurn = (game.currentTurn + 1) % game.players.length;
                        
                        // Check if we should end the game
                        if (game.finalRound && game.currentTurn === 0) {
                            game.gameOver = true;
                            console.log("Game over after final round");
                        } else if (game.currentTurn === 0) {
                            game.round++;
                            if (game.round > MAX_ROUNDS) {
                                game.gameOver = true;
                                console.log("Game over - max rounds reached");
                            }
                        }

                        broadcastToRoom(data.roomCode);
                        
                        if (!game.gameOver) {
                            if (game.turnTimer) {
                                clearTimeout(game.turnTimer);
                            }
                            startTurnTimer(data.roomCode);
                        }
                    }
                    break;
                }

                case "startGame": {
                    const game = rooms.get(data.roomCode);
                    if (!game) return;

                    if (game.adminId === data.playerId && !game.started) {
                        game.started = true;
                        startTurnTimer(data.roomCode);
                        broadcastToRoom(data.roomCode);
                    }
                    break;
                }

                case "retryGame": {
                    const game = rooms.get(data.roomCode);
                    if (!game || game.adminId !== data.playerId) return;

                    // Reset game state
                    game.code = generateCode();
                    game.currentTurn = 0;
                    game.round = 1;
                    game.gameOver = false;
                    game.winner = null;
                    game.finalRound = false;
                    game.started = false;
                    game.players.forEach(player => {
                        player.guesses = [];
                    });

                    broadcastToRoom(data.roomCode);
                    break;
                }
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected:", clientPlayerId);
        for (const [roomCode, game] of rooms.entries()) {
            const playerIndex = game.players.findIndex(p => p.ws === ws);
            if (playerIndex !== -1) {
                const disconnectedPlayer = game.players[playerIndex];
                game.players.splice(playerIndex, 1);
                
                // Send notification about player leaving
                broadcastNotification(game, `${disconnectedPlayer.username} left the game`);
                
                console.log(`Player ${clientPlayerId} removed from room ${roomCode}`);
                if (game.players.length === 0) {
                    cleanupRoom(roomCode);
                    console.log(`Room ${roomCode} deleted - no players left`);
                } else {
                    if (game.currentTurn >= game.players.length) {
                        game.currentTurn = 0;
                    }
                    game.turnStartTime = Date.now();
                    broadcastToRoom(roomCode);
                    startTurnTimer(roomCode);
                }
                break;
            }
        }
    });
});

server.listen(3000, () => {
    console.log("WebSocket server running on port 3000");
});

// Clean up timer when room is deleted
function cleanupRoom(roomCode) {
    const game = rooms.get(roomCode);
    if (game && game.turnTimer) {
        clearTimeout(game.turnTimer);
    }
    rooms.delete(roomCode);
}
