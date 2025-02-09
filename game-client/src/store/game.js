import { ref } from "vue";

export const useGameStore = () => {
    const ws = ref(null);
    const gameState = ref(null);
    const playerId = ref(null);
    const isConnected = ref(false);
    const roomCode = ref(null);
    const error = ref(null);

    function connect() {
        ws.value = new WebSocket("ws://localhost:3000");

        ws.value.onopen = () => {
            console.log("Connected to game server");
            isConnected.value = true;
            ws.value.send(JSON.stringify({ action: "requestPlayerId" }));
        };

        ws.value.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("Received data:", data);
            
            if (data.error) {
                error.value = data.error;
                return;
            }

            if (data.playerId) {
                playerId.value = data.playerId;
                console.log("Received playerId:", data.playerId);
                return;
            }

            if (data.roomCode) {
                console.log("Setting room code:", data.roomCode);
                roomCode.value = data.roomCode;
            }

            if (data.gameState) {
                console.log("Setting game state:", data.gameState);
                gameState.value = data.gameState;
            }
        };

        ws.value.onerror = (err) => {
            console.error("WebSocket error:", err);
            isConnected.value = false;
            error.value = "Connection error";
        };

        ws.value.onclose = () => {
            console.log("Disconnected from game server");
            isConnected.value = false;
            error.value = "Disconnected from server";
            playerId.value = null;
            roomCode.value = null;
            gameState.value = null;
        };
    }

    function createRoom(pid) {
        console.log("Creating room with playerId:", pid);
        if (ws.value?.readyState === WebSocket.OPEN) {
            ws.value.send(JSON.stringify({ 
                action: "createRoom",
                playerId: pid
            }));
        }
    }

    function joinRoom(code, pid) {
        console.log("Joining room:", code, "with playerId:", pid);
        if (ws.value?.readyState === WebSocket.OPEN) {
            ws.value.send(JSON.stringify({ 
                action: "joinRoom", 
                roomCode: code,
                playerId: pid
            }));
        }
    }

    function sendGuess(guess) {
        if (ws.value?.readyState === WebSocket.OPEN) {
            ws.value.send(JSON.stringify({ 
                action: "guess", 
                guess,
                playerId: playerId.value,
                roomCode: roomCode.value
            }));
        }
    }

    // Return the refs directly
    return { 
        connect, 
        createRoom, 
        joinRoom, 
        sendGuess, 
        gameState,
        playerId,
        isConnected,
        roomCode,
        error
    };
};
